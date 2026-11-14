/**
 * Build-time identity and reference registry for optional study documents.
 *
 * This module deliberately does not parse TeX, execute MDX, render React, or
 * decide whether a proof is mathematically valid. It only validates a small
 * first-party data shape and resolves document-scoped semantic identities.
 */
const encoder = new TextEncoder();
export const STUDY_DOCUMENT_REGISTRY_SCHEMA = "study-document-registry-v1";
export const STUDY_REGISTRY_LIMITS = Object.freeze({
    maxDocuments: 128,
    maxSymbolsPerDocument: 1024,
    maxReferencesPerSource: 256,
    maxTotalReferences: 4096,
    maxIdBytes: 64,
    maxAuthorTagBytes: 128,
    maxAttributionBytes: 512,
    maxLicenseBytes: 256,
    maxRepositoryBytes: 256,
    maxRevisionBytes: 128,
    maxPathBytes: 512,
    maxExerciseBytes: 64,
});
export const STUDY_REGISTRY_ERROR_CODES = [
    "INVALID_INPUT",
    "INVALID_PROTOTYPE",
    "INVALID_ID",
    "INVALID_TEXT",
    "BOUNDS_EXCEEDED",
    "INVALID_PROVENANCE",
    "UNSAFE_PATH",
    "INVALID_DATE",
    "DUPLICATE_DOCUMENT",
    "DUPLICATE_SYMBOL",
    "UNRESOLVED_REFERENCE",
    "ANCHOR_COLLISION",
];
const ERROR_MESSAGES = {
    INVALID_INPUT: "Study document registry input is invalid.",
    INVALID_PROTOTYPE: "Study document registry input uses an invalid object prototype.",
    INVALID_ID: "Study document registry identifier is invalid.",
    INVALID_TEXT: "Study document registry text is invalid.",
    BOUNDS_EXCEEDED: "Study document registry input exceeds a supported bound.",
    INVALID_PROVENANCE: "Study source provenance is invalid.",
    UNSAFE_PATH: "Study source path is unsafe.",
    INVALID_DATE: "Study source conversion date is invalid.",
    DUPLICATE_DOCUMENT: "Study document identity is duplicated.",
    DUPLICATE_SYMBOL: "Study symbol identity is duplicated within a document.",
    UNRESOLVED_REFERENCE: "Study document reference cannot be resolved.",
    ANCHOR_COLLISION: "Study anchor identity collides.",
};
/** Errors intentionally contain no caller-provided values or field contents. */
export class StudyDocumentRegistryError extends Error {
    code;
    constructor(code) {
        super(ERROR_MESSAGES[code]);
        this.name = "StudyDocumentRegistryError";
        this.code = code;
    }
}
const FORBIDDEN_PROPERTY_NAMES = new Set(["__proto__", "prototype", "constructor"]);
const SAFE_ID = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const SAFE_EXERCISE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const SAFE_REPOSITORY = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const SAFE_REVISION = /^(?:[0-9a-f]{40}|sha256:[0-9a-f]{64})$/i;
const SOURCE_TREATMENTS = new Set([
    "adapted",
    "copied",
    "original",
]);
const SYMBOL_KINDS = new Set([
    "section",
    "equation",
    "derivation",
]);
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;
function fail(code) {
    throw new StudyDocumentRegistryError(code);
}
function byteLength(value) {
    return encoder.encode(value).byteLength;
}
function compareUtf8(left, right) {
    const leftBytes = encoder.encode(left);
    const rightBytes = encoder.encode(right);
    const length = Math.min(leftBytes.length, rightBytes.length);
    for (let index = 0; index < length; index += 1) {
        const leftByte = leftBytes[index];
        const rightByte = rightBytes[index];
        if (leftByte !== rightByte)
            return leftByte - rightByte;
    }
    return leftBytes.length - rightBytes.length;
}
function deepFreeze(value, seen = new WeakSet()) {
    if (value === null || typeof value !== "object")
        return value;
    const objectValue = value;
    if (seen.has(objectValue))
        return value;
    seen.add(objectValue);
    for (const key of Reflect.ownKeys(objectValue)) {
        const descriptor = Object.getOwnPropertyDescriptor(objectValue, key);
        if (descriptor && "value" in descriptor) {
            deepFreeze(descriptor.value, seen);
        }
    }
    Object.freeze(objectValue);
    return value;
}
function assertPlainObject(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        fail("INVALID_INPUT");
    }
    let prototype;
    let keys;
    try {
        prototype = Object.getPrototypeOf(value);
        keys = Reflect.ownKeys(value);
    }
    catch {
        fail("INVALID_INPUT");
    }
    if (prototype !== Object.prototype && prototype !== null) {
        fail("INVALID_PROTOTYPE");
    }
    for (const key of keys) {
        if (typeof key !== "string" || FORBIDDEN_PROPERTY_NAMES.has(key)) {
            fail("INVALID_INPUT");
        }
        let descriptor;
        try {
            descriptor = Object.getOwnPropertyDescriptor(value, key);
        }
        catch {
            fail("INVALID_INPUT");
        }
        if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
            fail("INVALID_INPUT");
        }
    }
    return value;
}
function assertDenseArray(value, maxCount) {
    if (!Array.isArray(value))
        fail("INVALID_INPUT");
    let prototype;
    let keys;
    try {
        prototype = Object.getPrototypeOf(value);
        keys = Reflect.ownKeys(value);
    }
    catch {
        fail("INVALID_INPUT");
    }
    if (prototype !== Array.prototype)
        fail("INVALID_PROTOTYPE");
    if (value.length > maxCount)
        fail("BOUNDS_EXCEEDED");
    let propertyCount = 0;
    for (const key of keys) {
        if (key === "length")
            continue;
        if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key)) {
            fail("INVALID_INPUT");
        }
        if (Number(key) >= value.length)
            fail("INVALID_INPUT");
        let descriptor;
        try {
            descriptor = Object.getOwnPropertyDescriptor(value, key);
        }
        catch {
            fail("INVALID_INPUT");
        }
        if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
            fail("INVALID_INPUT");
        }
        propertyCount += 1;
    }
    if (propertyCount !== value.length)
        fail("INVALID_INPUT");
    return value;
}
function assertExactKeys(value, required, optional = []) {
    const allowed = new Set([...required, ...optional]);
    for (const key of Object.keys(value)) {
        if (!allowed.has(key))
            fail("INVALID_INPUT");
    }
    for (const key of required) {
        if (!Object.hasOwn(value, key) || value[key] === undefined)
            fail("INVALID_INPUT");
    }
    for (const key of optional) {
        if (Object.hasOwn(value, key) && value[key] === undefined)
            fail("INVALID_INPUT");
    }
}
function hasLoneSurrogate(value) {
    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index);
        if (code >= 0xd800 && code <= 0xdbff) {
            const next = value.charCodeAt(index + 1);
            if (Number.isNaN(next) || next < 0xdc00 || next > 0xdfff)
                return true;
            index += 1;
        }
        else if (code >= 0xdc00 && code <= 0xdfff) {
            return true;
        }
    }
    return false;
}
function readText(value, maxBytes) {
    if (typeof value !== "string" ||
        value.length === 0 ||
        CONTROL_CHARACTERS.test(value) ||
        hasLoneSurrogate(value) ||
        value.normalize("NFC") !== value) {
        fail("INVALID_TEXT");
    }
    if (byteLength(value) > maxBytes || value.trim().length === 0)
        fail("BOUNDS_EXCEEDED");
    return value;
}
function readOptionalAuthorTag(value, key) {
    if (!Object.hasOwn(value, key))
        return undefined;
    return readText(value[key], STUDY_REGISTRY_LIMITS.maxAuthorTagBytes);
}
function readSafeId(value) {
    const id = readText(value, STUDY_REGISTRY_LIMITS.maxIdBytes);
    if (!SAFE_ID.test(id))
        fail("INVALID_ID");
    return id;
}
function readKind(value) {
    if (typeof value !== "string" || !SYMBOL_KINDS.has(value)) {
        fail("INVALID_ID");
    }
    return value;
}
function readReference(value) {
    const objectValue = assertPlainObject(value);
    assertExactKeys(objectValue, ["kind", "label"], ["documentId"]);
    const kind = readKind(objectValue.kind);
    const label = readSafeId(objectValue.label);
    const documentId = Object.hasOwn(objectValue, "documentId")
        ? readSafeId(objectValue.documentId)
        : undefined;
    return documentId === undefined ? { kind, label } : { kind, label, documentId };
}
function readReferences(value) {
    const references = assertDenseArray(value, STUDY_REGISTRY_LIMITS.maxReferencesPerSource);
    return references.map((reference) => readReference(reference));
}
function readSymbols(value, kind) {
    const symbols = assertDenseArray(value, STUDY_REGISTRY_LIMITS.maxSymbolsPerDocument);
    return symbols.map((symbol) => {
        const objectValue = assertPlainObject(symbol);
        assertExactKeys(objectValue, ["label"], ["authorTag"]);
        const label = readSafeId(objectValue.label);
        const authorTag = readOptionalAuthorTag(objectValue, "authorTag");
        return authorTag === undefined ? { kind, label } : { kind, label, authorTag };
    });
}
function readDerivations(value) {
    const derivations = assertDenseArray(value, STUDY_REGISTRY_LIMITS.maxSymbolsPerDocument);
    let referenceCount = 0;
    return derivations.map((derivation) => {
        const objectValue = assertPlainObject(derivation);
        assertExactKeys(objectValue, ["label"], ["authorTag", "references"]);
        const label = readSafeId(objectValue.label);
        const authorTag = readOptionalAuthorTag(objectValue, "authorTag");
        const references = Object.hasOwn(objectValue, "references")
            ? readReferences(objectValue.references)
            : [];
        referenceCount += references.length;
        if (referenceCount > STUDY_REGISTRY_LIMITS.maxTotalReferences) {
            fail("BOUNDS_EXCEEDED");
        }
        return authorTag === undefined
            ? { kind: "derivation", label, references }
            : { kind: "derivation", label, authorTag, references };
    });
}
function readRepo(value) {
    const repo = readText(value, STUDY_REGISTRY_LIMITS.maxRepositoryBytes);
    // Keep provenance to a public, credential-free Owner/Repo identity. URLs,
    // credentials, queries, fragments, local paths, and extra path segments do
    // not belong in this first-version source identity.
    if (!SAFE_REPOSITORY.test(repo))
        fail("INVALID_PROVENANCE");
    return repo;
}
function readRevision(value) {
    const revision = readText(value, STUDY_REGISTRY_LIMITS.maxRevisionBytes);
    if (!SAFE_REVISION.test(revision))
        fail("INVALID_PROVENANCE");
    return revision.toLowerCase();
}
function readSourcePath(value) {
    const path = readText(value, STUDY_REGISTRY_LIMITS.maxPathBytes);
    if (path.startsWith("/") ||
        path.startsWith("~") ||
        /^[A-Za-z]:/.test(path) ||
        path.includes("\\")) {
        fail("UNSAFE_PATH");
    }
    const segments = path.split("/");
    if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
        fail("UNSAFE_PATH");
    }
    return path;
}
function readExercise(value) {
    const exercise = readText(value, STUDY_REGISTRY_LIMITS.maxExerciseBytes);
    if (!SAFE_EXERCISE.test(exercise) || exercise.includes("..")) {
        fail("INVALID_PROVENANCE");
    }
    return exercise;
}
function readConversionDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        fail("INVALID_DATE");
    }
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
        fail("INVALID_DATE");
    }
    return value;
}
function readTreatment(value) {
    if (typeof value !== "string" || !SOURCE_TREATMENTS.has(value)) {
        fail("INVALID_PROVENANCE");
    }
    return value;
}
function sourceIdentityFor(repo, revision, path, exercise) {
    // Length-prefixing keeps the identity injective even if a future source field
    // admits a delimiter used by this representation.
    const fields = [repo, revision, path, exercise];
    return ["study-source-v1", ...fields.map((field) => `${byteLength(field)}:${field}`)].join("|");
}
/**
 * Validate and materialize immutable source-to-web provenance.
 *
 * `sourceIdentity` is derived from the immutable source coordinates. It is
 * accepted only when round-tripping a mapping returned by this helper.
 */
