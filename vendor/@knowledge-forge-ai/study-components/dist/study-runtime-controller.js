import { normalizeStudyRuntimeEntry, normalizeStudyRuntimeInput, normalizeStudyRuntimeLimits, normalizeStudyRuntimeSource, nextStudyRuntimeRunId, parseStudyRuntimeInbound, STUDY_RUNTIME_LIMITS, } from "./study-runtime-protocol.js";
function terminalOutcome(outcome) {
    return Object.freeze(outcome);
}
function emptyOutput(state) {
    return { stdout: state.stdout, stderr: state.stderr };
}
function errorOutcome(state, code) {
    return terminalOutcome({ kind: "error", code, ...emptyOutput(state) });
}
function isSafeCallback(value) {
    return typeof value === "function";
}
class Controller {
    runId;
    #limits;
    #language;
    #source;
    #inputJson;
    #entry;
    #host;
    #watchdog;
    #onProbe;
    #onOutput;
    #state;
    constructor(options) {
        if (!options || typeof options !== "object")
            throw new TypeError("Study runtime options are invalid.");
        const limits = normalizeStudyRuntimeLimits(options.limits);
        let source;
        let entry;
        let normalizedInput;
        try {
            source = normalizeStudyRuntimeSource(options.source, limits);
            entry = normalizeStudyRuntimeEntry(options.entry, options.language);
            normalizedInput = normalizeStudyRuntimeInput(options.input, limits);
        }
        catch (error) {
            if (error instanceof TypeError)
                throw error;
            throw new TypeError("Study runtime source, entry, or input is invalid.");
        }
        if ((options.language !== "javascript" && options.language !== "python")
            || !options.host || typeof options.host.createJob !== "function"
            || !options.watchdog || !isSafeCallback(options.watchdog.set) || !isSafeCallback(options.watchdog.clear)
            || (options.onProbe !== undefined && !isSafeCallback(options.onProbe))
            || (options.onOutput !== undefined && !isSafeCallback(options.onOutput))) {
            throw new TypeError("Study runtime configuration is invalid.");
        }
        this.runId = nextStudyRuntimeRunId();
        this.#limits = limits;
        this.#language = options.language;
        this.#source = source;
        this.#inputJson = normalizedInput.inputJson;
        this.#entry = entry;
        this.#host = options.host;
        this.#watchdog = options.watchdog;
        this.#onProbe = options.onProbe;
        this.#onOutput = options.onOutput;
        this.#state = {
            status: "created",
            job: undefined,
            unsubscribe: undefined,
            initTimer: undefined,
            programTimer: undefined,
            resolve: undefined,
            result: undefined,
            resultReceived: false,
            stdout: "",
            stderr: "",
            stdoutBytes: 0,
            stderrBytes: 0,
        };
    }
    start() {
        const state = this.#state;
        if (state.status === "disposed")
            throw new TypeError("Study runtime controller is disposed.");
        if (state.status !== "created")
            throw new TypeError("Study runtime controllers are single-use.");
        state.status = "running";
        return new Promise((resolve) => {
            state.resolve = resolve;
            this.launch();
        });
    }
    stop() {
        const state = this.#state;
        if (state.status === "created") {
            state.status = "terminal";
            state.resolve = undefined;
            return;
        }
        if (state.status === "running")
            this.finish(terminalOutcome({ kind: "stopped", ...emptyOutput(state) }));
    }
    dispose() {
        const state = this.#state;
        if (state.status === "running")
            this.finish(terminalOutcome({ kind: "stopped", ...emptyOutput(state) }));
        if (state.status === "disposed")
            return;
        state.status = "disposed";
        state.job = undefined;
        state.unsubscribe = undefined;
        state.resolve = undefined;
        state.result = undefined;
    }
    launch() {
        const state = this.#state;
        try {
            const job = this.#host.createJob(this.runId);
            if (!job || !job.port || typeof job.port.send !== "function"
                || typeof job.port.subscribe !== "function" || typeof job.port.close !== "function"
                || typeof job.dispose !== "function")
                throw new TypeError("invalid runtime host job");
            state.job = job;
            const unsubscribe = job.port.subscribe((message) => this.receive(message));
            if (typeof unsubscribe !== "function")
                throw new TypeError("invalid runtime subscription");
            state.unsubscribe = unsubscribe;
            const initTimer = this.#watchdog.set(() => {
                this.finish(terminalOutcome({ kind: "timeout", phase: "initialization", ...emptyOutput(state) }));
            }, this.#limits.maxInitMs);
            if (initTimer === undefined)
                throw new TypeError("missing initialization watchdog");
            state.initTimer = initTimer;
            const command = this.#entry === undefined
                ? {
                    type: "run",
                    protocol: "study-runtime-v1",
                    runId: this.runId,
                    language: this.#language,
                    source: this.#source,
                    inputJson: this.#inputJson,
                    maxOutputBytes: this.#limits.maxOutputBytes,
                }
                : {
                    type: "run",
                    protocol: "study-runtime-v1",
                    runId: this.runId,
                    language: this.#language,
                    source: this.#source,
                    inputJson: this.#inputJson,
                    entry: this.#entry,
                    maxOutputBytes: this.#limits.maxOutputBytes,
                };
            job.port.send(command);
        }
        catch {
            this.finish(errorOutcome(state, "HOST_UNAVAILABLE"));
        }
    }
    receive(message) {
        const state = this.#state;
        if (state.status !== "running")
            return;
        const inbound = parseStudyRuntimeInbound(message, this.runId, this.#limits);
        if (inbound.kind === "ignore")
            return;
        if (inbound.kind === "protocol") {
            this.finish(errorOutcome(state, "PROTOCOL_ERROR"));
            return;
        }
        if (inbound.kind === "probe") {
            this.notifyProbe(inbound.value);
            this.handleProbe(inbound.value.category);
            return;
        }
        if (inbound.kind === "output") {
            this.appendOutput(inbound.value);
            return;
        }
        if (inbound.kind === "result") {
            if (state.resultReceived) {
                this.finish(errorOutcome(state, "PROTOCOL_ERROR"));
                return;
            }
            state.resultReceived = true;
            state.result = inbound.value;
            return;
        }
        this.finish(errorOutcome(state, inbound.code));
    }
    notifyProbe(probe) {
        try {
            this.#onProbe?.(probe);
        }
        catch { /* caller observation cannot alter runtime state */ }
    }
    handleProbe(category) {
        const state = this.#state;
        if (category === "INIT_OK") {
            return;
        }
        if (category === "PROGRAM_STARTED") {
            this.clearTimer("initTimer");
            if (state.programTimer === undefined) {
                try {
                    state.programTimer = this.#watchdog.set(() => {
                        this.finish(terminalOutcome({ kind: "timeout", phase: "program", ...emptyOutput(state) }));
                    }, this.#limits.maxProgramMs);
                }
                catch {
                    this.finish(errorOutcome(state, "HOST_UNAVAILABLE"));
                    return;
                }
                if (state.programTimer === undefined)
                    this.finish(errorOutcome(state, "HOST_UNAVAILABLE"));
            }
            return;
        }
        if (category === "COMPLETED") {
            const result = state.result;
            if (!state.resultReceived || result === undefined) {
                this.finish(errorOutcome(state, "PROTOCOL_ERROR"));
                return;
            }
            this.finish(terminalOutcome({ kind: "completed", value: result, ...emptyOutput(state) }));
            return;
        }
        if (category === "STOPPED") {
            this.finish(terminalOutcome({ kind: "stopped", ...emptyOutput(state) }));
            return;
        }
        if (category === "OUTPUT_LIMIT") {
            this.finish(errorOutcome(state, "OUTPUT_LIMIT"));
            return;
        }
        if (category === "INVALID_SOURCE") {
            this.finish(errorOutcome(state, "INVALID_SOURCE"));
            return;
        }
        if (category === "INVALID_INPUT") {
            this.finish(errorOutcome(state, "INVALID_INPUT"));
            return;
        }
        if (category === "INVALID_ENTRY") {
            this.finish(errorOutcome(state, "INVALID_ENTRY"));
            return;
        }
        if (category === "INIT_FAILED") {
            this.finish(errorOutcome(state, "INIT_FAILED"));
            return;
        }
        if (category === "RUNTIME_ERROR")
            this.finish(errorOutcome(state, "RUNTIME_ERROR"));
    }
    appendOutput(output) {
        const state = this.#state;
        const bytes = new TextEncoder().encode(output.text).byteLength;
        if (state.stdoutBytes + state.stderrBytes + bytes > this.#limits.maxOutputBytes) {
            this.finish(errorOutcome(state, "OUTPUT_LIMIT"));
            return;
        }
        if (output.stream === "stdout") {
            state.stdoutBytes += bytes;
            if (state.stdoutBytes > this.#limits.maxOutputBytes) {
                this.finish(errorOutcome(state, "OUTPUT_LIMIT"));
                return;
            }
            state.stdout += output.text;
        }
        else {
            state.stderrBytes += bytes;
            if (state.stderrBytes > this.#limits.maxOutputBytes) {
                this.finish(errorOutcome(state, "OUTPUT_LIMIT"));
                return;
            }
            state.stderr += output.text;
        }
        try {
            this.#onOutput?.(output);
        }
        catch { /* caller observation cannot alter runtime state */ }
    }
    clearTimer(name) {
        const state = this.#state;
        const timer = state[name];
        if (timer === undefined)
            return;
        try {
            this.#watchdog.clear(timer);
        }
        catch { /* cleanup is best effort */ }
        state[name] = undefined;
    }
    finish(outcome) {
        const state = this.#state;
        if (state.status !== "running")
            return;
        state.status = "terminal";
        this.clearTimer("initTimer");
        this.clearTimer("programTimer");
        const unsubscribe = state.unsubscribe;
        const job = state.job;
        state.unsubscribe = undefined;
        state.job = undefined;
        try {
            unsubscribe?.();
        }
        catch { /* cleanup is best effort */ }
        if (job) {
            try {
                job.port.send({ type: "stop", protocol: "study-runtime-v1", runId: this.runId });
            }
            catch { /* local cleanup */ }
            try {
                job.port.close();
            }
            catch { /* local cleanup */ }
            try {
                job.dispose();
            }
            catch { /* local cleanup */ }
        }
        const resolve = state.resolve;
        state.resolve = undefined;
        resolve?.(outcome);
    }
}
export function createStudyRuntimeController(options) {
    return new Controller(options);
}
export const STUDY_RUNTIME_CONTROLLER_DEFAULTS = Object.freeze({
    maxInitMs: STUDY_RUNTIME_LIMITS.maxInitMs,
    maxProgramMs: STUDY_RUNTIME_LIMITS.maxProgramMs,
});
