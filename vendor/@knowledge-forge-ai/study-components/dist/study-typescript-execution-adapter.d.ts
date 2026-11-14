import type { StudyEditorExecutionAdapterFactory } from "./study-editor-execution.js";
import { type StudyTypeScriptCompilerAsset, type StudyTypeScriptCompilerWorkerFactory } from "./study-typescript-compiler-worker.js";
export interface StudyTypeScriptCompileScheduler {
    readonly set: (callback: () => void, delayMs: number) => unknown;
    readonly clear: (handle: unknown) => void;
}
export interface StudyTypeScriptExecutionAdapterOptions {
    /** Existing JS/Python adapter. It remains the only runtime-wire owner. */
    readonly base: StudyEditorExecutionAdapterFactory;
    /** The exact admitted 5.9.3 browser asset; URL is trusted consumer metadata. */
    readonly compilerAsset: StudyTypeScriptCompilerAsset;
    /** Unit-only worker seam; production uses the lazy browser worker factory. */
    readonly createCompilerWorker?: StudyTypeScriptCompilerWorkerFactory;
    /** Unit-only clock seam; production uses the host timer lazily. */
    readonly scheduler?: StudyTypeScriptCompileScheduler;
}
/**
 * Decorate the existing JS/Python factory.  Non-TypeScript requests pass
 * through untouched; only explicit `language: "typescript"` requests create
 * the compiler worker and then hand generated JavaScript to the base factory.
 */
export declare function createStudyTypeScriptExecutionAdapterFactory(options: StudyTypeScriptExecutionAdapterOptions): StudyEditorExecutionAdapterFactory;
