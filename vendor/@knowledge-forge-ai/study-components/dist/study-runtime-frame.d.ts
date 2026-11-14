import { type StudyRuntimeAssetConfig } from "./study-runtime-protocol.js";
/**
 * Trusted runner-origin frame source. A server must serve this source at the
 * fixed frame path with the selected runner CSP; this module does not create
 * an iframe or relax CSP itself.
 */
export declare const STUDY_RUNTIME_FRAME_SOURCE: string;
export declare const STUDY_RUNTIME_FRAME_ASSET_CONFIG: StudyRuntimeAssetConfig;
