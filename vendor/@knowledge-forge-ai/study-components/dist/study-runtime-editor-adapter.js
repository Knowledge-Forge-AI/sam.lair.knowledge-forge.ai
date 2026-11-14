const SAFE_ERROR_CODES = new Set([
    "PROTOCOL_ERROR",
    "HOST_UNAVAILABLE",
    "INIT_FAILED",
    "RUNTIME_ERROR",
    "INVALID_SOURCE",
    "INVALID_INPUT",
    "INVALID_ENTRY",
    "OUTPUT_LIMIT",
    "INVALID_CONFIGURATION",
]);
function defaultRuntimeLoader() {
    return Promise.all([
        import("./study-runtime-controller.js"),
        import("./separate-origin-runtime-host.js"),
    ]).then(([controller, host]) => ({
        createStudyRuntimeController: controller.createStudyRuntimeController,
        createSeparateOriginRuntimeHost: host.createSeparateOriginRuntimeHost,
        createSeparateOriginRuntimeWatchdog: host.createSeparateOriginRuntimeWatchdog,
    }));
}
function safeErrorCode(error) {
    if (error !== null && typeof error === "object") {
        const candidate = error.code;
        if (typeof candidate === "string" && SAFE_ERROR_CODES.has(candidate)) {
            return candidate;
        }
    }
    return "HOST_UNAVAILABLE";
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
function mapOutcome(request, outcome) {
    const metadata = emptyResult(request);
    if (outcome.kind === "completed") {
        return Object.freeze({ ...metadata, kind: "completed", value: outcome.value, stdout: outcome.stdout, stderr: outcome.stderr });
    }
    if (outcome.kind === "stopped") {
        return Object.freeze({ ...metadata, kind: "stopped", stdout: outcome.stdout, stderr: outcome.stderr });
    }
    if (outcome.kind === "timeout") {
        return Object.freeze({ ...metadata, kind: "timeout", phase: outcome.phase, stdout: outcome.stdout, stderr: outcome.stderr });
    }
    return Object.freeze({ ...metadata, kind: "error", code: outcome.code, stdout: outcome.stdout, stderr: outcome.stderr });
}
function invalidResult(request, error) {
    return Object.freeze({ kind: "error", code: safeErrorCode(error), ...emptyResult(request) });
}
class AdapterController {
    #request;
    #observers;
    #options;
    #loadRuntime;
    #status = "created";
    #runtimeController;
    #resolve;
    constructor(request, observers, options, loadRuntime) {
        this.#request = request;
        this.#observers = observers;
        this.#options = options;
        this.#loadRuntime = loadRuntime;
    }
    start() {
        if (this.#status !== "created")
            throw new TypeError("Study editor execution controllers are single-use.");
        const preflightCode = this.preflightCode();
        if (preflightCode !== undefined) {
            this.#status = "terminal";
            return Promise.resolve(Object.freeze({ kind: "error", code: preflightCode, ...emptyResult(this.#request) }));
        }
        this.#status = "loading";
        return new Promise((resolve) => {
            this.#resolve = resolve;
            void this.launch();
        });
    }
    stop() {
        if (this.#status === "loading") {
            this.finish({ kind: "stopped", ...emptyResult(this.#request) });
            return;
        }
        if (this.#status === "running") {
            try {
                this.#runtimeController?.stop();
            }
            catch {
                this.finish({ kind: "stopped", ...emptyResult(this.#request) });
            }
        }
    }
    dispose() {
        if (this.#status === "created") {
            this.#status = "disposed";
            return;
        }
        if (this.#status === "loading") {
            this.finish({ kind: "stopped", ...emptyResult(this.#request) });
            this.#status = "disposed";
            return;
        }
        if (this.#status === "running") {
            try {
                this.#runtimeController?.dispose();
            }
            catch {
                this.finish({ kind: "stopped", ...emptyResult(this.#request) });
            }
            return;
        }
        this.#status = "disposed";
    }
    async launch() {
        try {
            const runtime = await this.#loadRuntime();
            if (this.#status !== "loading")
                return;
            const hostOptions = this.#options.parentOrigin === undefined
                ? { runnerOrigin: this.#options.runnerOrigin, ...(this.#options.assets === undefined ? {} : { assets: this.#options.assets }) }
                : {
                    runnerOrigin: this.#options.runnerOrigin,
                    parentOrigin: this.#options.parentOrigin,
                    ...(this.#options.assets === undefined ? {} : { assets: this.#options.assets }),
                };
            const host = runtime.createSeparateOriginRuntimeHost(hostOptions);
            if (this.#status !== "loading")
                return;
            const watchdog = runtime.createSeparateOriginRuntimeWatchdog();
            if (this.#status !== "loading")
                return;
            if (this.#request.language === "typescript") {
                this.finish(invalidResult(this.#request, { code: "INVALID_CONFIGURATION" }));
                return;
            }
            const controllerOptions = {
                language: this.#request.language,
                source: this.#request.source,
                input: this.#request.input,
                host,
                watchdog,
                ...(this.#request.pythonEntry === undefined ? {} : { entry: this.#request.pythonEntry.entry }),
                ...(this.#options.limits === undefined ? {} : { limits: this.#options.limits }),
                ...(this.#observers?.onProbe === undefined ? {} : { onProbe: this.#observers.onProbe }),
                ...(this.#observers?.onOutput === undefined ? {} : { onOutput: this.#observers.onOutput }),
            };
            const controller = runtime.createStudyRuntimeController(controllerOptions);
            if (this.#status !== "loading") {
                controller.dispose();
                return;
            }
            this.#runtimeController = controller;
            this.#status = "running";
            const outcome = await controller.start();
            if (this.#status === "running")
                this.finish(mapOutcome(this.#request, outcome));
        }
        catch (error) {
            if (this.#status === "loading" || this.#status === "running")
                this.finish(invalidResult(this.#request, error));
        }
    }
    preflightCode() {
        if (this.#request.language === "javascript" && this.#request.pythonEntry !== undefined)
            return "INVALID_ENTRY";
        if (this.#request.language === "typescript")
            return "INVALID_CONFIGURATION";
        if (this.#request.language === "python") {
            const entry = this.#request.pythonEntry?.entry;
            if (typeof entry !== "string" || !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/u.test(entry)
                || entry.startsWith("__tfsb_"))
                return "INVALID_ENTRY";
        }
        return undefined;
    }
    finish(result) {
        if (this.#status !== "loading" && this.#status !== "running")
            return;
        this.#status = "terminal";
        this.#runtimeController = undefined;
        const resolve = this.#resolve;
        this.#resolve = undefined;
        resolve?.(Object.freeze(result));
    }
}
/**
 * Create a reusable factory without touching DOM, browser globals, or runtime
 * modules. Host/watchdog construction is deferred until each controller's
 * start, and is skipped if Stop/dispose wins the lazy-load race.
 */
export function createStudyRuntimeEditorAdapterFactory(options) {
    const loadRuntime = options.loadRuntime ?? defaultRuntimeLoader;
    return Object.freeze({
        createController: (request, observers) => new AdapterController(request, observers, options, loadRuntime),
    });
}
