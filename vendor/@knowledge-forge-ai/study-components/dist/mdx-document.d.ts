import { type StudyDocumentRegistry, type StudySourceWebMappingInput } from "./document-registry.js";
export type StudyMdxErrorCode = "STUDY_MDX_INPUT_INVALID" | "STUDY_MDX_BOUNDS_EXCEEDED" | "STUDY_MDX_SEMANTIC_INVALID" | "STUDY_MDX_MATH_REJECTED" | "STUDY_MDX_COMPILE_FAILED";
export declare class StudyMdxError extends Error {
    readonly code: StudyMdxErrorCode;
    constructor(code: StudyMdxErrorCode);
}
export interface StudyMdxInput {
    /** The host removes/handles its own frontmatter before this boundary. */
    readonly source: string;
    readonly documentId: string;
    readonly provenance: StudySourceWebMappingInput;
    /** Document-local macros. A fresh mutable copy is made for every compile. */
    readonly macros?: Readonly<Record<string, string>>;
}
export interface StudyMdxResult {
    /** Trusted build output, to be evaluated only by the first-party build host. */
    readonly compiledSource: string;
    readonly registry: StudyDocumentRegistry;
    readonly mathPolicy: "reject-messages";
}
/**
 * MDX is executable trusted build input. Neither this function nor KaTeX
 * trust:false turns visitor-authored MDX into a sandbox.
 *
 * This first adapter resolves references within one document. The registry
 * itself supports cross-document references; route-aware linking is separate.
 */
export declare function compileStudyMdxDocument(input: StudyMdxInput): Promise<StudyMdxResult>;
