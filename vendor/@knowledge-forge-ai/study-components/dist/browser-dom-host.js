import { STUDY_BROWSER_RUNNER_BOOTSTRAP, STUDY_BROWSER_RUNNER_CSP, STUDY_BROWSER_RUNNER_SANDBOX, STUDY_BROWSER_RUNNER_TARGET_ORIGIN, } from "./browser-runner.js";
export class StudyBrowserDomHostError extends Error {
    code = "HOST_UNAVAILABLE";
    constructor() {
        super("Study browser DOM host is unavailable.");
        this.name = "StudyBrowserDomHostError";
    }
}
export const STUDY_BROWSER_DOM_HOST_LIMITS = Object.freeze({
    maxFrameLoadMs: 5_000,
    maxQueuedCommands: 2,
});
function unavailableJob(runId, scheduler) {
    let listener;
    let disposed = false;
    let notified = false;
    let notificationTimer;
    const notify = () => {
        if (disposed || notified)
            return;
        notified = true;
        try {
            listener?.({ type: "host-error", runId, code: "HOST_UNAVAILABLE" });
        }
        catch { /* terminal cleanup remains caller-owned */ }
    };
    const port = {
        send: () => {
            if (disposed || notified || notificationTimer !== undefined)
                return;
            const handle = scheduler.setTimeout(() => {
                notificationTimer = undefined;
                notify();
            }, 0);
            if (handle === undefined) {
                notify();
                return;
            }
            notificationTimer = handle;
        },
        subscribe: (next) => {
            listener = next;
            return () => {
                if (listener === next)
                    listener = undefined;
            };
        },
        close: () => {
            disposed = true;
            listener = undefined;
            if (notificationTimer !== undefined) {
                scheduler.clearTimeout(notificationTimer);
                notificationTimer = undefined;
            }
        },
    };
    return Object.freeze({
        port,
        dispose: () => port.close(),
    });
}
function defaultDocument() {
    const candidate = globalThis.document;
    return candidate && typeof candidate === "object" ? candidate : undefined;
}
function defaultMessageChannel() {
    const constructor = globalThis.MessageChannel;
    if (!constructor)
        throw new StudyBrowserDomHostError();
    return new constructor();
}
function defaultScheduler() {
    const host = globalThis;
    if (typeof host.setTimeout !== "function" || typeof host.clearTimeout !== "function") {
        throw new StudyBrowserDomHostError();
    }
    return {
        setTimeout: host.setTimeout.bind(globalThis),
        clearTimeout: host.clearTimeout.bind(globalThis),
    };
}
function escapeAttribute(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("\"", "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}
function escapeScript(value) {
    return value.replace(/<\/script/giu, "<\\/script");
}
function trustedSrcdoc() {
    const csp = escapeAttribute(STUDY_BROWSER_RUNNER_CSP);
    const bootstrap = escapeScript(STUDY_BROWSER_RUNNER_BOOTSTRAP);
    return `<!doctype html><meta http-equiv="Content-Security-Policy" content="${csp}"><script>${bootstrap}</script>`;
}
function removeFrame(container, iframe) {
    try {
        if (typeof iframe.remove === "function")
            iframe.remove();
        else
            container.removeChild?.(iframe);
    }
    catch {
        // Host cleanup is intentionally best effort and never exposes a raw error.
    }
}
function validScheduler(value) {
    return typeof value.setTimeout === "function" && typeof value.clearTimeout === "function";
}
function validChannel(value) {
    return Boolean(value && value.port1 && value.port2)
        && typeof value.port1.postMessage === "function"
        && typeof value.port1.start === "function"
        && typeof value.port1.close === "function"
        && typeof value.port2.postMessage === "function"
        && typeof value.port2.start === "function"
        && typeof value.port2.close === "function";
}
function validHostOptions(options) {
    return options.schema === "study-browser-runner-v1"
        && options.sandbox === STUDY_BROWSER_RUNNER_SANDBOX
        && options.targetOrigin === STUDY_BROWSER_RUNNER_TARGET_ORIGIN
        && options.csp === STUDY_BROWSER_RUNNER_CSP
        && options.bootstrap === STUDY_BROWSER_RUNNER_BOOTSTRAP
        && options.workerPerJob === true;
}
class DomJob {
    port;
    container;
    iframe;
    parentPort;
    framePort;
    scheduler;
    runId;
    maxFrameLoadMs;
    queued = [];
    listeners = new Set();
    loadTimer;
    bindingPosted = false;
    ready = false;
    failed = false;
    disposed = false;
    constructor(container, iframe, channel, scheduler, runId, maxFrameLoadMs) {
        this.container = container;
        this.iframe = iframe;
        this.parentPort = channel.port1;
        this.framePort = channel.port2;
        this.scheduler = scheduler;
        this.runId = runId;
        this.maxFrameLoadMs = maxFrameLoadMs;
        this.port = Object.freeze({
            send: (message) => this.send(message),
            subscribe: (listener) => this.subscribe(listener),
            close: () => this.closePort(),
        });
        try {
            this.parentPort.onmessage = (event) => this.forward(event.data);
            this.parentPort.start();
            this.iframe.addEventListener("load", this.onLoad);
            this.iframe.addEventListener("error", this.onLoadError);
            const loadTimer = this.scheduler.setTimeout(this.onLoadError, this.maxFrameLoadMs);
            if (loadTimer === undefined)
                throw new StudyBrowserDomHostError();
            this.loadTimer = loadTimer;
        }
        catch {
            this.dispose();
            throw new StudyBrowserDomHostError();
        }
    }
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        this.ready = false;
        this.failed = true;
        this.queued.length = 0;
        this.clearLoadTimer();
        try {
            this.iframe.removeEventListener("load", this.onLoad);
        }
        catch { /* cleanup */ }
        try {
            this.iframe.removeEventListener("error", this.onLoadError);
        }
        catch { /* cleanup */ }
        this.parentPort.onmessage = null;
        try {
            this.parentPort.close();
        }
        catch { /* cleanup */ }
        try {
            this.framePort?.close();
        }
        catch { /* cleanup */ }
        this.framePort = undefined;
        this.listeners.clear();
        removeFrame(this.container, this.iframe);
    }
    onLoad = () => {
        if (this.disposed || this.failed || this.ready || this.bindingPosted)
            return;
        const frameWindow = this.iframe.contentWindow;
        const framePort = this.framePort;
        if (!frameWindow || !framePort) {
            this.failHost();
            return;
        }
        try {
            frameWindow.postMessage({ type: "bind", runId: this.runId }, STUDY_BROWSER_RUNNER_TARGET_ORIGIN, [framePort]);
            this.bindingPosted = true;
        }
        catch {
            this.failHost();
        }
    };
    onLoadError = () => {
        this.failHost();
    };
    clearLoadTimer() {
        if (this.loadTimer === undefined)
            return;
        try {
            this.scheduler.clearTimeout(this.loadTimer);
        }
        catch { /* cleanup */ }
        this.loadTimer = undefined;
    }
    subscribe(listener) {
        if (!this.disposed)
            this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    send(message) {
        if (this.disposed || this.failed)
            return;
        if (!this.ready) {
            if (this.queued.length >= STUDY_BROWSER_DOM_HOST_LIMITS.maxQueuedCommands) {
                this.failHost();
                return;
            }
            this.queued.push(message);
            return;
        }
        try {
            this.parentPort.postMessage(message);
        }
        catch {
            this.failHost();
        }
    }
    flushQueue() {
        const queue = this.queued.splice(0);
        for (const message of queue) {
            if (this.disposed || this.failed)
                return;
            try {
                this.parentPort.postMessage(message);
            }
            catch {
                this.failHost();
                return;
            }
        }
    }
    forward(message) {
        if (this.disposed || this.failed)
            return;
        if (this.isReadyAck(message)) {
            this.ready = true;
            this.clearLoadTimer();
            this.iframe.removeEventListener("load", this.onLoad);
            this.iframe.removeEventListener("error", this.onLoadError);
            this.flushQueue();
            return;
        }
        if (this.isReadyMessageForRun(message)) {
            this.failHost();
            return;
        }
        for (const listener of [...this.listeners]) {
            try {
                listener(message);
            }
            catch { /* consumer cleanup remains host-owned */ }
        }
    }
    isReadyAck(message) {
        if (message === null || typeof message !== "object")
            return false;
        const record = message;
        const keys = Object.keys(record);
        return this.bindingPosted && record.type === "ready" && record.runId === this.runId
            && keys.length === 2 && keys.includes("type") && keys.includes("runId");
    }
    isReadyMessageForRun(message) {
        if (message === null || typeof message !== "object")
            return false;
        const record = message;
        return record.type === "ready" && record.runId === this.runId;
    }
    failHost() {
        if (this.disposed || this.failed)
            return;
        this.failed = true;
        this.ready = false;
        this.clearLoadTimer();
        const message = { type: "host-error", runId: this.runId, code: "HOST_UNAVAILABLE" };
        try {
            for (const listener of [...this.listeners]) {
                try {
                    listener(message);
                }
                catch { /* cleanup below remains mandatory */ }
            }
        }
        finally {
            this.dispose();
        }
    }
    closePort() {
        this.dispose();
    }
}
function createDomJob(document, channelFactory, scheduler, options, maxFrameLoadMs) {
    if (!validHostOptions(options))
        throw new StudyBrowserDomHostError();
    const container = document.body ?? document.documentElement;
    if (!container)
        throw new StudyBrowserDomHostError();
    let iframe;
    let channel;
    let job;
    try {
        iframe = document.createElement("iframe");
        iframe.sandbox.value = STUDY_BROWSER_RUNNER_SANDBOX;
        if (iframe.sandbox.value !== STUDY_BROWSER_RUNNER_SANDBOX)
            throw new StudyBrowserDomHostError();
        if ("hidden" in iframe)
            iframe.hidden = true;
        if (iframe.style)
            iframe.style.display = "none";
        iframe.srcdoc = trustedSrcdoc();
        channel = channelFactory();
        if (!validChannel(channel))
            throw new StudyBrowserDomHostError();
        job = new DomJob(container, iframe, channel, scheduler, options.runId, maxFrameLoadMs);
        container.appendChild(iframe);
        return job;
    }
    catch (error) {
        job?.dispose();
        try {
            channel?.port1.close();
        }
        catch { /* cleanup */ }
        try {
            channel?.port2.close();
        }
        catch { /* cleanup */ }
        if (iframe)
            removeFrame(container, iframe);
        if (error instanceof StudyBrowserDomHostError)
            throw error;
        throw new StudyBrowserDomHostError();
    }
}
export function createStudyBrowserDomWatchdog(options = {}) {
    const scheduler = options.scheduler ?? defaultScheduler();
    if (!validScheduler(scheduler))
        throw new StudyBrowserDomHostError();
    return Object.freeze({
        set: scheduler.setTimeout.bind(scheduler),
        clear: scheduler.clearTimeout.bind(scheduler),
    });
}
export function createStudyBrowserDomHost(options = {}) {
    const document = options.document ?? defaultDocument();
    const channelFactory = options.createMessageChannel ?? defaultMessageChannel;
    const scheduler = options.scheduler ?? defaultScheduler();
    const maxFrameLoadMs = options.maxFrameLoadMs ?? STUDY_BROWSER_DOM_HOST_LIMITS.maxFrameLoadMs;
    if (!document || !validScheduler(scheduler) || !Number.isSafeInteger(maxFrameLoadMs)
        || maxFrameLoadMs < 1 || maxFrameLoadMs > STUDY_BROWSER_DOM_HOST_LIMITS.maxFrameLoadMs) {
        throw new StudyBrowserDomHostError();
    }
    return Object.freeze({
        createSandboxJob: (jobOptions) => {
            try {
                return createDomJob(document, channelFactory, scheduler, jobOptions, maxFrameLoadMs);
            }
            catch {
                return unavailableJob(jobOptions.runId, scheduler);
            }
        },
    });
}
