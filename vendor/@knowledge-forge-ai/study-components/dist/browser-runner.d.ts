/**
 * Browser JavaScript boundary prototype.
 *
 * This file contains a pure parent-side controller and the trusted bootstrap
 * text that a browser adapter may install in an opaque-origin sandboxed frame.
 * It does not create DOM nodes itself and it does not claim browser security.
 */
export declare const STUDY_BROWSER_RUNNER_SCHEMA: "study-browser-runner-v1";
export declare const STUDY_BROWSER_RUNNER_SANDBOX: "allow-scripts";
export declare const STUDY_BROWSER_RUNNER_TARGET_ORIGIN: "*";
export declare const STUDY_BROWSER_RUNNER_CSP: "default-src 'none'; script-src 'unsafe-inline'; worker-src blob:; connect-src 'none'; child-src 'none'; frame-src 'none'; img-src 'none'; style-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
export declare const STUDY_BROWSER_RUNNER_LIMITS: Readonly<{
    maxSourceBytes: number;
    maxInputBytes: number;
    maxOutputBytes: number;
    maxRunMs: 10000;
    maxInputDepth: 16;
    maxInputNodes: 4096;
    maxInputKeyBytes: 256;
}>;
export type StudyBrowserRunnerJsonValue = null | boolean | number | string | readonly StudyBrowserRunnerJsonValue[] | {
    readonly [key: string]: StudyBrowserRunnerJsonValue;
};
export type StudyBrowserRunnerPrint = (text: string) => void;
export type StudyBrowserRunnerEntry = (input: StudyBrowserRunnerJsonValue, print: StudyBrowserRunnerPrint) => unknown | PromiseLike<unknown>;
export interface StudyBrowserRunnerLimits {
    readonly maxSourceBytes: number;
    readonly maxInputBytes: number;
    readonly maxOutputBytes: number;
    readonly maxRunMs: number;
    readonly maxInputDepth: number;
    readonly maxInputNodes: number;
    readonly maxInputKeyBytes: number;
}
export interface StudyBrowserRunnerWatchdog {
    readonly set: (callback: () => void, delayMs: number) => unknown;
    readonly clear: (handle: unknown) => void;
}
/** A parent-side wrapper around a real MessagePort. */
export interface StudyBrowserRunnerPort {
    readonly send: (message: StudyBrowserRunnerCommand) => void;
    readonly subscribe: (listener: (message: unknown) => void) => () => void;
    readonly close: () => void;
}
export interface StudyBrowserRunnerSandboxOptions {
    readonly schema: typeof STUDY_BROWSER_RUNNER_SCHEMA;
    readonly runId: string;
    readonly sandbox: typeof STUDY_BROWSER_RUNNER_SANDBOX;
    readonly targetOrigin: typeof STUDY_BROWSER_RUNNER_TARGET_ORIGIN;
    readonly csp: typeof STUDY_BROWSER_RUNNER_CSP;
    readonly bootstrap: string;
    readonly workerPerJob: true;
}
/** A host adapter owns the actual iframe, MessageChannel, Worker, and cleanup. */
export interface StudyBrowserRunnerSandboxJob {
    readonly port: StudyBrowserRunnerPort;
    readonly dispose: () => void;
}
export interface StudyBrowserRunnerHost {
    readonly createSandboxJob: (options: StudyBrowserRunnerSandboxOptions) => StudyBrowserRunnerSandboxJob;
}
export interface StudyBrowserRunnerOptions {
    readonly source: string;
    readonly input: unknown;
    readonly host: StudyBrowserRunnerHost;
    readonly watchdog: StudyBrowserRunnerWatchdog;
    /** Parent-owned text sink for output that must survive stop/error outcomes. */
    readonly onOutput?: StudyBrowserRunnerPrint;
    readonly limits?: Partial<StudyBrowserRunnerLimits>;
}
export interface StudyBrowserRunnerStartCommand {
    readonly type: "start";
    readonly runId: string;
    readonly source: string;
    readonly input: StudyBrowserRunnerJsonValue;
    readonly maxOutputBytes: number;
}
export interface StudyBrowserRunnerStopCommand {
    readonly type: "stop";
    readonly runId: string;
}
export type StudyBrowserRunnerCommand = StudyBrowserRunnerStartCommand | StudyBrowserRunnerStopCommand;
export type StudyBrowserRunnerWorkerErrorCode = "INVALID_ENTRY" | "OUTPUT_LIMIT" | "RUNTIME_ERROR";
export type StudyBrowserRunnerErrorCode = StudyBrowserRunnerWorkerErrorCode | "PROTOCOL_ERROR" | "HOST_UNAVAILABLE";
export type StudyBrowserRunnerOutcome = Readonly<{
    kind: "completed";
    output: string;
}> | Readonly<{
    kind: "stopped";
}> | Readonly<{
    kind: "timeout";
}> | Readonly<{
    kind: "error";
    code: StudyBrowserRunnerErrorCode;
}>;
export interface StudyBrowserRunnerController {
    readonly runId: string;
    readonly start: () => Promise<StudyBrowserRunnerOutcome>;
    readonly stop: () => void;
    readonly dispose: () => void;
}
export type StudyBrowserRunnerUsageCode = "INVALID_CONFIGURATION" | "INVALID_SOURCE" | "INVALID_INPUT" | "ALREADY_STARTED" | "DISPOSED";
export declare class StudyBrowserRunnerUsageError extends TypeError {
    readonly code: StudyBrowserRunnerUsageCode;
    constructor(code: StudyBrowserRunnerUsageCode);
}
/** Trusted constant frame bootstrap. It creates one fresh worker per start. */
export declare const STUDY_BROWSER_RUNNER_BOOTSTRAP: string;
export declare function createStudyBrowserRunnerController(options: StudyBrowserRunnerOptions): StudyBrowserRunnerController;
