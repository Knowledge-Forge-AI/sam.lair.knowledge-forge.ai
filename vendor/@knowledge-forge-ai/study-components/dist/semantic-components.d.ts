import type { ReactNode } from "react";
import type { StudyDocumentRegistry } from "./document-registry.js";
/** Bounds apply to trusted build-time records before they become a table tree. */
export declare const STUDY_SEMANTIC_COMPONENT_LIMITS: Readonly<{
    maxTruthTableRows: 4096;
    maxTruthTableColumns: 64;
}>;
export type StudySemanticErrorCode = "INVALID_FACTORY" | "DOCUMENT_NOT_FOUND" | "DOCUMENT_MISMATCH" | "EQUATION_NOT_FOUND" | "CROSS_DOCUMENT_REFERENCE_UNSUPPORTED" | "DERIVATION_NOT_FOUND" | "CODE_INCLUDE_NOT_FOUND" | "INVALID_TABLE";
/** Errors deliberately contain no caller-provided IDs, paths, source, or text. */
export declare class StudySemanticComponentError extends Error {
    readonly code: StudySemanticErrorCode;
    constructor(code: StudySemanticErrorCode);
}
export interface StudySemanticComponentFactoryOptions {
    readonly registry: StudyDocumentRegistry;
    readonly documentId: string;
    /** Build-time source text; this layer never reads files or executes it. */
    readonly codeIncludes?: readonly StudyCodeIncludeBinding[];
}
export interface StudyCodeIncludeBinding {
    readonly includeId: string;
    readonly source: string;
    readonly entry?: string;
    readonly language?: string;
}
export interface ExerciseProps {
    readonly id?: string;
    readonly sourceLabel?: string;
    readonly title?: ReactNode;
    readonly children?: ReactNode;
}
export interface SolutionProps {
    readonly id?: string;
    readonly title?: ReactNode;
    readonly children?: ReactNode;
}
export interface ProofProps {
    readonly id: string;
    readonly title?: ReactNode;
    readonly children?: ReactNode;
}
export interface EquationProps {
    readonly id: string;
    /** Include wide, scrollable equations in sequential keyboard navigation. */
    readonly keyboardScroll?: boolean;
    readonly children?: ReactNode;
}
export interface EquationRefProps {
    readonly id: string;
    /** Cross-document references must name their target document explicitly. */
    readonly documentId?: string;
    readonly children?: ReactNode;
}
export interface TruthTableProps {
    readonly caption: ReactNode;
    readonly headers: readonly ReactNode[];
    readonly rows: readonly (readonly ReactNode[])[];
    /** Optional row headers are rendered with `scope="row"`. */
    readonly rowHeaders?: readonly ReactNode[];
    /** Heading for the extra row-header column; defaults to `Row`. */
    readonly rowHeaderLabel?: ReactNode;
}
export interface CodeIncludeProps {
    readonly includeId: string;
    readonly label?: ReactNode;
}
export interface RunnableCodeProps {
    readonly includeId?: string;
    readonly label?: ReactNode;
}
export interface StudySemanticComponents {
    readonly Exercise: (props: ExerciseProps) => ReactNode;
    readonly Problem: (props: ExerciseProps) => ReactNode;
    readonly Solution: (props: SolutionProps) => ReactNode;
    readonly Proof: (props: ProofProps) => ReactNode;
    readonly Subproof: (props: ProofProps) => ReactNode;
    readonly Equation: (props: EquationProps) => ReactNode;
    readonly EquationRef: (props: EquationRefProps) => ReactNode;
    readonly TruthTable: (props: TruthTableProps) => ReactNode;
    readonly CodeInclude: (props: CodeIncludeProps) => ReactNode;
    readonly RunnableCode: (props: RunnableCodeProps) => ReactNode;
}
/**
 * Bind static semantic components to one validated document and optional
 * build-manifest code includes. No component reads files, fetches, evaluates,
 * parses TeX, runs Python/JavaScript, or injects HTML.
 */
export declare function createStudySemanticComponents(options: StudySemanticComponentFactoryOptions): StudySemanticComponents;
