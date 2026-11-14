import { createStudyTypeScriptCompilerWorker, STUDY_TYPESCRIPT_COMPILER_SHA256, STUDY_TYPESCRIPT_COMPILER_VERSION, STUDY_TYPESCRIPT_COMPILE_TIMEOUT_MS, STUDY_TYPESCRIPT_MAX_COMPILED_BYTES, STUDY_TYPESCRIPT_MAX_SOURCE_BYTES, } from "./study-typescript-compiler-worker.js";
const SAFE_COMPILE_ERROR_CODES = new Set([
    "SOURCE_TOO_LARGE",
    "FUNCTION_EXPRESSION_REQUIRED",
    "MODULE_SYNTAX_UNSUPPORTED",
    "DEPENDENCY_LOAD_UNSUPPORTED",
    "JSX_TSX_UNSUPPORTED",
    "SOURCE_SYNTAX_INVALID",
    "COMPILED_OUTPUT_TOO_LARGE",
]);
function defaultScheduler() {
    const host = globalThis;
    if (typeof host.setTimeout !== "function" || typeof host.clearTimeout !== "function") {
        throw new Error("TypeScript compiler watchdog is unavailable.");
    }
    return {
        set: host.setTimeout.bind(globalThis),
        clear: host.clearTimeout.bind(globalThis),
    };
}
function emptyResult(request) {
    return {
        stdout: "",
        stderr: "",
        sourceRevision: request.sourceRevision,
        inputRevision: request.inputRevision,
        runToken: request.runToken,
    };
}
function errorResult(request, code, stderr) {
    return Object.freeze({ kind: "error", code, ...emptyResult(request), stderr });
}
function stoppedResult(request) {
    return Object.freeze({ kind: "stopped", ...emptyResult(request) });
}
function timeoutResult(request) {
    return Object.freeze({
        kind: "timeout",
        phase: "initialization",
        ...emptyResult(request),
        stderr: "TYPESCRIPT_COMPILATION_TIMEOUT",
    });
}
function compileErrorResult(request, code) {
    if (code === "SOURCE_TOO_LARGE" || code === "COMPILED_OUTPUT_TOO_LARGE"
        || code === "FUNCTION_EXPRESSION_REQUIRED" || code === "MODULE_SYNTAX_UNSUPPORTED"
        || code === "DEPENDENCY_LOAD_UNSUPPORTED" || code === "JSX_TSX_UNSUPPORTED"
        || code === "SOURCE_SYNTAX_INVALID") {
        return errorResult(request, "INVALID_SOURCE", code);
    }
    return errorResult(request, "HOST_UNAVAILABLE", "COMPILER_WORKER_UNAVAILABLE");
}
function isCompilerMessage(value) {
    if (value === null || typeof value !== "object")
        return false;
    const record = value;
    if (typeof record.requestId !== "number" || !Number.isSafeInteger(record.requestId))
        return false;
    if (record.kind === "ready")
        return true;
    if (record.kind === "compiled")
        return typeof record.code === "string";
    if (record.kind === "diagnostic")
        return typeof record.code === "string" && SAFE_COMPILE_ERROR_CODES.has(record.code);
    return record.kind === "boot-error" && record.code === "COMPILER_WORKER_UNAVAILABLE";
}
function messageCode(value) {
    if (value.kind !== "diagnostic")
        return undefined;
    return SAFE_COMPILE_ERROR_CODES.has(value.code) ? value.code : "SOURCE_SYNTAX_INVALID";
}
function messageCompiledCode(value) {
    if (value.kind !== "compiled")
        return undefined;
    const candidate = value.code;
    return typeof candidate === "string" ? candidate : undefined;
}
function validAsset(asset) {
    return typeof asset.url === "string" && asset.url.length > 0
        && asset.version === STUDY_TYPESCRIPT_COMPILER_VERSION
        && asset.sha256 === STUDY_TYPESCRIPT_COMPILER_SHA256;
}
class TypeScriptAdapterController {
    #request;
    #observers;
    #base;
    #asset;
    #createCompilerWorker;
    #scheduler;
    #status = "created";
    #worker;
    #timer;
    #requestId = 0;
    #resolve;
    #downstream;
    #onMessage;
    #onWorkerError;
    constructor(request, observers, options) {
        this.#request = request;
        this.#observers = observers;
        this.#base = options.base;
        this.#asset = options.compilerAsset;
        this.#createCompilerWorker = options.createCompilerWorker ?? createStudyTypeScriptCompilerWorker;
        this.#scheduler = options.scheduler ?? defaultScheduler();
    }
    start() {
        if (this.#status !== "created")
            throw new TypeError("Study editor execution controllers are single-use.");
        if (!validAsset(this.#asset)) {
            this.#status = "terminal";
            return Promise.resolve(errorResult(this.#request, "INVALID_CONFIGURATION", "INVALID_TYPESCRIPT_COMPILER_ASSET"));
        }
        if (this.#request.pythonEntry !== undefined) {
            this.#status = "terminal";
            return Promise.resolve(errorResult(this.#request, "INVALID_ENTRY", "INVALID_ENTRY"));
        }
        if (typeof this.#request.source !== "string"
            || new TextEncoder().encode(this.#request.source).byteLength > STUDY_TYPESCRIPT_MAX_SOURCE_BYTES) {
            this.#status = "terminal";
            return Promise.resolve(errorResult(this.#request, "INVALID_SOURCE", "SOURCE_TOO_LARGE"));
        }
        this.#status = "compiling";
        return new Promise((resolve) => {
            this.#resolve = resolve;
            this.launchCompiler();
        });
    }
    stop() {
        if (this.#status === "compiling") {
            this.finish(stoppedResult(this.#request));
            return;
        }
        if (this.#status === "running") {
            try {
                this.#downstream?.stop();
            }
            catch {
                this.finish(stoppedResult(this.#request));
            }
        }
    }
    dispose() {
        if (this.#status === "created") {
            this.#status = "disposed";
            return;
        }
        if (this.#status === "compiling") {
            this.finish(stoppedResult(this.#request));
            this.#status = "disposed";
            return;
        }
        if (this.#status === "running") {
            try {
                this.#downstream?.dispose();
            }
            catch { /* cleanup remains best effort */ }
            this.finish(stoppedResult(this.#request));
            this.#status = "disposed";
            return;
        }
        this.#status = "disposed";
    }
    launchCompiler() {
        try {
            const worker = this.#createCompilerWorker(this.#asset);
            this.#worker = worker;
            const requestId = ++this.#requestId;
            const onMessage = (event) => this.receive(event, requestId);
            const onWorkerError = () => {
                if (this.#status === "compiling")
                    this.finish(errorResult(this.#request, "HOST_UNAVAILABLE", "COMPILER_WORKER_UNAVAILABLE"));
            };
            this.#onMessage = onMessage;
            this.#onWorkerError = onWorkerError;
            worker.addEventListener("message", onMessage);
            worker.addEventListener("error", onWorkerError);
            this.#timer = this.#scheduler.set(() => {
                if (this.#status === "compiling")
                    this.finish(timeoutResult(this.#request));
            }, STUDY_TYPESCRIPT_COMPILE_TIMEOUT_MS);
            worker.postMessage({ kind: "compile", requestId, source: this.#request.source });
        }
        catch {
            this.finish(errorResult(this.#request, "HOST_UNAVAILABLE", "COMPILER_WORKER_UNAVAILABLE"));
        }
    }
    receive(event, requestId) {
        if (this.#status !== "compiling")
            return;
        const message = event !== null && typeof event === "object"
            && "data" in event ? event.data : event;
        if (!isCompilerMessage(message) || message.requestId !== requestId)
            return;
        if (message.kind === "ready")
            return;
        if (message.kind === "boot-error") {
            this.finish(errorResult(this.#request, "HOST_UNAVAILABLE", "COMPILER_WORKER_UNAVAILABLE"));
            return;
        }
        if (message.kind === "diagnostic") {
            this.finish(compileErrorResult(this.#request, messageCode(message) ?? "SOURCE_SYNTAX_INVALID"));
            return;
        }
        const compiled = messageCompiledCode(message);
        if (compiled === undefined
            || new TextEncoder().encode(compiled).byteLength > STUDY_TYPESCRIPT_MAX_COMPILED_BYTES) {
            this.finish(errorResult(this.#request, "INVALID_SOURCE", "COMPILED_OUTPUT_TOO_LARGE"));
            return;
        }
        this.cleanupCompiler();
        const { pythonEntry: _pythonEntry, ...requestWithoutEntry } = this.#request;
        const downstreamRequest = {
            ...requestWithoutEntry,
            language: "javascript",
            source: compiled,
        };
        try {
            this.#downstream = this.#base.createController(downstreamRequest, this.#observers);
            if (this.#status !== "compiling") {
                this.#downstream.dispose();
                return;
            }
            this.#status = "running";
            void this.#downstream.start().then((result) => {
                if (this.#status === "running")
                    this.finish(result);
            }, () => {
                if (this.#status === "running")
                    this.finish(errorResult(this.#request, "HOST_UNAVAILABLE", "RUNTIME_UNAVAILABLE"));
            });
        }
        catch {
            this.finish(errorResult(this.#request, "HOST_UNAVAILABLE", "RUNTIME_UNAVAILABLE"));
        }
    }
    cleanupCompiler() {
        const worker = this.#worker;
        this.#worker = undefined;
        const timer = this.#timer;
        this.#timer = undefined;
        if (timer !== undefined) {
            try {
                this.#scheduler.clear(timer);
            }
            catch { /* cleanup is best effort */ }
        }
        if (worker) {
            if (this.#onMessage) {
                try {
                    worker.removeEventListener("message", this.#onMessage);
                }
                catch { /* cleanup is best effort */ }
            }
            if (this.#onWorkerError) {
                try {
                    worker.removeEventListener("error", this.#onWorkerError);
                }
                catch { /* cleanup is best effort */ }
            }
            try {
                worker.terminate();
            }
            catch { /* cleanup is best effort */ }
        }
        this.#onMessage = undefined;
        this.#onWorkerError = undefined;
    }
    finish(result) {
        if (this.#status !== "compiling" && this.#status !== "running")
            return;
        const wasRunning = this.#status === "running";
        this.#status = "terminal";
        this.cleanupCompiler();
        if (wasRunning)
            this.#downstream = undefined;
        const resolve = this.#resolve;
        this.#resolve = undefined;
        resolve?.(Object.freeze(result));
    }
}
/**
 * Decorate the existing JS/Python factory.  Non-TypeScript requests pass
 * through untouched; only explicit `language: "typescript"` requests create
 * the compiler worker and then hand generated JavaScript to the base factory.
 */
export function createStudyTypeScriptExecutionAdapterFactory(options) {
    if (options === null || typeof options !== "object"
        || typeof options.base?.createController !== "function"
        || !validAsset(options.compilerAsset)) {
        throw new TypeError("The TypeScript execution adapter configuration is invalid.");
    }
    return Object.freeze({
        createController: (request, observers) => {
            if (request.language !== "typescript")
                return options.base.createController(request, observers);
            return new TypeScriptAdapterController(request, observers, options);
        },
    });
}
