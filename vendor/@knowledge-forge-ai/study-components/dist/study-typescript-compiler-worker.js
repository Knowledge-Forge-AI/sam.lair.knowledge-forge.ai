/**
 * Lazy TypeScript compiler-worker boundary for the optional study editor.
 *
 * This module deliberately has no TypeScript package import.  The admitted
 * compiler is fetched, hashed, and loaded only inside a disposable classic
 * worker.  Learner source is passed to `transpileModule` as data; it is never
 * evaluated by this worker.
 */
export const STUDY_TYPESCRIPT_COMPILER_VERSION = "5.9.3";
export const STUDY_TYPESCRIPT_COMPILER_SHA256 = "3ae902c92cc44dace175c0e69e13a4b0899f6983c6121d76b9ab8dd5795e7675";
export const STUDY_TYPESCRIPT_MAX_SOURCE_BYTES = 64 * 1024;
export const STUDY_TYPESCRIPT_MAX_COMPILED_BYTES = 64 * 1024;
export const STUDY_TYPESCRIPT_MAX_DIAGNOSTIC_BYTES = 8 * 1024;
export const STUDY_TYPESCRIPT_COMPILE_TIMEOUT_MS = 3_000;
/**
 * Apply the intentionally narrow runtime subset and emit JavaScript through
 * the compiler API.  This function is self-contained so its exact emitted
 * function body can be installed in the worker source below and exercised with
 * the real admitted compiler in a local test seam.
 */
