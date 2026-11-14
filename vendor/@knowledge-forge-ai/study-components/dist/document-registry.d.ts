/**
 * Build-time identity and reference registry for optional study documents.
 *
 * This module deliberately does not parse TeX, execute MDX, render React, or
 * decide whether a proof is mathematically valid. It only validates a small
 * first-party data shape and resolves document-scoped semantic identities.
 */
export declare const STUDY_DOCUMENT_REGISTRY_SCHEMA: "study-document-registry-v1";
export declare const STUDY_REGISTRY_LIMITS: Readonly<{
    maxDocuments: 128;
    maxSymbolsPerDocument: 1024;
    maxReferencesPerSource: 256;
    maxTotalReferences: 4096;
    maxIdBytes: 64;
    maxAuthorTagBytes: 128;
    maxAttributionBytes: 512;
    maxLicenseBytes: 256;
    maxRepositoryBytes: 256;
    maxRevisionBytes: 128;
    maxPathBytes: 512;
    maxExerciseBytes: 64;
}>;
export type StudySymbolKind = "section" | "equation" | "derivation";
export type StudySourceTreatment = "adapted" | "copied" | "original";
export interface StudySourceWebMappingInput {
    readonly repo: string;
    readonly revision: string;
    readonly path: string;
    readonly exercise: string;
    readonly attribution: string;
    readonly license: string;
    readonly treatment: StudySourceTreatment;
    readonly conversionDate: string;
}
export interface StudySourceWebMapping extends StudySourceWebMappingInput {
    /** Derived from the source fields; callers cannot provide or override it. */
    readonly sourceIdentity: string;
}
export interface StudySectionInput {
    readonly label: string;
    readonly authorTag?: string;
}
export interface StudyEquationInput {
    readonly label: string;
    readonly authorTag?: string;
}
export interface StudyReferenceInput {
    readonly kind: StudySymbolKind;
    readonly label: string;
    /** Omit for a local reference. Set explicitly for a cross-document target. */
    readonly documentId?: string;
}
export interface StudyDerivationInput {
    readonly label: string;
    readonly authorTag?: string;
    readonly references?: readonly StudyReferenceInput[];
}
export interface StudyDocumentInput {
    readonly id: string;
    readonly authorTag?: string;
    readonly provenance: StudySourceWebMappingInput | StudySourceWebMapping;
    readonly sections?: readonly StudySectionInput[];
    readonly equations?: readonly StudyEquationInput[];
    readonly derivations?: readonly StudyDerivationInput[];
    /** Document-level references, useful for proof or exercise metadata. */
    readonly references?: readonly StudyReferenceInput[];
}
export interface StudyDocumentRegistryInput {
    readonly documents: readonly StudyDocumentInput[];
}
interface StudySymbolRecordBase {
    readonly identity: string;
    readonly documentId: string;
    readonly kind: StudySymbolKind;
    readonly label: string;
    readonly anchor: string;
    readonly authorTag?: string;
}
export interface StudySectionRecord extends StudySymbolRecordBase {
    readonly kind: "section";
}
export interface StudyEquationRecord extends StudySymbolRecordBase {
    readonly kind: "equation";
}
export interface StudyDerivationRecord extends StudySymbolRecordBase {
    readonly kind: "derivation";
    readonly references: readonly StudyReferenceRecord[];
}
export type StudySymbolRecord = StudySectionRecord | StudyEquationRecord | StudyDerivationRecord;
export interface StudyReferenceRecord {
    readonly sourceDocumentId: string;
    /** Present when a derivation owns the reference; absent for document refs. */
    readonly sourceIdentity?: string;
    /** Always resolved to the target document, even for local references. */
    readonly documentId: string;
    readonly kind: StudySymbolKind;
    readonly label: string;
    readonly targetIdentity: string;
    readonly targetAnchor: string;
    readonly scope: "local" | "cross-document";
}
export interface StudyDocumentRecord {
    readonly id: string;
    readonly authorTag?: string;
    readonly provenance: StudySourceWebMapping;
    readonly sections: readonly StudySectionRecord[];
    readonly equations: readonly StudyEquationRecord[];
    readonly derivations: readonly StudyDerivationRecord[];
    readonly symbols: readonly StudySymbolRecord[];
    readonly references: readonly StudyReferenceRecord[];
}
export interface StudyDocumentRegistry {
    readonly schema: typeof STUDY_DOCUMENT_REGISTRY_SCHEMA;
    readonly documents: readonly StudyDocumentRecord[];
    readonly symbols: readonly StudySymbolRecord[];
    readonly references: readonly StudyReferenceRecord[];
}
export declare const STUDY_REGISTRY_ERROR_CODES: readonly ["INVALID_INPUT", "INVALID_PROTOTYPE", "INVALID_ID", "INVALID_TEXT", "BOUNDS_EXCEEDED", "INVALID_PROVENANCE", "UNSAFE_PATH", "INVALID_DATE", "DUPLICATE_DOCUMENT", "DUPLICATE_SYMBOL", "UNRESOLVED_REFERENCE", "ANCHOR_COLLISION"];
export type StudyRegistryErrorCode = (typeof STUDY_REGISTRY_ERROR_CODES)[number];
/** Errors intentionally contain no caller-provided values or field contents. */
export declare class StudyDocumentRegistryError extends Error {
    readonly code: StudyRegistryErrorCode;
    constructor(code: StudyRegistryErrorCode);
}
/**
 * Validate and materialize immutable source-to-web provenance.
 *
 * `sourceIdentity` is derived from the immutable source coordinates. It is
 * accepted only when round-tripping a mapping returned by this helper.
 */
export declare function createStudySourceWebMapping(input: StudySourceWebMappingInput | StudySourceWebMapping): StudySourceWebMapping;
/**
 * Build a deterministic, immutable registry from first-party document data.
 *
 * Definitions are namespaced by document id. References without `documentId`
 * are local; cross-document references must name their target document.
 */
export declare function buildStudyDocumentRegistry(input: unknown): StudyDocumentRegistry;
export {};
