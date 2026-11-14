import type { StudyRuntimeAssetConfig, StudyRuntimeLimits } from "./study-runtime-protocol.js";
import type { StudyEditorExecutionAdapterFactory } from "./study-editor-execution.js";
type CreateRuntimeController = typeof import("./study-runtime-controller.js").createStudyRuntimeController;
type CreateRuntimeHost = typeof import("./separate-origin-runtime-host.js").createSeparateOriginRuntimeHost;
type CreateRuntimeWatchdog = typeof import("./separate-origin-runtime-host.js").createSeparateOriginRuntimeWatchdog;
/** The only runtime functions an adapter implementation may load lazily. */
export interface StudyRuntimeEditorAdapterModule {
    readonly createStudyRuntimeController: CreateRuntimeController;
    readonly createSeparateOriginRuntimeHost: CreateRuntimeHost;
    readonly createSeparateOriginRuntimeWatchdog: CreateRuntimeWatchdog;
}
export interface StudyRuntimeEditorAdapterOptions {
    /** Trusted runner origin configured by the lesson/application owner. */
    readonly runnerOrigin: string;
    /** Optional canonical parent origin; omitted means the browser location. */
    readonly parentOrigin?: string;
    readonly assets?: StudyRuntimeAssetConfig;
    readonly limits?: Partial<StudyRuntimeLimits>;
    /** Unit-only seam; production uses the bounded local dynamic imports below. */
    readonly loadRuntime?: () => Promise<StudyRuntimeEditorAdapterModule>;
}
/**
 * Create a reusable factory without touching DOM, browser globals, or runtime
 * modules. Host/watchdog construction is deferred until each controller's
 * start, and is skipped if Stop/dispose wins the lazy-load race.
 */
export declare function createStudyRuntimeEditorAdapterFactory(options: StudyRuntimeEditorAdapterOptions): StudyEditorExecutionAdapterFactory;
export {};
