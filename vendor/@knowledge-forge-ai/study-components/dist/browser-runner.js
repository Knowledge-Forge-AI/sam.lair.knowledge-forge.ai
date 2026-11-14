/**
 * Browser JavaScript boundary prototype.
 *
 * This file contains a pure parent-side controller and the trusted bootstrap
 * text that a browser adapter may install in an opaque-origin sandboxed frame.
 * It does not create DOM nodes itself and it does not claim browser security.
 */
export const STUDY_BROWSER_RUNNER_SCHEMA = "study-browser-runner-v1";
export const STUDY_BROWSER_RUNNER_SANDBOX = "allow-scripts";
export const STUDY_BROWSER_RUNNER_TARGET_ORIGIN = "*";
export const STUDY_BROWSER_RUNNER_CSP = "default-src 'none'; script-src 'unsafe-inline'; worker-src blob:; connect-src 'none'; child-src 'none'; frame-src 'none'; img-src 'none'; style-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
export const STUDY_BROWSER_RUNNER_LIMITS = Object.freeze({
    maxSourceBytes: 64 * 1024,
    maxInputBytes: 64 * 1024,
    maxOutputBytes: 64 * 1024,
    maxRunMs: 10_000,
    maxInputDepth: 16,
    maxInputNodes: 4_096,
    maxInputKeyBytes: 256,
});
const USAGE_MESSAGES = {
    INVALID_CONFIGURATION: "Study browser runner configuration is invalid.",
    INVALID_SOURCE: "Study browser runner source is invalid.",
    INVALID_INPUT: "Study browser runner input is invalid.",
    ALREADY_STARTED: "Study browser runner controllers are single-use.",
    DISPOSED: "Study browser runner controller is disposed.",
};
export class StudyBrowserRunnerUsageError extends TypeError {
    code;
    constructor(code) {
        super(USAGE_MESSAGES[code]);
        this.name = "StudyBrowserRunnerUsageError";
        this.code = code;
    }
}
const RESERVED_INPUT_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const encoder = new TextEncoder();
let nextRunNumber = 0;
function fail(code) {
    throw new StudyBrowserRunnerUsageError(code);
}
function bytes(value) {
    return encoder.encode(value).byteLength;
}
function hasLoneSurrogate(value) {
    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index);
        if (code >= 0xd800 && code <= 0xdbff) {
            const next = value.charCodeAt(index + 1);
            if (Number.isNaN(next) || next < 0xdc00 || next > 0xdfff)
                return true;
            index += 1;
        }
        else if (code >= 0xdc00 && code <= 0xdfff) {
            return true;
        }
    }
    return false;
}
function compareUtf8(left, right) {
    const leftBytes = encoder.encode(left);
    const rightBytes = encoder.encode(right);
    const length = Math.min(leftBytes.length, rightBytes.length);
    for (let index = 0; index < length; index += 1) {
        const delta = leftBytes[index] - rightBytes[index];
        if (delta !== 0)
            return delta;
    }
    return leftBytes.length - rightBytes.length;
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
        if (typeof key !== "string" || RESERVED_INPUT_KEYS.has(key))
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
    const expectedSet = new Set(expected);
    const names = Object.keys(record);
    return names.length === expected.length && names.every((name) => expectedSet.has(name));
}
function normalizeInput(value, limits, depth, state) {
    if (depth > limits.maxInputDepth)
        fail("INVALID_INPUT");
    state.nodes += 1;
    if (state.nodes > limits.maxInputNodes)
        fail("INVALID_INPUT");
    if (value === null || typeof value === "boolean")
        return value;
    if (typeof value === "string") {
        if (hasLoneSurrogate(value) || bytes(value) > limits.maxInputBytes)
            fail("INVALID_INPUT");
        return value;
    }
    if (typeof value === "number") {
        if (!Number.isFinite(value))
            fail("INVALID_INPUT");
        return Object.is(value, -0) ? 0 : value;
    }
    if (typeof value !== "object")
        fail("INVALID_INPUT");
    const objectValue = value;
    if (state.seen.has(objectValue))
        fail("INVALID_INPUT");
    state.seen.add(objectValue);
    try {
        if (Array.isArray(value)) {
            if (Object.getPrototypeOf(value) !== Array.prototype || Object.getOwnPropertySymbols(value).length !== 0)
                fail("INVALID_INPUT");
            if (value.length > limits.maxInputNodes)
                fail("INVALID_INPUT");
            const names = Object.getOwnPropertyNames(value);
            if (names.some((name) => name !== "length" && !/^(?:0|[1-9][0-9]*)$/u.test(name)))
                fail("INVALID_INPUT");
            const result = [];
            for (let index = 0; index < value.length; index += 1) {
                const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
                if (!descriptor || !descriptor.enumerable || !("value" in descriptor))
                    fail("INVALID_INPUT");
                result.push(normalizeInput(descriptor.value, limits, depth + 1, state));
            }
            return Object.freeze(result);
        }
        const record = plainRecord(value);
        if (!record)
            fail("INVALID_INPUT");
        const result = Object.create(null);
        for (const key of Object.keys(record).sort(compareUtf8)) {
            if (bytes(key) > limits.maxInputKeyBytes)
                fail("INVALID_INPUT");
            result[key] = normalizeInput(dataField(record, key), limits, depth + 1, state);
        }
        return Object.freeze(result);
    }
    finally {
        state.seen.delete(objectValue);
    }
}
function normalizeSource(value, maximum) {
    if (typeof value !== "string" || value.trim().length === 0 || bytes(value) > maximum || hasLoneSurrogate(value)) {
        fail("INVALID_SOURCE");
    }
    for (const character of value) {
        const code = character.charCodeAt(0);
        if (code === 0 || (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || (code >= 0x7f && code <= 0x9f)) {
            fail("INVALID_SOURCE");
        }
    }
    return value;
}
function normalizeLimits(value) {
    if (value !== undefined && !plainRecord(value))
        fail("INVALID_CONFIGURATION");
    const candidate = value;
    const readLimit = (key, fallback) => {
        const value = candidate && Object.hasOwn(candidate, key) ? dataField(candidate, key) : undefined;
        return value === undefined ? fallback : value;
    };
    const result = {
        maxSourceBytes: readLimit("maxSourceBytes", STUDY_BROWSER_RUNNER_LIMITS.maxSourceBytes),
        maxInputBytes: readLimit("maxInputBytes", STUDY_BROWSER_RUNNER_LIMITS.maxInputBytes),
        maxOutputBytes: readLimit("maxOutputBytes", STUDY_BROWSER_RUNNER_LIMITS.maxOutputBytes),
        maxRunMs: readLimit("maxRunMs", STUDY_BROWSER_RUNNER_LIMITS.maxRunMs),
        maxInputDepth: readLimit("maxInputDepth", STUDY_BROWSER_RUNNER_LIMITS.maxInputDepth),
        maxInputNodes: readLimit("maxInputNodes", STUDY_BROWSER_RUNNER_LIMITS.maxInputNodes),
        maxInputKeyBytes: readLimit("maxInputKeyBytes", STUDY_BROWSER_RUNNER_LIMITS.maxInputKeyBytes),
    };
    const allowed = new Set([
        "maxSourceBytes", "maxInputBytes", "maxOutputBytes", "maxRunMs",
        "maxInputDepth", "maxInputNodes", "maxInputKeyBytes",
    ]);
    if (candidate && Object.keys(candidate).some((key) => !allowed.has(key)))
        fail("INVALID_CONFIGURATION");
    const maxima = [
        [result.maxSourceBytes, STUDY_BROWSER_RUNNER_LIMITS.maxSourceBytes],
        [result.maxInputBytes, STUDY_BROWSER_RUNNER_LIMITS.maxInputBytes],
        [result.maxOutputBytes, STUDY_BROWSER_RUNNER_LIMITS.maxOutputBytes],
        [result.maxRunMs, STUDY_BROWSER_RUNNER_LIMITS.maxRunMs],
        [result.maxInputDepth, STUDY_BROWSER_RUNNER_LIMITS.maxInputDepth],
        [result.maxInputNodes, STUDY_BROWSER_RUNNER_LIMITS.maxInputNodes],
        [result.maxInputKeyBytes, STUDY_BROWSER_RUNNER_LIMITS.maxInputKeyBytes],
    ];
    if (maxima.some(([candidateValue, maximum]) => typeof candidateValue !== "number" || !Number.isSafeInteger(candidateValue) || candidateValue < 1 || candidateValue > maximum)) {
        fail("INVALID_CONFIGURATION");
    }
    return Object.freeze(result);
}
function nextRunId() {
    nextRunNumber += 1;
    return `${STUDY_BROWSER_RUNNER_SCHEMA}-${nextRunNumber}`;
}
function terminal(value) {
    return Object.freeze(value);
}
function readWireRecord(value) {
    return plainRecord(value);
}
function readInboundMessage(value, runId, maxOutputBytes) {
    const record = readWireRecord(value);
    if (!record)
        return { kind: "ignore" };
    const incomingRunId = dataField(record, "runId");
    if (incomingRunId !== runId)
        return { kind: "ignore" };
    const type = dataField(record, "type");
    if (type === "output") {
        if (!exactFields(record, ["type", "runId", "text"]))
            return { kind: "protocol" };
        const text = dataField(record, "text");
        if (typeof text !== "string" || hasLoneSurrogate(text))
            return { kind: "protocol" };
        if (bytes(text) > maxOutputBytes)
            return { kind: "error", code: "OUTPUT_LIMIT" };
        return { kind: "output", text };
    }
    if (type === "complete") {
        return exactFields(record, ["type", "runId"]) ? { kind: "complete" } : { kind: "protocol" };
    }
    if (type === "error") {
        if (!exactFields(record, ["type", "runId", "code"]))
            return { kind: "protocol" };
        const code = dataField(record, "code");
        if (code === "INVALID_ENTRY" || code === "OUTPUT_LIMIT" || code === "RUNTIME_ERROR") {
            return { kind: "error", code };
        }
        return { kind: "protocol" };
    }
    if (type === "host-error") {
        if (!exactFields(record, ["type", "runId", "code"]) || dataField(record, "code") !== "HOST_UNAVAILABLE") {
            return { kind: "protocol" };
        }
        return { kind: "error", code: "HOST_UNAVAILABLE" };
    }
    return { kind: "protocol" };
}
const WORKER_RUNTIME_PREFIX = String.raw `
"use strict";
self.onmessage = async function (event) {
  const message = event.data;
  if (message === null || typeof message !== "object" || message.type !== "start") return;
  const runId = message.runId;
  let outputBytes = 0;
  const print = function (text) {
    if (typeof text !== "string") throw new Error("invalid output");
    const size = new TextEncoder().encode(text).byteLength;
    if (outputBytes + size > message.maxOutputBytes) {
      const error = new Error("output limit");
      error.name = "StudyOutputLimit";
      throw error;
    }
    outputBytes += size;
    self.postMessage({ type: "output", runId, text });
  };
  try {
`;
const WORKER_RUNTIME_SUFFIX = String.raw `
    if (typeof __studyEntry !== "function") {
      self.postMessage({ type: "error", runId, code: "INVALID_ENTRY" });
      return;
    }
    await __studyEntry(message.input, print);
    self.postMessage({ type: "complete", runId });
  } catch (error) {
    self.postMessage({
      type: "error",
      runId,
      code: error && error.name === "StudyOutputLimit" ? "OUTPUT_LIMIT" : "RUNTIME_ERROR",
    });
  }
};
`;
/** Trusted constant frame bootstrap. It creates one fresh worker per start. */
export const STUDY_BROWSER_RUNNER_BOOTSTRAP = String.raw `
"use strict";
(function () {
  let boundSource = null;
  let boundRunId = null;
  let boundPort = null;
  let worker = null;
  let workerUrl = null;
  let boundMaxOutputBytes = null;
  const workerPrefix = ${JSON.stringify(WORKER_RUNTIME_PREFIX)};
  const workerSuffix = ${JSON.stringify(WORKER_RUNTIME_SUFFIX)};
  function disposeWorker() {
    if (worker !== null) worker.terminate();
    if (workerUrl !== null) URL.revokeObjectURL(workerUrl);
    worker = null;
    workerUrl = null;
    boundMaxOutputBytes = null;
  }
  function send(message) {
    if (boundPort !== null) boundPort.postMessage(message);
  }
  function bind(event) {
    if (event.source !== parent || event.ports.length !== 1 || boundPort !== null) return;
    boundSource = event.source;
    boundRunId = event.data && event.data.runId;
    if (typeof boundRunId !== "string") return;
    boundPort = event.ports[0];
    boundPort.onmessage = function (portEvent) {
      const message = portEvent.data;
      if (!message || message.runId !== boundRunId) return;
      if (message.type === "stop") {
        disposeWorker();
        return;
      }
      if (message.type !== "start" || worker !== null || typeof message.source !== "string") return;
      try {
        if (typeof message.maxOutputBytes !== "number" || !Number.isSafeInteger(message.maxOutputBytes) || message.maxOutputBytes < 1) return;
        boundMaxOutputBytes = message.maxOutputBytes;
        const workerCode = workerPrefix + "\nconst __studyEntry = (\n" + message.source + "\n);\n" + workerSuffix;
        const blob = new Blob([workerCode], { type: "text/javascript" });
        workerUrl = URL.createObjectURL(blob);
        worker = new Worker(workerUrl);
        worker.onmessage = function (workerEvent) {
          const workerMessage = workerEvent.data;
          if (!workerMessage || workerMessage.runId !== boundRunId) return;
          if (workerMessage.type === "output") {
            if (typeof workerMessage.text !== "string" || boundMaxOutputBytes === null
              || new TextEncoder().encode(workerMessage.text).byteLength > boundMaxOutputBytes) return;
            send(workerMessage);
            return;
          }
          if (workerMessage.type === "complete" || workerMessage.type === "error") send(workerMessage);
        };
        worker.onerror = function () {
          send({ type: "error", runId: boundRunId, code: "RUNTIME_ERROR" });
          disposeWorker();
        };
        worker.postMessage(message);
      } catch {
        disposeWorker();
        send({ type: "host-error", runId: boundRunId, code: "HOST_UNAVAILABLE" });
      }
    };
    boundPort.start();
    boundPort.postMessage({ type: "ready", runId: boundRunId });
  }
  addEventListener("message", function (event) {
    if (boundSource !== null && event.source !== boundSource) return;
    if (event.data && event.data.type === "bind") bind(event);
  });
})();
`;
class Controller {
    runId;
    #limits;
    #state;
    #host;
    constructor(options) {
        const host = options?.host;
        const watchdog = options?.watchdog;
        let limits;
        let source;
        let input;
        const onOutput = options?.onOutput;
        try {
            limits = normalizeLimits(options?.limits);
            source = normalizeSource(options?.source, limits.maxSourceBytes);
            input = normalizeInput(options?.input, limits, 0, { seen: new WeakSet(), nodes: 0 });
        }
        catch (error) {
            if (error instanceof StudyBrowserRunnerUsageError)
                throw error;
            fail("INVALID_INPUT");
        }
        let inputBytes;
        try {
            inputBytes = bytes(JSON.stringify(input));
        }
        catch {
            fail("INVALID_INPUT");
        }
        if (inputBytes > limits.maxInputBytes || typeof host?.createSandboxJob !== "function"
            || typeof watchdog?.set !== "function" || typeof watchdog?.clear !== "function"
            || (onOutput !== undefined && typeof onOutput !== "function")) {
            fail(inputBytes > limits.maxInputBytes ? "INVALID_INPUT" : "INVALID_CONFIGURATION");
        }
        this.runId = nextRunId();
        this.#limits = limits;
        this.#host = host;
        this.#state = {
            status: "created",
            source,
            input,
            job: undefined,
            unsubscribe: undefined,
            timer: undefined,
            resolve: undefined,
            watchdog,
            output: "",
            outputBytes: 0,
            onOutput,
        };
    }
    start() {
        const state = this.#state;
        if (state.status === "disposed")
            fail("DISPOSED");
        if (state.status === "stopped") {
            state.status = "terminal";
            return Promise.resolve(terminal({ kind: "stopped" }));
        }
        if (state.status !== "created")
            fail("ALREADY_STARTED");
        state.status = "running";
        return new Promise((resolve) => {
            state.resolve = resolve;
            this.launch();
        });
    }
    stop() {
        const state = this.#state;
        if (state.status === "created") {
            state.status = "stopped";
            state.source = undefined;
            state.input = undefined;
            state.onOutput = undefined;
            state.watchdog = undefined;
            this.#host = undefined;
            return;
        }
        if (state.status === "running")
            this.finish(terminal({ kind: "stopped" }));
    }
    dispose() {
        const state = this.#state;
        if (state.status === "running")
            this.finish(terminal({ kind: "stopped" }));
        if (state.status === "disposed")
            return;
        state.status = "disposed";
        state.source = undefined;
        state.input = undefined;
        state.onOutput = undefined;
        state.watchdog = undefined;
        state.job = undefined;
        state.unsubscribe = undefined;
        this.#host = undefined;
    }
    launch() {
        const state = this.#state;
        const host = this.#host;
        const watchdog = state.watchdog;
        if (!host || !watchdog || !state.source || state.input === undefined) {
            this.finish(terminal({ kind: "error", code: "HOST_UNAVAILABLE" }));
            return;
        }
        try {
            const job = host.createSandboxJob({
                schema: STUDY_BROWSER_RUNNER_SCHEMA,
                runId: this.runId,
                sandbox: STUDY_BROWSER_RUNNER_SANDBOX,
                targetOrigin: STUDY_BROWSER_RUNNER_TARGET_ORIGIN,
                csp: STUDY_BROWSER_RUNNER_CSP,
                bootstrap: STUDY_BROWSER_RUNNER_BOOTSTRAP,
                workerPerJob: true,
            });
            if (!job || !job.port || typeof job.port.send !== "function" || typeof job.port.subscribe !== "function"
                || typeof job.port.close !== "function" || typeof job.dispose !== "function") {
                throw new Error("invalid host");
            }
            state.job = job;
            const unsubscribe = job.port.subscribe((message) => this.receive(message));
            if (typeof unsubscribe !== "function")
                throw new Error("unsubscribe handle missing");
            state.unsubscribe = unsubscribe;
            const timer = watchdog.set(() => this.finish(terminal({ kind: "timeout" })), this.#limits.maxRunMs);
            if (timer === undefined)
                throw new Error("watchdog handle missing");
            if (state.status === "running") {
                state.timer = timer;
            }
            else {
                watchdog.clear(timer);
            }
            if (state.status !== "running")
                return;
            job.port.send({
                type: "start",
                runId: this.runId,
                source: state.source,
                input: state.input,
                maxOutputBytes: this.#limits.maxOutputBytes,
            });
        }
        catch {
            this.finish(terminal({ kind: "error", code: "HOST_UNAVAILABLE" }));
        }
    }
    receive(message) {
        const state = this.#state;
        if (state.status !== "running")
            return;
        const event = readInboundMessage(message, this.runId, this.#limits.maxOutputBytes);
        if (event.kind === "ignore")
            return;
        if (event.kind === "protocol") {
            this.finish(terminal({ kind: "error", code: "PROTOCOL_ERROR" }));
            return;
        }
        if (event.kind === "output") {
            const nextBytes = state.outputBytes + bytes(event.text);
            if (nextBytes > this.#limits.maxOutputBytes) {
                this.finish(terminal({ kind: "error", code: "OUTPUT_LIMIT" }));
                return;
            }
            state.output += event.text;
            state.outputBytes = nextBytes;
            const onOutput = state.onOutput;
            if (onOutput) {
                try {
                    onOutput(event.text);
                }
                catch { /* parent sink cannot alter runner state */ }
            }
            return;
        }
        if (event.kind === "complete") {
            this.finish(terminal({ kind: "completed", output: state.output }));
            return;
        }
        this.finish(terminal({ kind: "error", code: event.code }));
    }
    finish(outcome) {
        const state = this.#state;
        if (state.status !== "running")
            return;
        state.status = "terminal";
        const job = state.job;
        const unsubscribe = state.unsubscribe;
        const watchdog = state.watchdog;
        const timer = state.timer;
        state.job = undefined;
        state.unsubscribe = undefined;
        state.watchdog = undefined;
        state.timer = undefined;
        state.source = undefined;
        state.input = undefined;
        state.onOutput = undefined;
        this.#host = undefined;
        state.output = "";
        state.outputBytes = 0;
        try {
            unsubscribe?.();
        }
        catch { /* cleanup is best effort */ }
        if (watchdog && timer !== undefined) {
            try {
                watchdog.clear(timer);
            }
            catch { /* cleanup is best effort */ }
        }
        if (job) {
            try {
                job.port.send({ type: "stop", runId: this.runId });
            }
            catch { /* terminal */ }
            try {
                job.port.close();
            }
            catch { /* terminal */ }
            try {
                job.dispose();
            }
            catch { /* terminal */ }
        }
        const resolve = state.resolve;
        state.resolve = undefined;
        resolve?.(outcome);
    }
}
export function createStudyBrowserRunnerController(options) {
    return new Controller(options);
}
