import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Bounds apply to trusted build-time records before they become a table tree. */
export const STUDY_SEMANTIC_COMPONENT_LIMITS = Object.freeze({
    maxTruthTableRows: 4_096,
    maxTruthTableColumns: 64,
});
const ERROR_MESSAGES = {
    INVALID_FACTORY: "Study semantic component factory configuration is invalid.",
    DOCUMENT_NOT_FOUND: "Study semantic document is not registered.",
    DOCUMENT_MISMATCH: "Study semantic component document does not match its factory.",
    EQUATION_NOT_FOUND: "Study equation reference is not registered.",
    CROSS_DOCUMENT_REFERENCE_UNSUPPORTED: "Cross-document equation routes are not enabled in this component layer.",
    DERIVATION_NOT_FOUND: "Study proof identity is not registered.",
    CODE_INCLUDE_NOT_FOUND: "Study code include is not bound by the build manifest.",
    INVALID_TABLE: "Study truth table data is invalid.",
};
/** Errors deliberately contain no caller-provided IDs, paths, source, or text. */
export class StudySemanticComponentError extends Error {
    code;
    constructor(code) {
        super(ERROR_MESSAGES[code]);
        this.name = "StudySemanticComponentError";
        this.code = code;
    }
}
function fail(code) {
    throw new StudySemanticComponentError(code);
}
function findDocument(registry, documentId) {
    const document = registry.documents.find((candidate) => candidate.id === documentId);
    return document ?? fail("DOCUMENT_NOT_FOUND");
}
function assertDocumentId(factory, id) {
    if (id !== undefined && id !== factory.document.id)
        fail("DOCUMENT_MISMATCH");
    return factory.document.id;
}
function findEquation(registry, documentId, id) {
    const document = findDocument(registry, documentId);
    return document.equations.find((equation) => equation.label === id)
        ?? fail("EQUATION_NOT_FOUND");
}
function findDerivation(registry, documentId, id) {
    const document = findDocument(registry, documentId);
    return document.derivations.find((derivation) => derivation.label === id)
        ?? fail("DERIVATION_NOT_FOUND");
}
function authorData(authorTag) {
    return authorTag === undefined ? {} : { "data-author-tag": authorTag };
}
function headingId(factory, kind, id) {
    return `study-${kind}-${factory.document.id}-${id}-heading`;
}
function ExerciseView(factory, props, role) {
    const documentId = assertDocumentId(factory, props.id);
    const heading = headingId(factory, role.toLowerCase(), documentId);
    const title = props.title ?? props.sourceLabel ?? role;
    return (_jsxs("article", { "aria-labelledby": heading, "data-study-document": documentId, "data-study-kind": role.toLowerCase(), ...authorData(factory.document.authorTag), children: [_jsx("h2", { id: heading, children: title }), props.sourceLabel === undefined ? null : (_jsx("p", { "data-source-label": "true", children: props.sourceLabel })), props.children] }));
}
function SolutionView(factory, props) {
    const heading = headingId(factory, "solution", props.id ?? factory.document.id);
    return (_jsxs("section", { "aria-labelledby": heading, "data-study-kind": "solution", "data-study-solution-id": props.id, children: [_jsx("h3", { id: heading, children: props.title ?? "Solution" }), props.children] }));
}
function ProofHeading({ id, level, children, }) {
    return level === 3 ? _jsx("h3", { id: id, children: children }) : _jsx("h4", { id: id, children: children });
}
function ProofView(factory, props, role) {
    const derivation = findDerivation(factory.registry, factory.document.id, props.id);
    const heading = headingId(factory, role.toLowerCase(), derivation.label);
    return (_jsxs("section", { id: derivation.anchor, "aria-labelledby": heading, "data-study-kind": role.toLowerCase(), "data-study-identity": derivation.identity, ...authorData(derivation.authorTag), children: [_jsx(ProofHeading, { id: heading, level: role === "Proof" ? 3 : 4, children: props.title ?? role }), props.children, _jsx("p", { "aria-label": "End of proof", "data-study-qed": "true", children: "QED" })] }));
}
function validateTruthTable(props) {
    if (props === null || typeof props !== "object"
        || !Array.isArray(props.headers) || props.headers.length === 0
        || props.headers.length > STUDY_SEMANTIC_COMPONENT_LIMITS.maxTruthTableColumns
        || !Array.isArray(props.rows)
        || props.rows.length > STUDY_SEMANTIC_COMPONENT_LIMITS.maxTruthTableRows) {
        fail("INVALID_TABLE");
    }
    if (props.rowHeaders !== undefined
        && (!Array.isArray(props.rowHeaders) || props.rowHeaders.length !== props.rows.length)) {
        fail("INVALID_TABLE");
    }
    for (const row of props.rows) {
        if (!Array.isArray(row) || row.length !== props.headers.length)
            fail("INVALID_TABLE");
    }
}
function TruthTableView(props) {
    validateTruthTable(props);
    const regionLabel = typeof props.caption === "string" ? props.caption.trim() : "";
    return (_jsx("div", { role: "region", tabIndex: 0, "aria-label": regionLabel || "Truth table; horizontal scrolling region", "data-study-overflow": "horizontal", style: { maxWidth: "100%", overflowX: "auto" }, children: _jsxs("table", { children: [_jsx("caption", { children: props.caption }), _jsx("thead", { children: _jsxs("tr", { children: [props.rowHeaders === undefined ? null : (_jsx("th", { scope: "col", children: props.rowHeaderLabel ?? "Row" })), props.headers.map((header, index) => _jsx("th", { scope: "col", children: header }, index))] }) }), _jsx("tbody", { children: props.rows.map((row, rowIndex) => (_jsxs("tr", { children: [props.rowHeaders === undefined ? null : (_jsx("th", { scope: "row", children: props.rowHeaders[rowIndex] })), row.map((cell, columnIndex) => _jsx("td", { children: cell }, columnIndex))] }, rowIndex))) })] }) }));
}
function CodeIncludeView(factory, props) {
    const binding = factory.codeIncludes.get(props.includeId) ?? fail("CODE_INCLUDE_NOT_FOUND");
    return (_jsxs("figure", { "data-study-code-include": binding.includeId, children: [props.label === undefined ? null : _jsx("figcaption", { children: props.label }), _jsx("pre", { children: _jsx("code", { "data-language": binding.language, "data-entry": binding.entry, children: binding.source }) })] }));
}
function RunnableCodeView(factory, props) {
    return (_jsxs("aside", { role: "note", "aria-label": "Runnable code is not enabled", "data-study-runnable": "unqualified", children: [_jsx("p", { children: "Runnable execution is not provided by this source-only component." }), props.includeId === undefined ? null : (CodeIncludeView(factory, { includeId: props.includeId, label: props.label }))] }));
}
/**
 * Bind static semantic components to one validated document and optional
 * build-manifest code includes. No component reads files, fetches, evaluates,
 * parses TeX, runs Python/JavaScript, or injects HTML.
 */
