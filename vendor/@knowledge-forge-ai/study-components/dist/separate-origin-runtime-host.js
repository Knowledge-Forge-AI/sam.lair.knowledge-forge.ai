import { canonicalStudyRuntimeOrigin, isStudyRuntimeAssetConfig, STUDY_RUNTIME_ASSET_PATHS, STUDY_RUNTIME_FRAME_PATH, STUDY_RUNTIME_PROTOCOL, STUDY_RUNTIME_SANDBOX, } from "./study-runtime-protocol.js";
export const STUDY_RUNTIME_HOST_LIMITS = Object.freeze({
    maxFrameLoadMs: 5_000,
    maxBindMs: 1_000,
    maxQueuedCommands: 2,
});
export class StudyRuntimeHostError extends Error {
    code = "HOST_UNAVAILABLE";
    constructor() {
        super("Study runtime separate-origin host is unavailable.");
        this.name = "StudyRuntimeHostError";
    }
}
function defaultDocument() {
    const document = globalThis.document;
    return document && typeof document === "object" ? document : undefined;
}
function defaultChannel() {
    const constructor = globalThis.MessageChannel;
    if (!constructor)
        throw new StudyRuntimeHostError();
    return new constructor();
}
function defaultScheduler() {
    const host = globalThis;
    if (typeof host.setTimeout !== "function" || typeof host.clearTimeout !== "function") {
        throw new StudyRuntimeHostError();
    }
    return {
        setTimeout: host.setTimeout.bind(globalThis),
        clearTimeout: host.clearTimeout.bind(globalThis),
    };
}
function defaultWindowEvents() {
    const target = globalThis;
    if (typeof target.addEventListener !== "function" || typeof target.removeEventListener !== "function") {
        throw new StudyRuntimeHostError();
    }
    return target;
}
function addWindowListener(target, listener) {
    if (typeof target.addEventListener !== "function" || typeof target.removeEventListener !== "function") {
        throw new StudyRuntimeHostError();
    }
    target.addEventListener("message", listener);
    return () => target.removeEventListener?.("message", listener);
}
function plainRecord(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        return undefined;
    let prototype;
    let keys;
    try {
        prototype = Object.getPrototypeOf(value);
        keys = Reflect.ownKeys(value);
    }
    catch {
        return undefined;
    }
    if (prototype !== Object.prototype && prototype !== null)
        return undefined;
    for (const key of keys) {
        if (typeof key !== "string")
            return undefined;
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !descriptor.enumerable || !("value" in descriptor))
            return undefined;
    }
    return value;
}
function dataField(record, key) {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
}
function exactFields(record, expected) {
    const names = Object.keys(record);
    const allowed = new Set(expected);
    return names.length === expected.length && names.every((name) => allowed.has(name));
}
function validRunId(value) {
    return /^[a-z0-9-]{1,80}$/u.test(value);
}
function frameUrl(runnerOrigin, parentOrigin, runId) {
    const url = new URL(STUDY_RUNTIME_FRAME_PATH, runnerOrigin);
    url.searchParams.set("parentOrigin", parentOrigin);
    url.searchParams.set("runId", runId);
    return url.href;
}
function removeFrame(container, iframe) {
    try {
        iframe.remove?.();
        container.removeChild?.(iframe);
    }
    catch { /* local cleanup is best effort */ }
}
function identityMatches(value, runId, runnerOrigin) {
    const record = plainRecord(value);
    if (!record || dataField(record, "protocol") !== STUDY_RUNTIME_PROTOCOL
        || dataField(record, "runId") !== runId
        || (runnerOrigin !== undefined && dataField(record, "runnerOrigin") !== runnerOrigin))
        return undefined;
    return record;
}
class SeparateOriginRuntimeJob {
    port;
    #container;
    #iframe;
    #parentPort;
    #framePort;
    #scheduler;
    #runId;
    #parentOrigin;
    #runnerOrigin;
    #assets;
    #windowEvents;
    #maxBindMs;
    #listeners = new Set();
    #queued = [];
    #loadTimer;
    #bindTimer;
    #windowBound = false;
    #bindSent = false;
    #portBound = false;
    #portReady = false;
    #failed = false;
    #disposed = false;
    #removeWindowListener;
    constructor(container, iframe, channel, scheduler, runId, parentOrigin, runnerOrigin, assets, windowEvents, maxFrameLoadMs, maxBindMs) {
        this.#container = container;
        this.#iframe = iframe;
        this.#parentPort = channel.port1;
        this.#framePort = channel.port2;
        this.#scheduler = scheduler;
        this.#runId = runId;
        this.#parentOrigin = parentOrigin;
        this.#runnerOrigin = runnerOrigin;
        this.#assets = assets;
        this.#windowEvents = windowEvents;
        this.#maxBindMs = maxBindMs;
        this.port = Object.freeze({
            send: (message) => this.send(message),
            subscribe: (listener) => this.subscribe(listener),
            close: () => this.dispose(),
        });
        try {
            this.#parentPort.onmessage = (event) => this.forward(event.data);
            this.#parentPort.start();
            this.#removeWindowListener = addWindowListener(this.#windowEvents, this.#onWindowMessage);
            this.#iframe.addEventListener("load", this.#onLoad);
            this.#iframe.addEventListener("error", this.#onLoadError);
            this.#loadTimer = this.#scheduler.setTimeout(this.#onLoadError, maxFrameLoadMs);
            if (this.#loadTimer === undefined)
                throw new StudyRuntimeHostError();
        }
        catch {
            this.dispose();
            throw new StudyRuntimeHostError();
        }
    }
    #clearTimer(name) {
        const timer = name === "load" ? this.#loadTimer : this.#bindTimer;
        if (timer === undefined)
            return;
        try {
            this.#scheduler.clearTimeout(timer);
        }
        catch { /* local cleanup */ }
        if (name === "load")
            this.#loadTimer = undefined;
        else
            this.#bindTimer = undefined;
    }
    #armBindTimer() {
        this.#clearTimer("load");
        this.#bindTimer = this.#scheduler.setTimeout(this.#onLoadError, this.#maxBindMs);
        if (this.#bindTimer === undefined)
            this.#onLoadError();
    }
    #onLoad = () => {
        if (this.#disposed || this.#failed || this.#windowBound || this.#bindSent)
            return;
        const frameWindow = this.#iframe.contentWindow;
        if (!frameWindow) {
            this.#onLoadError();
            return;
        }
        try {
            this.#bindSent = true;
            frameWindow.postMessage({
                type: "bind",
                protocol: STUDY_RUNTIME_PROTOCOL,
                runId: this.#runId,
                parentOrigin: this.#parentOrigin,
                runnerOrigin: this.#runnerOrigin,
                assets: this.#assets,
            }, this.#runnerOrigin, [this.#framePort]);
            this.#armBindTimer();
        }
        catch {
            this.#onLoadError();
        }
    };
    #onWindowMessage = (event) => {
        if (this.#disposed || this.#failed || this.#windowBound)
            return;
        if (event.source !== this.#iframe.contentWindow || event.origin !== this.#runnerOrigin)
            return;
        const record = identityMatches(event.data, this.#runId, this.#runnerOrigin);
        if (!record || !exactFields(record, ["type", "protocol", "runId", "runnerOrigin"])
            || dataField(record, "type") !== "bound-window")
            return;
        this.#windowBound = true;
        this.#maybeReady();
    };
    #onLoadError = () => {
        if (this.#disposed || this.#failed)
            return;
        this.#failed = true;
        this.#clearTimer("load");
        this.#clearTimer("bind");
        this.#notify({
            type: "error",
            protocol: STUDY_RUNTIME_PROTOCOL,
            runId: this.#runId,
            code: "HOST_UNAVAILABLE",
        });
        this.dispose();
    };
    #maybeReady() {
        if (this.#disposed || this.#failed || !this.#windowBound || !this.#portBound || !this.#portReady)
            return;
        this.#clearTimer("bind");
        this.#iframe.removeEventListener("load", this.#onLoad);
        this.#iframe.removeEventListener("error", this.#onLoadError);
        const queue = this.#queued.splice(0);
        for (const message of queue) {
            if (this.#disposed || this.#failed)
                return;
            try {
                this.#parentPort.postMessage(message);
            }
            catch {
                this.#onLoadError();
                return;
            }
        }
    }
    #notify(message) {
        for (const listener of [...this.#listeners]) {
            try {
                listener(message);
            }
            catch { /* caller observation cannot break cleanup */ }
        }
    }
    forward(message) {
        if (this.#disposed || this.#failed)
            return;
        const record = identityMatches(message, this.#runId);
        if (!record)
            return;
        const type = dataField(record, "type");
        if (!this.#portBound) {
            if (type !== "bound" || !exactFields(record, ["type", "protocol", "runId", "runnerOrigin"])
                || dataField(record, "runnerOrigin") !== this.#runnerOrigin)
                return;
            this.#portBound = true;
            this.#maybeReady();
            return;
        }
        if (!this.#portReady) {
            if (type !== "ready" || !exactFields(record, ["type", "protocol", "runId", "runnerOrigin"])
                || dataField(record, "runnerOrigin") !== this.#runnerOrigin)
                return;
            this.#portReady = true;
            this.#maybeReady();
            return;
        }
        if (type === "probe" || type === "stdout" || type === "stderr" || type === "result" || type === "error") {
            this.#notify(message);
        }
        else {
            this.#notify(message);
        }
    }
    send(message) {
        if (this.#disposed || this.#failed)
            return;
        if (!this.#portReady || !this.#windowBound || !this.#portBound) {
            if (this.#queued.length >= 2) {
                this.#onLoadError();
                return;
            }
            this.#queued.push(message);
            return;
        }
        try {
            this.#parentPort.postMessage(message);
        }
        catch {
            this.#onLoadError();
        }
    }
    subscribe(listener) {
        if (!this.#disposed)
            this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }
    dispose() {
        if (this.#disposed)
            return;
        this.#disposed = true;
        this.#failed = true;
        this.#queued.length = 0;
        this.#clearTimer("load");
        this.#clearTimer("bind");
        try {
            this.#removeWindowListener?.();
        }
        catch { /* cleanup */ }
        try {
            this.#iframe.removeEventListener("load", this.#onLoad);
        }
        catch { /* cleanup */ }
        try {
            this.#iframe.removeEventListener("error", this.#onLoadError);
        }
        catch { /* cleanup */ }
        this.#parentPort.onmessage = null;
        try {
            this.#parentPort.close();
        }
        catch { /* cleanup */ }
        try {
            this.#framePort.close();
        }
        catch { /* cleanup */ }
        this.#listeners.clear();
        removeFrame(this.#container, this.#iframe);
    }
}
export function createSeparateOriginRuntimeHost(options) {
    const requestedParentOrigin = options.parentOrigin
        ?? globalThis.location?.origin;
    const parentOrigin = canonicalStudyRuntimeOrigin(requestedParentOrigin);
    const runnerOrigin = canonicalStudyRuntimeOrigin(options.runnerOrigin);
    const document = options.document ?? defaultDocument();
    const scheduler = options.scheduler ?? defaultScheduler();
    const createMessageChannel = options.createMessageChannel ?? defaultChannel;
    const windowEvents = options.windowEvents ?? defaultWindowEvents();
    const requestedAssets = options.assets ?? STUDY_RUNTIME_ASSET_PATHS;
    const maxFrameLoadMs = options.maxFrameLoadMs ?? STUDY_RUNTIME_HOST_LIMITS.maxFrameLoadMs;
    const maxBindMs = options.maxBindMs ?? STUDY_RUNTIME_HOST_LIMITS.maxBindMs;
    if (parentOrigin === undefined || runnerOrigin === undefined || parentOrigin === runnerOrigin
        || !document || !isStudyRuntimeAssetConfig(requestedAssets)
        || !Number.isSafeInteger(maxFrameLoadMs) || maxFrameLoadMs < 1 || maxFrameLoadMs > STUDY_RUNTIME_HOST_LIMITS.maxFrameLoadMs
        || !Number.isSafeInteger(maxBindMs) || maxBindMs < 1 || maxBindMs > STUDY_RUNTIME_HOST_LIMITS.maxBindMs
        || typeof scheduler.setTimeout !== "function" || typeof scheduler.clearTimeout !== "function"
        || typeof createMessageChannel !== "function")
        throw new StudyRuntimeHostError();
    const container = document.body ?? document.documentElement;
    if (!container)
        throw new StudyRuntimeHostError();
    const assets = STUDY_RUNTIME_ASSET_PATHS;
    return Object.freeze({
        parentOrigin,
        runnerOrigin,
        createJob: (runId) => {
            if (!validRunId(runId))
                throw new StudyRuntimeHostError();
            let iframe;
            let job;
            try {
                iframe = document.createElement("iframe");
                iframe.sandbox.value = STUDY_RUNTIME_SANDBOX;
                if (iframe.sandbox.value !== STUDY_RUNTIME_SANDBOX)
                    throw new StudyRuntimeHostError();
                iframe.hidden = true;
                iframe.src = frameUrl(runnerOrigin, parentOrigin, runId);
                const channel = createMessageChannel();
                job = new SeparateOriginRuntimeJob(container, iframe, channel, scheduler, runId, parentOrigin, runnerOrigin, assets, windowEvents, maxFrameLoadMs, maxBindMs);
                container.appendChild(iframe);
                return job;
            }
            catch (error) {
                if (job)
                    job.dispose();
                else {
                    try {
                        iframe?.remove?.();
                    }
                    catch { /* cleanup */ }
                }
                if (error instanceof StudyRuntimeHostError)
                    throw error;
                throw new StudyRuntimeHostError();
            }
        },
    });
}
export function createSeparateOriginRuntimeWatchdog(options = {}) {
    const scheduler = options.scheduler ?? defaultScheduler();
    return Object.freeze({
        set: scheduler.setTimeout.bind(scheduler),
        clear: scheduler.clearTimeout.bind(scheduler),
    });
}