export function compileStudyTypeScriptSource(source, compiler) {
    const sourceBytes = new TextEncoder().encode(source).byteLength;
    if (sourceBytes > 64 * 1024)
        return { kind: "error", code: "SOURCE_TOO_LARGE" };
    if (typeof source !== "string" || source.trim().length === 0) {
        return { kind: "error", code: "SOURCE_SYNTAX_INVALID" };
    }
    const target = compiler.ScriptTarget.ES2022 ?? compiler.ScriptTarget.Latest;
    const scriptKind = compiler.ScriptKind.TS ?? 0;
    if (target === undefined)
        return { kind: "error", code: "SOURCE_SYNTAX_INVALID" };
    let sourceFile;
    try {
        sourceFile = compiler.createSourceFile("study-snippet.ts", source, target, true, scriptKind);
    }
    catch {
        return { kind: "error", code: "SOURCE_SYNTAX_INVALID" };
    }
    const is = (name, node) => {
        const predicate = compiler[name];
        return typeof predicate === "function" && Boolean(predicate(node));
    };
    const nodeExpression = (node) => (node !== null && typeof node === "object"
        ? node.expression
        : undefined);
    const seen = new Set();
    const walk = (node) => {
        if (node === null || typeof node !== "object")
            return undefined;
        const objectNode = node;
        if (seen.has(objectNode))
            return undefined;
        seen.add(objectNode);
        if (is("isJsxElement", node) || is("isJsxSelfClosingElement", node)
            || is("isJsxFragment", node) || is("isJsxOpeningElement", node)
            || is("isJsxClosingElement", node)) {
            return "JSX_TSX_UNSUPPORTED";
        }
        if (is("isImportDeclaration", node) || is("isExportDeclaration", node)
            || is("isExportAssignment", node) || is("isImportEqualsDeclaration", node)
            || is("isImportTypeNode", node)) {
            return "MODULE_SYNTAX_UNSUPPORTED";
        }
        if (is("isCallExpression", node)) {
            const expression = nodeExpression(node);
            if (is("isImportCall", node))
                return "DEPENDENCY_LOAD_UNSUPPORTED";
            if (is("isIdentifier", expression) && expression !== null && typeof expression === "object"
                && expression.text === "require") {
                return "DEPENDENCY_LOAD_UNSUPPORTED";
            }
        }
        let found;
        try {
            compiler.forEachChild(node, (child) => {
                if (found === undefined)
                    found = walk(child);
            });
        }
        catch {
            return "SOURCE_SYNTAX_INVALID";
        }
        return found;
    };
    let tsxSourceFile;
    try {
        tsxSourceFile = compiler.createSourceFile("study-snippet.tsx", source, target, true, compiler.ScriptKind.TSX ?? scriptKind);
    }
    catch {
        return { kind: "error", code: "SOURCE_SYNTAX_INVALID" };
    }
    const jsxError = walk(tsxSourceFile);
    if (jsxError === "JSX_TSX_UNSUPPORTED")
        return { kind: "error", code: jsxError };
    if (jsxError === "MODULE_SYNTAX_UNSUPPORTED")
        return { kind: "error", code: jsxError };
    if (jsxError === "DEPENDENCY_LOAD_UNSUPPORTED")
        return { kind: "error", code: jsxError };
    if (jsxError !== undefined)
        return { kind: "error", code: "SOURCE_SYNTAX_INVALID" };
    if (Array.isArray(sourceFile.parseDiagnostics) && sourceFile.parseDiagnostics.length > 0) {
        return { kind: "error", code: "SOURCE_SYNTAX_INVALID" };
    }
    const statements = sourceFile.statements ?? [];
    if (statements.length !== 1 || !is("isExpressionStatement", statements[0])) {
        return { kind: "error", code: "FUNCTION_EXPRESSION_REQUIRED" };
    }
    let expression = nodeExpression(statements[0]);
    while (expression !== undefined && is("isParenthesizedExpression", expression)) {
        expression = nodeExpression(expression);
    }
    if (!is("isArrowFunction", expression) && !is("isFunctionExpression", expression)) {
        return { kind: "error", code: "FUNCTION_EXPRESSION_REQUIRED" };
    }
    const moduleKind = compiler.ModuleKind.None ?? 0;
    let result;
    try {
        result = compiler.transpileModule(source, {
            compilerOptions: {
                target,
                module: moduleKind,
                isolatedModules: true,
                reportDiagnostics: true,
                declaration: false,
                sourceMap: false,
                inlineSourceMap: false,
                inlineSources: false,
            },
            reportDiagnostics: true,
        });
    }
    catch {
        return { kind: "error", code: "SOURCE_SYNTAX_INVALID" };
    }
    if (Array.isArray(result.diagnostics) && result.diagnostics.length > 0) {
        return { kind: "error", code: "SOURCE_SYNTAX_INVALID" };
    }
    if (typeof result.outputText !== "string")
        return { kind: "error", code: "SOURCE_SYNTAX_INVALID" };
    if (new TextEncoder().encode(result.outputText).byteLength > 64 * 1024) {
        return { kind: "error", code: "COMPILED_OUTPUT_TOO_LARGE" };
    }
    let outputFile;
    try {
        outputFile = compiler.createSourceFile("study-snippet.js", result.outputText, target, true, compiler.ScriptKind.JS ?? scriptKind);
    }
    catch {
        return { kind: "error", code: "SOURCE_SYNTAX_INVALID" };
    }
    if (Array.isArray(outputFile.parseDiagnostics) && outputFile.parseDiagnostics.length > 0) {
        return { kind: "error", code: "SOURCE_SYNTAX_INVALID" };
    }
    const outputStatements = outputFile.statements ?? [];
    if (outputStatements.length !== 1 || !is("isExpressionStatement", outputStatements[0])) {
        return { kind: "error", code: "SOURCE_SYNTAX_INVALID" };
    }
    const emittedExpression = nodeExpression(outputStatements[0]);
    let outputExpression = emittedExpression;
    while (outputExpression !== undefined && is("isParenthesizedExpression", outputExpression)) {
        outputExpression = nodeExpression(outputExpression);
    }
    if (!is("isArrowFunction", outputExpression) && !is("isFunctionExpression", outputExpression)) {
        return { kind: "error", code: "SOURCE_SYNTAX_INVALID" };
    }
    // The printer emits a semicolon for the single expression statement.  The
    // runtime frame wraps the handoff in its own parentheses, so remove only
    // that already-validated trailing statement terminator.  Any helper or
    // additional top-level statement was rejected by the AST checks above.
    const nodeEnd = (node) => (node !== null && typeof node === "object" && typeof node.end === "number"
        ? node.end
        : undefined);
    const expressionEnd = nodeEnd(emittedExpression);
    const statementEnd = nodeEnd(outputStatements[0]);
    if (expressionEnd === undefined || statementEnd === undefined || statementEnd < expressionEnd) {
        return { kind: "error", code: "SOURCE_SYNTAX_INVALID" };
    }
    const expressionTail = result.outputText.slice(expressionEnd, statementEnd);
    const semicolonOffset = expressionTail.indexOf(";");
    if (semicolonOffset === -1)
        return { kind: "compiled", code: result.outputText };
    if (expressionTail.slice(0, semicolonOffset).trim() !== ""
        || expressionTail.slice(semicolonOffset + 1).trim() !== "") {
        return { kind: "error", code: "SOURCE_SYNTAX_INVALID" };
    }
    const normalizedOutput = result.outputText.slice(0, expressionEnd)
        + expressionTail.slice(0, semicolonOffset)
        + expressionTail.slice(semicolonOffset + 1)
        + result.outputText.slice(statementEnd);
    return { kind: "compiled", code: normalizedOutput };
}
function validCompilerAsset(asset) {
    return typeof asset.url === "string" && asset.url.length > 0
        && asset.version === STUDY_TYPESCRIPT_COMPILER_VERSION
        && asset.sha256 === STUDY_TYPESCRIPT_COMPILER_SHA256;
}
/**
 * Build a classic-worker script.  The worker fetches exactly one byte stream,
 * verifies that stream, imports those verified bytes through a Blob URL, and
 * only then exposes the compiler API to the policy function.
 */
