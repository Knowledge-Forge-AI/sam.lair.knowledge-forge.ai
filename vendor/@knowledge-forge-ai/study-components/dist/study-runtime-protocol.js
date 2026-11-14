/**
 * Versioned wire and caller contract for the separate-origin study runtime.
 *
 * This source deliberately does not create DOM nodes or load a runtime. The
 * host and frame implement the selected distinct-origin topology; this module
 * owns the bounded data contract and the parent-side wire readers.
 */
export const STUDY_RUNTIME_PROTOCOL = "study-runtime-v1";
export const STUDY_RUNTIME_FRAME_PATH = "/frame.html";
export const STUDY_RUNTIME_SANDBOX = "allow-scripts allow-same-origin";
export const STUDY_RUNTIME_ASSET_PATHS = Object.freeze({
    modulePath: "/pyodide/pyodide.mjs",
    asmModulePath: "/pyodide/pyodide.asm.mjs",
    wasmPath: "/pyodide/pyodide.asm.wasm",
    stdlibPath: "/pyodide/python_stdlib.zip",
    lockPath: "/pyodide/pyodide-lock.json",
});
export const STUDY_RUNTIME_LIMITS = Object.freeze({
    maxSourceBytes: 64 * 1024,
    maxInputBytes: 64 * 1024,
    maxOutputBytes: 64 * 1024,
    maxInitMs: 45_000,
    maxProgramMs: 3_000,
    maxInputDepth: 32,
    maxInputNodes: 4_096,
    maxInputKeyBytes: 256,
    maxOutputDepth: 32,
    maxOutputNodes: 8_192,
});
export class StudyRuntimeUsageError extends TypeError {
    code;
    constructor(code) {
        super(`Study runtime usage is invalid: ${code}.`);
        this.name = "StudyRuntimeUsageError";
        this.code = code;
    }
}
const RESERVED_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const encoder = new TextEncoder();
let nextRunNumber = 0;
export function studyRuntimeBytes(value) {
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
        else if (code >= 0xdc00 && code <= 0xdfff)
            return true;
    }
    return false;
}
function plainRecord(value, allowReservedKeys = false) {
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
        if (typeof key !== "string" || (!allowReservedKeys && RESERVED_KEYS.has(key)))
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
    const keys = Object.keys(record);
    const expectedSet = new Set(expected);
    return keys.length === expected.length && keys.every((key) => expectedSet.has(key));
}
function normalizeJson(value, limits, depth, state) {
    if (depth > limits.maxInputDepth)
        throw new StudyRuntimeUsageError("INVALID_INPUT");
    state.nodes += 1;
    if (state.nodes > limits.maxInputNodes)
        throw new StudyRuntimeUsageError("INVALID_INPUT");
    if (value === null || typeof value === "boolean")
        return value;
    if (typeof value === "string") {
        if (hasLoneSurrogate(value) || studyRuntimeBytes(value) > limits.maxInputBytes) {
            throw new StudyRuntimeUsageError("INVALID_INPUT");
        }
        return value;
    }
    if (typeof value === "number") {
        if (!Number.isFinite(value))
            throw new StudyRuntimeUsageError("INVALID_INPUT");
        return Object.is(value, -0) ? 0 : value;
    }
    if (typeof value !== "object")
        throw new StudyRuntimeUsageError("INVALID_INPUT");
    const objectValue = value;
    if (state.seen.has(objectValue))
        throw new StudyRuntimeUsageError("INVALID_INPUT");
    state.seen.add(objectValue);
    try {
        if (Array.isArray(value)) {
            if (Object.getPrototypeOf(value) !== Array.prototype || Object.getOwnPropertySymbols(value).length > 0) {
                throw new StudyRuntimeUsageError("INVALID_INPUT");
            }
            const names = Object.getOwnPropertyNames(value);
            if (names.some((name) => name !== "length" && !/^(?:0|[1-9][0-9]*)$/u.test(name))) {
                throw new StudyRuntimeUsageError("INVALID_INPUT");
            }
            if (value.length > limits.maxInputNodes)
                throw new StudyRuntimeUsageError("INVALID_INPUT");
            const result = [];
            for (let index = 0; index < value.length; index += 1) {
                const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
                if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
                    throw new StudyRuntimeUsageError("INVALID_INPUT");
                }
                result.push(normalizeJson(descriptor.value, limits, depth + 1, state));
            }
            return Object.freeze(result);
        }
        const record = plainRecord(value);
        if (!record)
            throw new StudyRuntimeUsageError("INVALID_INPUT");
        const result = Object.create(null);
        for (const key of Object.keys(record).sort()) {
            if (studyRuntimeBytes(key) > limits.maxInputKeyBytes)
                throw new StudyRuntimeUsageError("INVALID_INPUT");
            result[key] = normalizeJson(dataField(record, key), limits, depth + 1, state);
        }
        return Object.freeze(result);
    }
    finally {
        state.seen.delete(objectValue);
    }
}
export function normalizeStudyRuntimeLimits(value) {
    const candidate = value === undefined ? undefined : plainRecord(value);
    if (value !== undefined && !candidate)
        throw new StudyRuntimeUsageError("INVALID_CONFIGURATION");
    const read = (key) => {
        const raw = candidate && Object.hasOwn(candidate, key) ? dataField(candidate, key) : undefined;
        return raw === undefined ? STUDY_RUNTIME_LIMITS[key] : typeof raw === "number" ? raw : Number.NaN;
    };
    const result = {
        maxSourceBytes: read("maxSourceBytes"),
        maxInputBytes: read("maxInputBytes"),
        maxOutputBytes: read("maxOutputBytes"),
        maxInitMs: read("maxInitMs"),
        maxProgramMs: read("maxProgramMs"),
        maxInputDepth: read("maxInputDepth"),
        maxInputNodes: read("maxInputNodes"),
        maxInputKeyBytes: read("maxInputKeyBytes"),
        maxOutputDepth: read("maxOutputDepth"),
        maxOutputNodes: read("maxOutputNodes"),
    };
    const allowed = new Set(Object.keys(STUDY_RUNTIME_LIMITS));
    if (candidate && Object.keys(candidate).some((key) => !allowed.has(key))) {
        throw new StudyRuntimeUsageError("INVALID_CONFIGURATION");
    }
    // Result node/depth bounds are part of the frame/parent wire contract. They
    // are deliberately fixed until a protocol version carries them explicitly;
    // accepting a lowered parent-only value would turn a well-formed worker
    // OUTPUT_LIMIT into a misleading PROTOCOL_ERROR.
    for (const key of ["maxOutputDepth", "maxOutputNodes"]) {
        if (candidate && Object.hasOwn(candidate, key)) {
            const provided = dataField(candidate, key);
            if (provided !== undefined && provided !== STUDY_RUNTIME_LIMITS[key]) {
                throw new StudyRuntimeUsageError("INVALID_CONFIGURATION");
            }
        }
    }
    for (const [key, maximum] of Object.entries(STUDY_RUNTIME_LIMITS)) {
        const candidateValue = result[key];
        if (!Number.isSafeInteger(candidateValue) || candidateValue < 1 || candidateValue > maximum) {
            throw new StudyRuntimeUsageError("INVALID_CONFIGURATION");
        }
    }
    return Object.freeze(result);
}
export function normalizeStudyRuntimeSource(value, limits) {
    if (typeof value !== "string" || value.trim().length === 0 || hasLoneSurrogate(value)
        || studyRuntimeBytes(value) > limits.maxSourceBytes) {
        throw new StudyRuntimeUsageError("INVALID_SOURCE");
    }
    for (const character of value) {
        const code = character.charCodeAt(0);
        if (code === 0 || (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d)
            || (code >= 0x7f && code <= 0x9f))
            throw new StudyRuntimeUsageError("INVALID_SOURCE");
    }
    return value;
}
export function normalizeStudyRuntimeEntry(value, language) {
    if (language === "javascript") {
        if (value !== undefined)
            throw new StudyRuntimeUsageError("INVALID_ENTRY");
        return undefined;
    }
    if (typeof value !== "string" || !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/u.test(value)
        || value.startsWith("__tfsb_"))
        throw new StudyRuntimeUsageError("INVALID_ENTRY");
    return value;
}
export function normalizeStudyRuntimeInput(value, limits) {
    const normalized = normalizeJson(value, limits, 0, { seen: new WeakSet(), nodes: 0 });
    let inputJson;
    try {
        inputJson = JSON.stringify(normalized);
    }
    catch {
        throw new StudyRuntimeUsageError("INVALID_INPUT");
    }
    if (typeof inputJson !== "string" || studyRuntimeBytes(inputJson) > limits.maxInputBytes) {
        throw new StudyRuntimeUsageError("INVALID_INPUT");
    }
    return Object.freeze({ value: normalized, inputJson });
}
function validJsonValue(value, limits, depth, state) {
    if (depth > limits.maxOutputDepth)
        return false;
    state.nodes += 1;
    if (state.nodes > limits.maxOutputNodes)
        return false;
    if (value === null || typeof value === "boolean")
        return true;
    if (typeof value === "string")
        return studyRuntimeBytes(value) <= limits.maxOutputBytes;
    if (typeof value === "number")
        return Number.isFinite(value);
    if (typeof value !== "object")
        return false;
    if (state.seen.has(value))
        return false;
    state.seen.add(value);
    try {
        if (Array.isArray(value)) {
            if (Object.getPrototypeOf(value) !== Array.prototype || Object.getOwnPropertySymbols(value).length > 0)
                return false;
            const names = Object.getOwnPropertyNames(value);
            if (names.some((name) => name !== "length" && !/^(?:0|[1-9][0-9]*)$/u.test(name)))
                return false;
            for (let index = 0; index < value.length; index += 1) {
                const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
                if (!descriptor || !descriptor.enumerable || !("value" in descriptor)
                    || !validJsonValue(descriptor.value, limits, depth + 1, state))
                    return false;
            }
            return true;
        }
        const record = plainRecord(value, true);
        if (!record)
            return false;
        for (const key of Object.keys(record)) {
            if (!validJsonValue(dataField(record, key), limits, depth + 1, state))
                return false;
        }
        return true;
    }
    finally {
        state.seen.delete(value);
    }
}
function validProtocol(value) {
    return value === STUDY_RUNTIME_PROTOCOL;
}
const PROBE_PHASES = new Set(["startup", "init", "program", "terminal"]);
const PROBE_CATEGORIES = new Set([
    "INIT_STARTED", "INIT_OK", "PROGRAM_STARTED", "COMPLETED", "STOPPED",
    "OUTPUT_LIMIT", "INVALID_SOURCE", "INVALID_INPUT", "INVALID_ENTRY", "INIT_FAILED", "RUNTIME_ERROR",
]);
const ERROR_CODES = new Set([
    "PROTOCOL_ERROR", "HOST_UNAVAILABLE", "INIT_FAILED", "RUNTIME_ERROR", "INVALID_SOURCE", "INVALID_INPUT", "INVALID_ENTRY", "OUTPUT_LIMIT",
]);
export function parseStudyRuntimeInbound(value, runId, limits) {
    const record = plainRecord(value);
    if (!record)
        return { kind: "ignore" };
    if (dataField(record, "runId") !== runId || !validProtocol(dataField(record, "protocol")))
        return { kind: "ignore" };
    const type = dataField(record, "type");
    if (type === "probe") {
        if (!exactFields(record, ["type", "protocol", "runId", "phase", "category", "terminal"]))
            return { kind: "protocol" };
        const phase = dataField(record, "phase");
        const category = dataField(record, "category");
        const terminal = dataField(record, "terminal");
        if (typeof phase !== "string" || !PROBE_PHASES.has(phase)
            || typeof category !== "string" || !PROBE_CATEGORIES.has(category)
            || typeof terminal !== "boolean")
            return { kind: "protocol" };
        return { kind: "probe", value: { phase: phase, category: category, terminal } };
    }
    if (type === "stdout" || type === "stderr") {
        if (!exactFields(record, ["type", "protocol", "runId", "text", "bytes"]))
            return { kind: "protocol" };
        const text = dataField(record, "text");
        const reportedBytes = dataField(record, "bytes");
        if (typeof text !== "string" || typeof reportedBytes !== "number" || !Number.isSafeInteger(reportedBytes)
            || reportedBytes < 0 || reportedBytes !== studyRuntimeBytes(text)
            || reportedBytes > limits.maxOutputBytes)
            return { kind: "protocol" };
        return { kind: "output", value: { stream: type, text } };
    }
    if (type === "result") {
        if (!exactFields(record, ["type", "protocol", "runId", "value"]))
            return { kind: "protocol" };
        const resultValue = dataField(record, "value");
        if (!validJsonValue(resultValue, limits, 0, { seen: new WeakSet(), nodes: 0 }))
            return { kind: "protocol" };
        try {
            const serialized = JSON.stringify(resultValue);
            if (typeof serialized !== "string" || studyRuntimeBytes(serialized) > limits.maxOutputBytes)
                return { kind: "protocol" };
        }
        catch {
            return { kind: "protocol" };
        }
        return { kind: "result", value: resultValue };
    }
    if (type === "error") {
        if (!exactFields(record, ["type", "protocol", "runId", "code"]))
            return { kind: "protocol" };
        const code = dataField(record, "code");
        return typeof code === "string" && ERROR_CODES.has(code)
            ? { kind: "error", code: code } : { kind: "protocol" };
    }
    return { kind: "protocol" };
}
export function nextStudyRuntimeRunId() {
    nextRunNumber += 1;
    return `${STUDY_RUNTIME_PROTOCOL}-${nextRunNumber}`;
}
export function isStudyRuntimeAssetConfig(value) {
    const record = plainRecord(value);
    if (!record || !exactFields(record, Object.keys(STUDY_RUNTIME_ASSET_PATHS)))
        return false;
    return Object.keys(STUDY_RUNTIME_ASSET_PATHS)
        .every((key) => dataField(record, key) === STUDY_RUNTIME_ASSET_PATHS[key]);
}
export function isStudyRuntimeOrigin(value) {
    return canonicalStudyRuntimeOrigin(value) === value;
}
/** Return the browser's serialized origin only for an allowed origin value. */
export function canonicalStudyRuntimeOrigin(value) {
    if (typeof value !== "string" || value.length > 256)
        return undefined;
    let parsed;
    try {
        parsed = new URL(value);
    }
    catch {
        return undefined;
    }
    if (parsed.username !== "" || parsed.password !== "" || parsed.pathname !== "/"
        || parsed.search !== "" || parsed.hash !== "")
        return undefined;
    if (parsed.protocol !== "https:"
        && !(parsed.protocol === "http:" && (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost"))) {
        return undefined;
    }
    return parsed.origin;
}
