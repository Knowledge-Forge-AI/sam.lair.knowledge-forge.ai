/**
 * Lazy TypeScript compiler-worker boundary for the optional study editor.
 *
 * This module deliberately has no TypeScript package import.  The admitted
 * compiler is fetched, hashed, and loaded only inside a disposable classic
 * worker.  Learner source is passed to `transpileModule` as data; it is never
 * evaluated by this worker.
 */
export declare const STUDY_TYPESCRIPT_COMPILER_VERSION: "5.9.3";
export declare const STUDY_TYPESCRIPT_COMPILER_SHA256: "3ae902c92cc44dace175c0e69e13a4b0899f6983c6121d76b9ab8dd5795e7675";
export declare const STUDY_TYPESCRIPT_MAX_SOURCE_BYTES: number;
export declare const STUDY_TYPESCRIPT_MAX_COMPILED_BYTES: number;
export declare const STUDY_TYPESCRIPT_MAX_DIAGNOSTIC_BYTES: number;
export declare const STUDY_TYPESCRIPT_COMPILE_TIMEOUT_MS = 3000;
export interface StudyTypeScriptCompilerAsset {
    readonly url: string;
    readonly version: typeof STUDY_TYPESCRIPT_COMPILER_VERSION;
    readonly sha256: typeof STUDY_TYPESCRIPT_COMPILER_SHA256;
}
export type StudyTypeScriptCompileErrorCode = "SOURCE_TOO_LARGE" | "FUNCTION_EXPRESSION_REQUIRED" | "MODULE_SYNTAX_UNSUPPORTED" | "DEPENDENCY_LOAD_UNSUPPORTED" | "JSX_TSX_UNSUPPORTED" | "SOURCE_SYNTAX_INVALID" | "COMPILED_OUTPUT_TOO_LARGE";
export type StudyTypeScriptCompileResult = Readonly<{
    kind: "compiled";
    code: string;
}> | Readonly<{
    kind: "error";
    code: StudyTypeScriptCompileErrorCode;
}>;
interface StudyTypeScriptDiagnostic {
    readonly messageText?: unknown;
}
interface StudyTypeScriptSourceFile {
    readonly statements?: readonly unknown[];
    readonly parseDiagnostics?: readonly StudyTypeScriptDiagnostic[];
}
/** The small compiler API surface used by the worker and its local seam. */
export interface StudyTypeScriptCompilerApi {
    readonly ScriptTarget: {
        readonly ES2022?: number;
        readonly Latest?: number;
    };
    readonly ModuleKind: {
        readonly None?: number;
    };
    readonly ScriptKind: {
        readonly JS?: number;
        readonly TS?: number;
        readonly TSX?: number;
    };
    readonly createSourceFile: (fileName: string, source: string, languageVersion: number, setParentNodes: boolean, scriptKind?: number) => StudyTypeScriptSourceFile;
    readonly forEachChild: (node: unknown, callback: (child: unknown) => void) => unknown;
    readonly transpileModule: (source: string, options: {
        readonly compilerOptions: Record<string, unknown>;
        readonly reportDiagnostics: true;
    }) => {
        readonly outputText?: unknown;
        readonly diagnostics?: readonly StudyTypeScriptDiagnostic[];
    };
    readonly isExpressionStatement?: (node: unknown) => boolean;
    readonly isArrowFunction?: (node: unknown) => boolean;
    readonly isFunctionExpression?: (node: unknown) => boolean;
    readonly isParenthesizedExpression?: (node: unknown) => boolean;
    readonly isImportDeclaration?: (node: unknown) => boolean;
    readonly isExportDeclaration?: (node: unknown) => boolean;
    readonly isExportAssignment?: (node: unknown) => boolean;
    readonly isImportEqualsDeclaration?: (node: unknown) => boolean;
    readonly isImportTypeNode?: (node: unknown) => boolean;
    readonly isCallExpression?: (node: unknown) => boolean;
    readonly isImportCall?: (node: unknown) => boolean;
    readonly isIdentifier?: (node: unknown) => boolean;
    readonly isJsxElement?: (node: unknown) => boolean;
    readonly isJsxSelfClosingElement?: (node: unknown) => boolean;
    readonly isJsxFragment?: (node: unknown) => boolean;
    readonly isJsxOpeningElement?: (node: unknown) => boolean;
    readonly isJsxClosingElement?: (node: unknown) => boolean;
}
/**
 * Apply the intentionally narrow runtime subset and emit JavaScript through
 * the compiler API.  This function is self-contained so its exact emitted
 * function body can be installed in the worker source below and exercised with
 * the real admitted compiler in a local test seam.
 */
export declare function compileStudyTypeScriptSource(source: string, compiler: StudyTypeScriptCompilerApi): StudyTypeScriptCompileResult;
export type StudyTypeScriptCompilerWorkerMessage = Readonly<{
    kind: "ready";
    requestId: number;
}> | Readonly<{
    kind: "compiled";
    requestId: number;
    code: string;
}> | Readonly<{
    kind: "diagnostic";
    requestId: number;
    code: StudyTypeScriptCompileErrorCode;
}> | Readonly<{
    kind: "boot-error";
    requestId: number;
    code: "COMPILER_WORKER_UNAVAILABLE";
}>;
export interface StudyTypeScriptCompilerWorkerRequest {
    readonly kind: "compile";
    readonly requestId: number;
    readonly source: string;
}
export interface StudyTypeScriptCompilerWorker {
    readonly postMessage: (message: StudyTypeScriptCompilerWorkerRequest) => void;
    readonly addEventListener: (type: "message" | "error", listener: (event: unknown) => void) => void;
    readonly removeEventListener: (type: "message" | "error", listener: (event: unknown) => void) => void;
    readonly terminate: () => void;
}
export type StudyTypeScriptCompilerWorkerFactory = (asset: StudyTypeScriptCompilerAsset) => StudyTypeScriptCompilerWorker;
/**
 * Build a classic-worker script.  The worker fetches exactly one byte stream,
 * verifies that stream, imports those verified bytes through a Blob URL, and
 * only then exposes the compiler API to the policy function.
 */
export declare function createStudyTypeScriptCompilerWorkerSource(asset: StudyTypeScriptCompilerAsset): string;
/** Create the production worker lazily; this function touches browser globals only when called. */
export declare const createStudyTypeScriptCompilerWorker: StudyTypeScriptCompilerWorkerFactory;
export {};