export function createStudySourceWebMapping(input) {
    try {
        const objectValue = assertPlainObject(input);
        assertExactKeys(objectValue, [
            "repo",
            "revision",
            "path",
            "exercise",
            "attribution",
            "license",
            "treatment",
            "conversionDate",
        ], ["sourceIdentity"]);
        const repo = readRepo(objectValue.repo);
        const revision = readRevision(objectValue.revision);
        const path = readSourcePath(objectValue.path);
        const exercise = readExercise(objectValue.exercise);
        const attribution = readText(objectValue.attribution, STUDY_REGISTRY_LIMITS.maxAttributionBytes);
        const license = readText(objectValue.license, STUDY_REGISTRY_LIMITS.maxLicenseBytes);
        const treatment = readTreatment(objectValue.treatment);
        const conversionDate = readConversionDate(objectValue.conversionDate);
        const sourceIdentity = sourceIdentityFor(repo, revision, path, exercise);
        if (Object.hasOwn(objectValue, "sourceIdentity")) {
            if (typeof objectValue.sourceIdentity !== "string" || objectValue.sourceIdentity !== sourceIdentity) {
                fail("INVALID_PROVENANCE");
            }
        }
        return deepFreeze({
            repo,
            revision,
            path,
            exercise,
            attribution,
            license,
            treatment,
            conversionDate,
            sourceIdentity,
        });
    }
    catch (error) {
        if (error instanceof StudyDocumentRegistryError)
            throw error;
        fail("INVALID_INPUT");
    }
}
function readDocument(value) {
    const objectValue = assertPlainObject(value);
    assertExactKeys(objectValue, ["id", "provenance"], ["authorTag", "sections", "equations", "derivations", "references"]);
    const id = readSafeId(objectValue.id);
    const authorTag = readOptionalAuthorTag(objectValue, "authorTag");
    const provenance = createStudySourceWebMapping(objectValue.provenance);
    const sections = Object.hasOwn(objectValue, "sections")
        ? readSymbols(objectValue.sections, "section")
        : [];
    const equations = Object.hasOwn(objectValue, "equations")
        ? readSymbols(objectValue.equations, "equation")
        : [];
    const derivations = Object.hasOwn(objectValue, "derivations")
        ? readDerivations(objectValue.derivations)
        : [];
    const references = Object.hasOwn(objectValue, "references")
        ? readReferences(objectValue.references)
        : [];
    if (sections.length + equations.length + derivations.length > STUDY_REGISTRY_LIMITS.maxSymbolsPerDocument) {
        fail("BOUNDS_EXCEEDED");
    }
    return authorTag === undefined
        ? { id, provenance, sections, equations, derivations, references }
        : { id, authorTag, provenance, sections, equations, derivations, references };
}
function symbolKey(documentId, kind, label) {
    return `${documentId}\u0000${kind}\u0000${label}`;
}
function symbolIdentity(documentId, kind, label) {
    return `${documentId}:${kind}:${label}`;
}
function symbolAnchor(documentId, kind, label) {
    // Length prefixes make the encoding injective even when IDs themselves
    // contain the '-' separator, while keeping the result DOM-safe.
    return `study-${kind}-${byteLength(documentId)}-${documentId}-${byteLength(label)}-${label}`;
}
function makeBaseSymbolRecord(documentId, symbol) {
    const identity = symbolIdentity(documentId, symbol.kind, symbol.label);
    const anchor = symbolAnchor(documentId, symbol.kind, symbol.label);
    return symbol.authorTag === undefined
        ? { identity, documentId, kind: symbol.kind, label: symbol.label, anchor }
        : { identity, documentId, kind: symbol.kind, label: symbol.label, anchor, authorTag: symbol.authorTag };
}
function compareBaseSymbols(left, right) {
    const kindOrder = {
        section: 0,
        equation: 1,
        derivation: 2,
    };
    return (kindOrder[left.kind] - kindOrder[right.kind] ||
        compareUtf8(left.label, right.label));
}
function resolveReference(sourceDocumentId, sourceIdentity, reference, symbols) {
    const targetDocumentId = reference.documentId ?? sourceDocumentId;
    const target = symbols.get(symbolKey(targetDocumentId, reference.kind, reference.label));
    if (!target)
        fail("UNRESOLVED_REFERENCE");
    const base = {
        sourceDocumentId,
        documentId: targetDocumentId,
        kind: reference.kind,
        label: reference.label,
        targetIdentity: target.identity,
        targetAnchor: target.anchor,
        scope: targetDocumentId === sourceDocumentId ? "local" : "cross-document",
    };
    return sourceIdentity === undefined ? base : { ...base, sourceIdentity };
}
/**
 * Build a deterministic, immutable registry from first-party document data.
 *
 * Definitions are namespaced by document id. References without `documentId`
 * are local; cross-document references must name their target document.
 */
