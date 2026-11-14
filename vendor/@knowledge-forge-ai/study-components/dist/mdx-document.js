/** Build-time compiler for trusted first-party MDX, never visitor input. */
import { compile } from "@mdx-js/mdx";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { buildStudyDocumentRegistry, } from "./document-registry.js";
export class StudyMdxError extends Error {
    code;
    constructor(code) {
        super(code);
        this.code = code;
        this.name = "StudyMdxError";
    }
}
const encoder = new TextEncoder();
const ID = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const MAX_SOURCE_BYTES = 256 * 1024;
const MAX_NODES = 20_000;
function literal(node, name, required) {
    const attrs = node.attributes ?? [];
    // Spread props could replace static identities at runtime. Semantic nodes
    // must retain exactly the identities registered during the build.
    if (attrs.some((attr) => attr.type !== "mdxJsxAttribute")) {
        throw new StudyMdxError("STUDY_MDX_SEMANTIC_INVALID");
    }
    const matches = attrs.filter((attr) => attr.name === name);
    if (matches.length > 1 || (required && matches.length !== 1)) {
        throw new StudyMdxError("STUDY_MDX_SEMANTIC_INVALID");
    }
    if (matches.length === 0)
        return undefined;
    const value = matches[0]?.value;
    if (typeof value !== "string" || value.length === 0) {
        throw new StudyMdxError("STUDY_MDX_SEMANTIC_INVALID");
    }
    return value;
}
function semanticRegistry(tree, input) {
    const equations = [];
    const derivations = [];
    const references = [];
    const identities = new Set();
    let nodes = 0;
    let exerciseCount = 0;
    function visit(node, depth) {
        if (++nodes > MAX_NODES || depth > 128) {
            throw new StudyMdxError("STUDY_MDX_BOUNDS_EXCEEDED");
        }
        if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
            const name = node.name;
            if (["Exercise", "Problem", "Solution", "Proof", "Subproof", "Equation"].includes(name ?? "")) {
                const id = literal(node, "id", true);
                if (!ID.test(id) || identities.has(id)) {
                    throw new StudyMdxError("STUDY_MDX_SEMANTIC_INVALID");
                }
                identities.add(id);
                if (name === "Exercise" || name === "Problem") {
                    exerciseCount += 1;
                    if (id !== input.documentId || exerciseCount !== 1) {
                        throw new StudyMdxError("STUDY_MDX_SEMANTIC_INVALID");
                    }
                }
                else if (name !== "Solution") {
                    const authorTag = literal(node, "tag", false);
                    const symbol = authorTag === undefined ? { label: id } : { label: id, authorTag };
                    if (name === "Equation")
                        equations.push(symbol);
                    else
                        derivations.push(symbol);
                }
            }
            else if (name === "EquationRef") {
                const id = literal(node, "id", true);
                if (!ID.test(id) || literal(node, "documentId", false) !== undefined) {
                    throw new StudyMdxError("STUDY_MDX_SEMANTIC_INVALID");
                }
                references.push({ kind: "equation", label: id });
            }
        }
        for (const child of node.children ?? [])
            visit(child, depth + 1);
    }
    visit(tree, 0);
    return buildStudyDocumentRegistry({ documents: [{
                id: input.documentId,
                provenance: input.provenance,
                equations,
                derivations,
                references,
            }] });
}
/**
 * MDX is executable trusted build input. Neither this function nor KaTeX
 * trust:false turns visitor-authored MDX into a sandbox.
 *
 * This first adapter resolves references within one document. The registry
 * itself supports cross-document references; route-aware linking is separate.
 */
export async function compileStudyMdxDocument(input) {
    if (!input || typeof input.source !== "string" || typeof input.documentId !== "string" || !ID.test(input.documentId)) {
        throw new StudyMdxError("STUDY_MDX_INPUT_INVALID");
    }
    if (encoder.encode(input.source).byteLength > MAX_SOURCE_BYTES) {
        throw new StudyMdxError("STUDY_MDX_BOUNDS_EXCEEDED");
    }
    const macros = Object.create(null);
    const entries = Object.entries(input.macros ?? {});
    if (entries.length > 64)
        throw new StudyMdxError("STUDY_MDX_BOUNDS_EXCEEDED");
    for (const [name, value] of entries) {
        if (!/^\\[A-Za-z]{1,64}$/.test(name) || typeof value !== "string" || encoder.encode(value).byteLength > 1024) {
            throw new StudyMdxError("STUDY_MDX_INPUT_INVALID");
        }
        macros[name] = value;
    }
    let registry;
    function collect() {
        return (tree) => { registry = semanticRegistry(tree, input); };
    }
    try {
        const file = await compile(input.source, {
            outputFormat: "function-body",
            remarkPlugins: [remarkMath, collect],
            rehypePlugins: [[rehypeKatex, {
                        output: "htmlAndMathml", trust: false, maxExpand: 1000, maxSize: 10,
                        strict: "error", macros,
                    }]],
        });
        // rehype-katex catches a parse error and emits a nonfatal message plus
        // fallback by default. This build adapter deliberately rejects messages.
        if (file.messages.length > 0)
            throw new StudyMdxError("STUDY_MDX_MATH_REJECTED");
        if (!registry)
            throw new StudyMdxError("STUDY_MDX_SEMANTIC_INVALID");
        return Object.freeze({ compiledSource: String(file), registry, mathPolicy: "reject-messages" });
    }
    catch (error) {
        if (error instanceof StudyMdxError)
            throw error;
        throw new StudyMdxError("STUDY_MDX_COMPILE_FAILED");
    }
}
