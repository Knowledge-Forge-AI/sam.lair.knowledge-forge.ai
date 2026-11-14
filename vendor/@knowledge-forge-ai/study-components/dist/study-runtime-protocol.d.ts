/**
 * Versioned wire and caller contract for the separate-origin study runtime.
 *
 * This source deliberately does not create DOM nodes or load a runtime. The
 * host and frame implement the selected distinct-origin topology; this module
 * owns the bounded data contract and the parent-side wire readers.
 */
export declare const STUDY_RUNTIME_PROTOCOL: "study-runtime-v1";
export declare const STUDY_RUNTIME_FRAME_PATH: "/frame.html";
export declare const STUDY_RUNTIME_SANDBOX: "allow-scripts allow-same-origin";
export declare const STUDY_RUNTIME_ASSET_PATHS: Readonly<{
    readonly modulePath: "/pyodide/pyodide.mjs";
    readonly asmModulePath: "/pyodide/pyodide.asm.mjs";
    readonly wasmPath: "/pyodide/pyodide.asm.wasm";
    readonly stdlibPath: "/pyodide/python_stdlib.zip";
    readonly lockPath: "/pyodide/pyodide-lock.json";
}>;
export declare const STUDY_RUNTIME_LIMITS: Readonly<{
    readonly maxSourceBytes: number;
    readonly maxInputBytes: number;
    readonly maxOutputBytes: number;
    readonly maxInitMs: 45000;
    readonly maxProgramMs: 3000;
    readonly maxInputDepth: 32;
    readonly maxInputNodes: 4096;
    readonly maxInputKeyBytes: 256;
    readonly maxOutputDepth: 32;
    readonly maxOutputNodes: 8192;
}>;
export type StudyRuntimeLanguage = "javascript" | "python";
export type StudyRuntimeJsonValue = null | boolean | number | string | readonly StudyRuntimeJsonValue[] | {
    readonly [key: string]: StudyRuntimeJsonValue;
};
export type StudyRuntimeStream = "stdout" | "stderr";
export type StudyRuntimeProbePhase = "startup" | "init" | "program" | "terminal";
export type StudyRuntimeProbeCategory = "INIT_STARTED" | "INIT_OK" | "PROGRAM_STARTED" | "COMPLETED" | "STOPPED" | "OUTPUT_LIMIT" | "INVALID_SOURCE" | "INVALID_INPUT" | "INVALID_ENTRY" | "INIT_FAILED" | "RUNTIME_ERROR";
export type StudyRuntimeErrorCode = "PROTOCOL_ERROR" | "HOST_UNAVAILABLE" | "INIT_FAILED" | "RUNTIME_ERROR" | "INVALID_SOURCE" | "INVALID_INPUT" | "INVALID_ENTRY" | "OUTPUT_LIMIT";
export type StudyRuntimeUsageCode = "INVALID_CONFIGURATION" | "INVALID_SOURCE" | "INVALID_INPUT" | "INVALID_ENTRY" | "ALREADY_STARTED" | "DISPOSED";
export interface StudyRuntimeAssetConfig {
    readonly modulePath: typeof STUDY_RUNTIME_ASSET_PATHS.modulePath;
    readonly asmModulePath: typeof STUDY_RUNTIME_ASSET_PATHS.asmModulePath;
    readonly wasmPath: typeof STUDY_RUNTIME_ASSET_PATHS.wasmPath;
    readonly stdlibPath: typeof STUDY_RUNTIME_ASSET_PATHS.stdlibPath;
    readonly lockPath: typeof STUDY_RUNTIME_ASSET_PATHS.lockPath;
}
export interface StudyRuntimeLimits {
    readonly maxSourceBytes: number;
    readonly maxInputBytes: number;
    readonly maxOutputBytes: number;
    readonly maxInitMs: number;
    readonly maxProgramMs: number;
    readonly maxInputDepth: number;
    readonly maxInputNodes: number;
    readonly maxInputKeyBytes: number;
    readonly maxOutputDepth: number;
    readonly maxOutputNodes: number;
}
export interface StudyRuntimeWatchdog {
    readonly set: (callback: () => void, delayMs: number) => unknown;
    readonly clear: (handle: unknown) => void;
}
export interface StudyRuntimeHostPort {
    readonly send: (message: StudyRuntimeCommand) => void;
    readonly subscribe: (listener: (message: unknown) => void) => () => void;
    readonly close: () => void;
}
export interface StudyRuntimeHostJob {
    readonly port: StudyRuntimeHostPort;
    readonly dispose: () => void;
}
export interface StudyRuntimeHost {
    readonly parentOrigin: string;
    readonly runnerOrigin: string;
    readonly createJob: (runId: string) => StudyRuntimeHostJob;
}
export interface StudyRuntimeProbe {
    readonly phase: StudyRuntimeProbePhase;
    readonly category: StudyRuntimeProbeCategory;
    readonly terminal: boolean;
}
export interface StudyRuntimeOutput {
    readonly stream: StudyRuntimeStream;
    readonly text: string;
}
export interface StudyRuntimeControllerOptions {
    readonly language: StudyRuntimeLanguage;
    readonly source: string;
    readonly input: unknown;
    readonly entry?: string;
    readonly host: StudyRuntimeHost;
    readonly watchdog: StudyRuntimeWatchdog;
    readonly limits?: Partial<StudyRuntimeLimits>;
    readonly onProbe?: (probe: StudyRuntimeProbe) => void;
    readonly onOutput?: (output: StudyRuntimeOutput) => void;
}
export type StudyRuntimeOutcome = Readonly<{
    kind: "completed";
    value: StudyRuntimeJsonValue;
    stdout: string;
    stderr: string;
}> | Readonly<{
    kind: "stopped";
    stdout: string;
    stderr: string;
}> | Readonly<{
    kind: "timeout";
    phase: "initialization" | "program";
    stdout: string;
    stderr: string;
}> | Readonly<{
    kind: "error";
    code: StudyRuntimeErrorCode;
    stdout: string;
    stderr: string;
}>;
export interface StudyRuntimeController {
    readonly runId: string;
    readonly start: () => Promise<StudyRuntimeOutcome>;
    readonly stop: () => void;
    readonly dispose: () => void;
}
export interface StudyRuntimeRunCommand {
    readonly type: "run";
    readonly protocol: typeof STUDY_RUNTIME_PROTOCOL;
    readonly runId: string;
    readonly language: StudyRuntimeLanguage;
    readonly source: string;
    readonly inputJson: string;
    readonly entry?: string;
    readonly maxOutputBytes: number;
}
export interface StudyRuntimeStopCommand {
    readonly type: "stop";
    readonly protocol: typeof STUDY_RUNTIME_PROTOCOL;
    readonly runId: string;
}
export type StudyRuntimeCommand = StudyRuntimeRunCommand | StudyRuntimeStopCommand;
export type StudyRuntimeInboundMessage = Readonly<{
    kind: "probe";
    value: StudyRuntimeProbe;
}> | Readonly<{
    kind: "output";
    value: StudyRuntimeOutput;
}> | Readonly<{
    kind: "result";
    value: StudyRuntimeJsonValue;
}> | Readonly<{
    kind: "error";
    code: StudyRuntimeErrorCode;
}> | Readonly<{
    kind: "ignore";
}> | Readonly<{
    kind: "protocol";
}>;
export declare class StudyRuntimeUsageError extends TypeError {
    readonly code: StudyRuntimeUsageCode;
    constructor(code: StudyRuntimeUsageCode);
}
export declare function studyRuntimeBytes(value: string): number;
export declare function normalizeStudyRuntimeLimits(value: Partial<StudyRuntimeLimits> | undefined): StudyRuntimeLimits;
export declare function normalizeStudyRuntimeSource(value: unknown, limits: StudyRuntimeLimits): string;
export declare function normalizeStudyRuntimeEntry(value: unknown, language: StudyRuntimeLanguage): string | undefined;
export declare function normalizeStudyRuntimeInput(value: unknown, limits: StudyRuntimeLimits): {
    readonly value: StudyRuntimeJsonValue;
    readonly inputJson: string;
};
export declare function parseStudyRuntimeInbound(value: unknown, runId: string, limits: StudyRuntimeLimits): StudyRuntimeInboundMessage;
export declare function nextStudyRuntimeRunId(): string;
export declare function isStudyRuntimeAssetConfig(value: unknown): value is StudyRuntimeAssetConfig;
export declare function isStudyRuntimeOrigin(value: unknown): value is string;
/** Return the browser's serialized origin only for an allowed origin value. */
export declare function canonicalStudyRuntimeOrigin(value: unknown): string | undefined;
