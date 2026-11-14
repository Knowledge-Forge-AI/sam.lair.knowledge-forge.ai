import type { StudyRuntimeErrorCode, StudyRuntimeJsonValue, StudyRuntimeLimits, StudyRuntimeOutput, StudyRuntimeProbe, StudyRuntimeUsageCode } from "./study-runtime-protocol.js";
/** Languages supported by the editor execution adapter boundary. */
export type StudyEditorExecutionLanguage = "javascript" | "typescript" | "python";
/**
 * The named Python entry is lesson-owned metadata, not learner-provided
 * executable code. The generic runtime applies its own bounded identifier
 * validation before dispatch.
 */
export interface StudyEditorPythonEntryManifest {
    readonly entry: string;
    readonly revision?: string;
}
export interface StudyEditorExecutionRequest {
    readonly language: StudyEditorExecutionLanguage;
    readonly source: string;
    /** The adapter/runtime validates and bounds this parsed JSON snapshot. */
    readonly input: unknown;
    /** Required for Python and forbidden for JavaScript/TypeScript. */
    readonly pythonEntry?: StudyEditorPythonEntryManifest;
    readonly sourceRevision: number;
    readonly inputRevision: number;
    readonly runToken: number;
}
/** Build the adapter request without leaking Python-only metadata to other languages. */
export declare function createStudyEditorExecutionRequest(request: Omit<StudyEditorExecutionRequest, "pythonEntry">, pythonEntry: StudyEditorPythonEntryManifest | undefined): StudyEditorExecutionRequest;
export type StudyEditorExecutionErrorCode = StudyRuntimeErrorCode | Extract<StudyRuntimeUsageCode, "INVALID_CONFIGURATION" | "INVALID_SOURCE" | "INVALID_INPUT" | "INVALID_ENTRY">;
export type StudyEditorExecutionResult = Readonly<{
    kind: "completed";
    value: StudyRuntimeJsonValue;
    stdout: string;
    stderr: string;
    sourceRevision: number;
    inputRevision: number;
    runToken: number;
}> | Readonly<{
    kind: "stopped";
    stdout: string;
    stderr: string;
    sourceRevision: number;
    inputRevision: number;
    runToken: number;
}> | Readonly<{
    kind: "timeout";
    phase: "initialization" | "program";
    stdout: string;
    stderr: string;
    sourceRevision: number;
    inputRevision: number;
    runToken: number;
}> | Readonly<{
    kind: "error";
    code: StudyEditorExecutionErrorCode;
    stdout: string;
    stderr: string;
    sourceRevision: number;
    inputRevision: number;
    runToken: number;
}>;
export interface StudyEditorExecutionObservers {
    readonly onProbe?: (probe: StudyRuntimeProbe) => void;
    readonly onOutput?: (output: StudyRuntimeOutput) => void;
}
/** A single-use controller returned for one editor Run request. */
export interface StudyEditorExecutionController {
    readonly start: () => Promise<StudyEditorExecutionResult>;
    readonly stop: () => void;
    readonly dispose: () => void;
}
/**
 * Reusable, stateless factory boundary for editor runs. The factory carries
 * no active controller; every call creates a fresh run context.
 */
export interface StudyEditorExecutionAdapterFactory {
    readonly createController: (request: StudyEditorExecutionRequest, observers?: StudyEditorExecutionObservers) => StudyEditorExecutionController;
}
/** Optional per-factory bounds supplied by a trusted lesson consumer. */
export type StudyEditorExecutionLimits = Partial<StudyRuntimeLimits>;
