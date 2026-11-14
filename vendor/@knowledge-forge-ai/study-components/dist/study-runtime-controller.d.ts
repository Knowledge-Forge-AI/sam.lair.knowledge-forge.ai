import { type StudyRuntimeController, type StudyRuntimeControllerOptions } from "./study-runtime-protocol.js";
export declare function createStudyRuntimeController(options: StudyRuntimeControllerOptions): StudyRuntimeController;
export declare const STUDY_RUNTIME_CONTROLLER_DEFAULTS: Readonly<{
    maxInitMs: 45000;
    maxProgramMs: 3000;
}>;