export function createStudyTypeScriptCompilerWorkerSource(asset) {
    if (!validCompilerAsset(asset))
        throw new TypeError("The admitted TypeScript compiler asset is invalid.");
    const compileFunction = compileStudyTypeScriptSource.toString();
    return String.raw `"use strict";
(function () {
  const assetUrl = ${JSON.stringify(asset.url)};
  const expectedSha256 = ${JSON.stringify(asset.sha256)};
  const compile = ${compileFunction};
  const scope = self;
  let active = false;
  let compilerPromise;

  function hexDigest(buffer) {
    return Array.from(new Uint8Array(buffer), function (value) {
      return value.toString(16).padStart(2, "0");
    }).join("");
  }

  async function loadCompiler() {
    if (compilerPromise !== undefined) return compilerPromise;
    compilerPromise = (async function () {
      if (!scope.crypto || !scope.crypto.subtle || typeof scope.fetch !== "function"
        || typeof scope.importScripts !== "function" || typeof scope.Blob !== "function"
        || !scope.URL || typeof scope.URL.createObjectURL !== "function"
        || typeof scope.URL.revokeObjectURL !== "function") {
        throw new Error("compiler worker capabilities unavailable");
      }
      // A fresh worker authenticates the response bytes even when the HTTP cache supplies them.
      const response = await scope.fetch(assetUrl, { credentials: "omit", cache: "default" });
      if (!response || !response.ok) throw new Error("compiler asset unavailable");
      const bytes = new Uint8Array(await response.arrayBuffer());
      const actualSha256 = hexDigest(await scope.crypto.subtle.digest("SHA-256", bytes));
      if (actualSha256 !== expectedSha256) throw new Error("compiler asset hash mismatch");
      const blobUrl = scope.URL.createObjectURL(new scope.Blob([bytes], { type: "text/javascript" }));
      try {
        scope.importScripts(blobUrl);
      } finally {
        scope.URL.revokeObjectURL(blobUrl);
      }
      if (!scope.ts || typeof scope.ts.transpileModule !== "function") {
        throw new Error("compiler API unavailable");
      }
      return scope.ts;
    })();
    return compilerPromise;
  }

  scope.onmessage = async function (event) {
    const message = event && event.data;
    if (!message || message.kind !== "compile" || typeof message.requestId !== "number"
      || typeof message.source !== "string" || active) return;
    active = true;
    try {
      const compiler = await loadCompiler();
      scope.postMessage({ kind: "ready", requestId: message.requestId });
      const result = compile(message.source, compiler);
      if (result.kind === "compiled") {
        scope.postMessage({ kind: "compiled", requestId: message.requestId, code: result.code });
      } else {
        scope.postMessage({ kind: "diagnostic", requestId: message.requestId, code: result.code });
      }
    } catch (_error) {
      scope.postMessage({ kind: "boot-error", requestId: message.requestId, code: "COMPILER_WORKER_UNAVAILABLE" });
    } finally {
      active = false;
    }
  };
})();
`;
}
/** Create the production worker lazily; this function touches browser globals only when called. */
export const createStudyTypeScriptCompilerWorker = (asset) => {
    const host = globalThis;
    if (!host.Blob || !host.Worker || !host.URL)
        throw new Error("TypeScript compiler worker is unavailable.");
    const workerUrl = host.URL.createObjectURL(new host.Blob([
        createStudyTypeScriptCompilerWorkerSource(asset),
    ], { type: "text/javascript" }));
    let worker;
    try {
        worker = new host.Worker(workerUrl);
    }
    catch (error) {
        host.URL.revokeObjectURL(workerUrl);
        throw error;
    }
    let terminated = false;
    return {
        postMessage: (message) => worker.postMessage(message),
        addEventListener: (type, listener) => worker.addEventListener(type, listener),
        removeEventListener: (type, listener) => worker.removeEventListener(type, listener),
        terminate: () => {
            if (terminated)
                return;
            terminated = true;
            try {
                worker.terminate();
            }
            finally {
                host.URL?.revokeObjectURL(workerUrl);
            }
        },
    };
};