export function buildStudyDocumentRegistry(input) {
    try {
        const root = assertPlainObject(input);
        assertExactKeys(root, ["documents"]);
        const rawDocuments = assertDenseArray(root.documents, STUDY_REGISTRY_LIMITS.maxDocuments);
        const parsedDocuments = rawDocuments.map((document) => readDocument(document));
        const documentIds = new Set();
        for (const document of parsedDocuments) {
            if (documentIds.has(document.id))
                fail("DUPLICATE_DOCUMENT");
            documentIds.add(document.id);
        }
        const sortedDocuments = [...parsedDocuments].sort((left, right) => compareUtf8(left.id, right.id));
        const baseSymbols = [];
        const symbolMap = new Map();
        const anchors = new Set();
        const baseByDocument = new Map();
        for (const document of sortedDocuments) {
            const symbols = [
                ...document.sections,
                ...document.equations,
                ...document.derivations,
            ]
                .map((symbol) => makeBaseSymbolRecord(document.id, symbol))
                .sort(compareBaseSymbols);
            const documentSymbols = [];
            for (const symbol of symbols) {
                const key = symbolKey(symbol.documentId, symbol.kind, symbol.label);
                if (symbolMap.has(key))
                    fail("DUPLICATE_SYMBOL");
                if (anchors.has(symbol.anchor))
                    fail("ANCHOR_COLLISION");
                symbolMap.set(key, symbol);
                anchors.add(symbol.anchor);
                baseSymbols.push(symbol);
                documentSymbols.push(symbol);
            }
            baseByDocument.set(document.id, documentSymbols);
        }
        let totalReferences = 0;
        const references = [];
        const referencesByDocument = new Map();
        const referencesByDerivation = new Map();
        for (const document of sortedDocuments) {
            const documentReferences = [];
            for (const reference of document.references) {
                totalReferences += 1;
                if (totalReferences > STUDY_REGISTRY_LIMITS.maxTotalReferences)
                    fail("BOUNDS_EXCEEDED");
                const resolved = resolveReference(document.id, undefined, reference, symbolMap);
                references.push(resolved);
                documentReferences.push(resolved);
            }
            const derivations = [...document.derivations].sort((left, right) => compareUtf8(left.label, right.label));
            for (const derivation of derivations) {
                const source = symbolMap.get(symbolKey(document.id, "derivation", derivation.label));
                if (!source)
                    fail("INVALID_INPUT");
                const derivationReferences = [];
                for (const reference of derivation.references) {
                    totalReferences += 1;
                    if (totalReferences > STUDY_REGISTRY_LIMITS.maxTotalReferences)
                        fail("BOUNDS_EXCEEDED");
                    const resolved = resolveReference(document.id, source.identity, reference, symbolMap);
                    references.push(resolved);
                    documentReferences.push(resolved);
                    derivationReferences.push(resolved);
                }
                referencesByDerivation.set(source.identity, derivationReferences);
            }
            referencesByDocument.set(document.id, documentReferences);
        }
        const finalSymbols = baseSymbols.map((base) => {
            if (base.kind !== "derivation")
                return base;
            return {
                ...base,
                kind: "derivation",
                references: referencesByDerivation.get(base.identity) ?? [],
            };
        });
        const finalSymbolsByIdentity = new Map(finalSymbols.map((symbol) => [symbol.identity, symbol]));
        const documents = sortedDocuments.map((document) => {
            const symbols = (baseByDocument.get(document.id) ?? [])
                .map((base) => finalSymbolsByIdentity.get(base.identity))
                .sort(compareBaseSymbols);
            const sections = symbols.filter((symbol) => symbol.kind === "section");
            const equations = symbols.filter((symbol) => symbol.kind === "equation");
            const derivations = symbols.filter((symbol) => symbol.kind === "derivation");
            const documentReferences = referencesByDocument.get(document.id) ?? [];
            const record = {
                id: document.id,
                ...(document.authorTag === undefined ? {} : { authorTag: document.authorTag }),
                provenance: document.provenance,
                sections,
                equations,
                derivations,
                symbols: [...sections, ...equations, ...derivations],
                references: documentReferences,
            };
            return record;
        });
        return deepFreeze({
            schema: STUDY_DOCUMENT_REGISTRY_SCHEMA,
            documents,
            symbols: finalSymbols,
            references,
        });
    }
    catch (error) {
        if (error instanceof StudyDocumentRegistryError)
            throw error;
        // Never expose parser, proxy, or caller-provided values in diagnostics.
        fail("INVALID_INPUT");
    }
}