export function createStudySemanticComponents(options) {
    if (options === null || typeof options !== "object" || !options.registry
        || typeof options.documentId !== "string") {
        fail("INVALID_FACTORY");
    }
    const registry = options.registry;
    const documentId = options.documentId;
    const document = findDocument(registry, documentId);
    const codeIncludes = new Map();
    for (const binding of options.codeIncludes ?? []) {
        if (binding === null || typeof binding !== "object"
            || typeof binding.includeId !== "string" || typeof binding.source !== "string") {
            fail("INVALID_FACTORY");
        }
        if (codeIncludes.has(binding.includeId))
            fail("INVALID_FACTORY");
        codeIncludes.set(binding.includeId, Object.freeze({ ...binding }));
    }
    const factory = Object.freeze({ registry, document, codeIncludes });
    return Object.freeze({
        Exercise: (props) => ExerciseView(factory, props, "Exercise"),
        Problem: (props) => ExerciseView(factory, props, "Problem"),
        Solution: (props) => SolutionView(factory, props),
        Proof: (props) => ProofView(factory, props, "Proof"),
        Subproof: (props) => ProofView(factory, props, "Subproof"),
        Equation: (props) => {
            const equation = findEquation(factory.registry, factory.document.id, props.id);
            return (_jsxs("figure", { id: equation.anchor, tabIndex: props.keyboardScroll === true ? 0 : -1, "data-study-kind": "equation", "data-study-identity": equation.identity, ...authorData(equation.authorTag), children: [_jsx("figcaption", { children: equation.authorTag === undefined ? `Equation ${equation.label}` : `${equation.authorTag}: Equation ${equation.label}` }), props.children] }));
        },
        EquationRef: (props) => {
            const targetDocumentId = props.documentId ?? factory.document.id;
            if (targetDocumentId !== factory.document.id)
                fail("CROSS_DOCUMENT_REFERENCE_UNSUPPORTED");
            const equation = findEquation(factory.registry, targetDocumentId, props.id);
            return (_jsxs("a", { href: `#${equation.anchor}`, "data-study-reference": equation.identity, "data-study-scope": targetDocumentId === factory.document.id ? "local" : "cross-document", ...authorData(equation.authorTag), children: [equation.authorTag === undefined ? null : (_jsxs("span", { "data-author-tag-visible": "true", children: [equation.authorTag, ": "] })), props.children ?? `Equation ${equation.label}`] }));
        },
        TruthTable: TruthTableView,
        CodeInclude: (props) => CodeIncludeView(factory, props),
        RunnableCode: (props) => RunnableCodeView(factory, props),
    });
}
