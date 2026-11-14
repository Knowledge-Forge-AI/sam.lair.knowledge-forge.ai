import { type Extension } from "@codemirror/state";
import { type StudyBrowserRunnerController, type StudyBrowserRunnerHost, type StudyBrowserRunnerJsonValue, type StudyBrowserRunnerLimits, type StudyBrowserRunnerPrint, type StudyBrowserRunnerWatchdog } from "./browser-runner.js";
import { type StudyEditorExecutionAdapterFactory, type StudyEditorPythonEntryManifest } from "./study-editor-execution.js";
import type { StudyRuntimeJsonValue } from "./study-runtime-protocol.js";
import { type ReactNode } from "react";
/** Languages whose editor support can be supplied without importing runtimes here. */
export type StudyEditorLanguage = "javascript" | "typescript" | "python";
export type StudyEditorStatus = "initializing" | "ready" | "running" | "completed" | "stopped" | "timeout" | "error";
/**
 * The optional consumer boundary for a language package. Python is deliberately
 * not imported by this component; a consumer may load it only when that lesson
 * needs it. The returned extension is syntax support, not an execution engine.
 */
export type StudyEditorLanguageLoader = (language: StudyEditorLanguage) => Extension | PromiseLike<Extension>;
export declare const STUDY_EDITOR_MAX_CHECKS = 16;
export type StudyEditorCheckStatus = "passed" | "failed" | "error";
export interface StudyEditorCheckContext {
    /** Parsed input from the completed run; this is not a trust-bearing proof. */
    readonly input: unknown;
    /** Compatibility alias for bounded stdout. */
    readonly output: string;
    /** Adapter-mode completed result fields; omitted for legacy runner checks. */
    readonly value?: StudyRuntimeJsonValue;
    readonly stdout?: string;
    readonly stderr?: string;
}
export interface StudyEditorCheck {
    readonly id: string;
    readonly label: string;
    /** Trusted first-party synchronous callback; never receives host or runner objects. */
    readonly check: (context: StudyEditorCheckContext) => boolean;
}
interface StudyEditorCommonProps {
    /** Initial source. Once mounted, CodeMirror owns source, selection, and history. */
    readonly source: string;
    /** Initial JSON-compatible input shown in the input editor. */
    readonly input?: StudyBrowserRunnerJsonValue;
    readonly language?: StudyEditorLanguage;
    /** Required only for Python syntax support; JavaScript/TypeScript use built-ins. */
    readonly loadLanguage?: StudyEditorLanguageLoader;
    readonly title?: ReactNode;
    /** Optional bounded, consumer-owned checks run only after completed output. */
    readonly checks?: readonly StudyEditorCheck[];
    readonly onSourceChange?: (source: string) => void;
    readonly onInputChange?: (inputText: string) => void;
}
export interface StudyEditorLegacyProps extends StudyEditorCommonProps {
    /** Browser host adapter from the public browser-runner boundary. */
    readonly host: StudyBrowserRunnerHost;
    /** Parent-side watchdog from the public browser-runner boundary. */
    readonly watchdog: StudyBrowserRunnerWatchdog;
    readonly limits?: Partial<StudyBrowserRunnerLimits>;
    readonly execution?: never;
    readonly pythonEntry?: never;
}
export interface StudyEditorExecutionProps extends StudyEditorCommonProps {
    /** Reusable stateless factory; each Run receives a fresh controller. */
    readonly execution: StudyEditorExecutionAdapterFactory;
    readonly host?: never;
    readonly watchdog?: never;
    readonly limits?: never;
    readonly pythonEntry?: StudyEditorPythonEntryManifest;
}
export type StudyEditorProps = StudyEditorLegacyProps | StudyEditorExecutionProps;
export declare class StudyEditorInputError extends TypeError {
    readonly code: "INVALID_JSON";
    constructor();
}
export interface StudyEditorRunnerOptions {
    readonly source: string;
    readonly inputText: string;
    readonly host: StudyBrowserRunnerHost;
    readonly watchdog: StudyBrowserRunnerWatchdog;
    readonly limits?: Partial<StudyBrowserRunnerLimits>;
    readonly onOutput?: StudyBrowserRunnerPrint;
}
/**
 * Thin, testable adapter from the visible JSON input field to the public
 * browser-runner controller. It does not execute or grade the source.
 */
export declare function createStudyEditorRunnerController(options: StudyEditorRunnerOptions): StudyBrowserRunnerController;
/**
 * Defers DOM host construction until a run requests a sandbox job. Consumers
 * can create this wrapper during SSR; the supplied factory is client-owned and
 * is called at most once for the wrapper lifetime.
 */
export declare function createStudyEditorClientOnlyHost(createHost: () => StudyBrowserRunnerHost): StudyBrowserRunnerHost;
export declare function parseStudyEditorInput(inputText: string): unknown;
export interface StudyEditorCheckReport {
    readonly id: string;
    readonly label: string;
    readonly status: StudyEditorCheckStatus;
}
export interface StudyEditorCheckSnapshot {
    readonly runRevision: number;
    readonly sourceRevision: number;
    readonly inputRevision: number;
    readonly reports: readonly StudyEditorCheckReport[];
}
export interface StudyEditorCompletedResult {
    readonly value: StudyRuntimeJsonValue;
    readonly stdout: string;
    readonly stderr: string;
}
export declare function evaluateStudyEditorChecks(checks: readonly StudyEditorCheck[], input: unknown, output: string, runRevision: number, sourceRevision: number, inputRevision: number, completedResult?: StudyEditorCompletedResult): StudyEditorCheckSnapshot;
/**
 * Keep the visible stream authoritative after Clear output. The runner's
 * completed outcome is still the full run output and remains the check input;
 * only the terminal UI buffer must not resurrect text cleared by the learner.
 */
export declare function resolveStudyEditorTerminalOutput(streamedOutput: string, completedOutput: string, outputWasCleared: boolean): string;
export declare function formatStudyEditorResult(value: StudyRuntimeJsonValue | undefined): string;
/**
 * Optional source editor and runner controls for a study lesson.
 *
 * This component does not create a browser sandbox during render and does not
 * execute source itself. It calls either the legacy runner controller or an
 * opt-in execution-adapter factory only after the user presses Run. Before
 * client effects initialize CodeMirror, server/static output keeps a plain
 * textarea fallback so the document remains inspectable without JS.
 */
export declare function StudyEditor(props: StudyEditorProps): ReactNode;
export {};
