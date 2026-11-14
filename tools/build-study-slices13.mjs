import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(root, "src/study");
const publicRoot = join(root, "public/study");
const buildRoot = join(root, "build");
const manifestPath = join(sourceRoot, "static-slices13.manifest.json");
const generatedPath = join(sourceRoot, "generated-slices13.js");
const bindingPath = join(buildRoot, "study-slices13-binding.json");
const outputLockPath = join(buildRoot, "study-slices13-output-lock.json");

const fail = (code) => { throw new Error(code); };
const check = (value, code) => { if (!value) fail(code); };
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const hashFile = (path) => sha256(readFileSync(path));
const readText = (path) => readFileSync(path, "utf8");
const outputLockSchema = "personal-study-slices13-output-lock.v1";

function lstatIfPresent(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    fail("SLICES13_PATH_STAT");
  }
}

function outputRelativePath(path) {
  const pathRelative = relative(root, path).replaceAll("\\", "/");
  check(pathRelative !== "" && !pathRelative.startsWith("..") && !isAbsolute(pathRelative), "SLICES13_OUTPUT_OUTSIDE_ROOT");
  check(!pathRelative.split("/").includes("."), "SLICES13_OUTPUT_DOT_SEGMENT");
  return pathRelative;
}

function assertAncestorCustody(path) {
  const rootStat = lstatIfPresent(root);
  check(rootStat?.isDirectory() && !rootStat.isSymbolicLink(), "SLICES13_ROOT_CUSTODY");
  let current = path;
  while (current !== root) {
    const stat = lstatIfPresent(current);
    if (stat !== null) {
      check(!stat.isSymbolicLink(), "SLICES13_OWNED_ANCESTOR_SYMLINK");
      check(stat.isDirectory(), "SLICES13_OWNED_ANCESTOR_NOT_DIRECTORY");
    }
    const parent = dirname(current);
    check(parent !== current && relative(root, parent) !== "..", "SLICES13_OWNED_ANCESTOR_OUTSIDE_ROOT");
    current = parent;
  }
}

function assertOwnedOutputPath(path) {
  outputRelativePath(path);
  assertAncestorCustody(dirname(path));
  const stat = lstatIfPresent(path);
  if (stat !== null) {
    check(!stat.isSymbolicLink(), "SLICES13_OWNED_OUTPUT_SYMLINK");
    check(stat.isFile() && stat.nlink === 1, "SLICES13_OWNED_OUTPUT_NOT_REGULAR");
  }
}

function readPreviousOwnedHashes() {
  const lockStat = lstatIfPresent(outputLockPath);
  if (lockStat === null) {
    assertOwnedOutputPath(outputLockPath);
    return new Map();
  }
  assertOwnedOutputPath(outputLockPath);
  let lock;
  try {
    lock = readJson(outputLockPath);
  } catch {
    fail("SLICES13_OUTPUT_LOCK_INVALID");
  }
  check(lock?.schema === outputLockSchema && Array.isArray(lock.outputs) && typeof lock.lockDigest === "string", "SLICES13_OUTPUT_LOCK_INVALID");
  const payload = { schema: lock.schema, outputs: lock.outputs };
  check(lock.lockDigest === sha256(Buffer.from(JSON.stringify(payload))), "SLICES13_OUTPUT_LOCK_INVALID");
  const hashes = new Map();
  for (const record of lock.outputs) {
    check(record && typeof record.path === "string" && /^[0-9a-f]{64}$/.test(record.sha256), "SLICES13_OUTPUT_LOCK_INVALID");
    const outputPath = join(root, record.path);
    check(outputRelativePath(outputPath) === record.path && !hashes.has(record.path), "SLICES13_OUTPUT_LOCK_INVALID");
    assertOwnedOutputPath(outputPath);
    hashes.set(record.path, record.sha256);
  }
  return hashes;
}

function preflightOwnedOutputs(expectedOutputs, previousHashes) {
  assertOwnedOutputPath(outputLockPath);
  const expectedPaths = new Set();
  for (const [path, bytes] of expectedOutputs) {
    const pathRelative = outputRelativePath(path);
    check(!expectedPaths.has(pathRelative), "SLICES13_OUTPUT_DUPLICATE");
    check(Buffer.isBuffer(bytes), "SLICES13_OUTPUT_BYTES");
    expectedPaths.add(pathRelative);
    assertOwnedOutputPath(path);
  }
  for (const pathRelative of previousHashes.keys()) check(expectedPaths.has(pathRelative), "SLICES13_OUTPUT_SET_CHANGED");
  for (const [path, bytes] of expectedOutputs) {
    if (lstatIfPresent(path) === null) continue;
    const previousHash = previousHashes.get(outputRelativePath(path));
    if (previousHash !== undefined) check(hashFile(path) === previousHash, "SLICES13_OWNED_DERIVATIVE_DRIFT");
    else check(hashFile(path) === sha256(bytes), "SLICES13_UNOWNED_DERIVATIVE_DRIFT");
  }
}

function writeOwnedOutputs(expectedOutputs, lockBytes) {
  for (const [path, bytes] of expectedOutputs) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
  }
  mkdirSync(dirname(outputLockPath), { recursive: true });
  writeFileSync(outputLockPath, lockBytes);
}

function ensureRegular(path, code) {
  check(existsSync(path), code);
  check(readFileSync(path).byteLength >= 0, code);
}

function stripFrontmatter(source) {
  const match = source.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)\s*/);
  check(match !== null, "SLICES13_FRONTMATTER");
  return source.slice(match[0].length);
}

function declaredPageHash(page, path) {
  const actualBytes = readFileSync(path);
  check(page.bytes === actualBytes.byteLength, "SLICES13_PAGE_BYTES");
  check(page.sha256 === sha256(actualBytes), "SLICES13_PAGE_HASH");
}

function sourceProvenanceFor(provenance) {
  const maintained = provenance.sourceHistory?.maintainedSlice;
  check(maintained && typeof maintained.path === "string" && Number.isInteger(maintained.bytes)
    && maintained.bytes > 0 && /^[0-9a-f]{64}$/.test(maintained.sha256), "SLICES13_MAINTAINED_SLICE_DIGEST");
  if (provenance.documentId === "goodrich-ch4-ex6-harmonic") {
    check(maintained.path === "packages/study-components/lessons/goodrich-ch4-ex6-harmonic.mdx"
      && maintained.bytes === 2778
      && maintained.sha256 === "c9b96befa536418f49830453dc933dd0f3a24af59a36f97976941dcb4f88af0c", "SLICES13_MAINTAINED_SLICE_BINDING");
  }
  const original = provenance.sourceHistory?.originalSource;
  check(original && typeof original.repository === "string", "SLICES13_SOURCE_HISTORY");
  check(/^[0-9a-f]{40}$/.test(original.revision), "SLICES13_SOURCE_REVISION");
  check(/^[0-9a-f]{64}$/.test(original.sha256), "SLICES13_SOURCE_HASH");
  check(original.license === "GPL-3.0", "SLICES13_SOURCE_LICENSE");
  return {
    repo: original.repository,
    revision: original.revision,
    path: original.path,
    exercise: provenance.documentId,
    attribution: original.attribution,
    license: original.license,
    treatment: "adapted",
    conversionDate: provenance.conversionDate,
  };
}

const manifest = readJson(manifestPath);
check(manifest.schema === "personal-study-consumer-static-slices13/v1", "SLICES13_MANIFEST_SCHEMA");
check(Array.isArray(manifest.pages) && manifest.pages.length === 2, "SLICES13_PAGE_COUNT");
const { compileStudyMdxDocument } = await import("@knowledge-forge-ai/study-components/mdx");
const { createStudySemanticComponents } = await import("@knowledge-forge-ai/study-components/semantic");
const reactRuntime = await import("react/jsx-runtime");
const { renderToStaticMarkup } = await import("react-dom/server");

const outputs = [];
const records = [];
const publishedArtifacts = [];
for (const pageRecord of manifest.pages) {
  const pagePath = join(root, pageRecord.sourcePath);
  const provenancePath = join(root, pageRecord.provenancePath);
  ensureRegular(pagePath, "SLICES13_PAGE_MISSING");
  ensureRegular(provenancePath, "SLICES13_PROVENANCE_MISSING");
  const pageSource = readText(pagePath);
  const provenance = readJson(provenancePath);
  check(provenance.schema === "personal-study-consumer-static-slice-provenance.v2", "SLICES13_PROVENANCE_SCHEMA");
  check(provenance.documentId === pageRecord.documentId, "SLICES13_DOCUMENT_ID");
  check(provenance.page.path === pageRecord.sourcePath, "SLICES13_PROVENANCE_PAGE_PATH");
  declaredPageHash(provenance.page, pagePath);
  check(!pageSource.includes("def harmonic") && !pageSource.includes("MAX_N ="), "SLICES13_PAGE_DUPLICATES_PYTHON");
  const codeIncludes = [];
  for (const includeId of pageRecord.codeIncludes) {
    const include = (provenance.codeIncludes ?? []).find((item) => item.includeId === includeId);
    check(include !== undefined, "SLICES13_CODE_INCLUDE_RECORD");
    check(Number.isInteger(include.bytes) && include.bytes > 0 && typeof include.sha256 === "string"
      && /^[0-9a-f]{64}$/.test(include.sha256), "SLICES13_CODE_INCLUDE_DIGEST");
    const codePath = join(root, include.path);
    ensureRegular(codePath, "SLICES13_CODE_SOURCE_MISSING");
    const codeSource = readText(codePath);
    const codeHash = hashFile(codePath);
    check(codeHash === include.sha256 && Buffer.byteLength(codeSource) === include.bytes, "SLICES13_CODE_HASH");
    check(codeHash === "6bc850dd844a6568507dea5dd2a98a9dba4257e854d56df6701ec4ee85bd4fa9", "SLICES13_CODE_NOT_ADMITTED");
    codeIncludes.push({ includeId, source: codeSource, language: include.language, entry: include.entry });
  }
  const compiled = await compileStudyMdxDocument({
    source: stripFrontmatter(pageSource),
    documentId: provenance.documentId,
    provenance: sourceProvenanceFor(provenance),
  });
  const semantic = createStudySemanticComponents({
    registry: compiled.registry,
    documentId: provenance.documentId,
    codeIncludes,
  });
  const compiledModule = new Function(compiled.compiledSource)({
    Fragment: reactRuntime.Fragment,
    jsx: reactRuntime.jsx,
    jsxs: reactRuntime.jsxs,
  });
  const markup = renderToStaticMarkup(compiledModule.default({ components: semantic }));
  check(markup.includes("data-study-kind=\"exercise\""), "SLICES13_EXERCISE_MARKER");
  check(markup.includes("http://www.w3.org/1998/Math/MathML"), "SLICES13_MATHML");
  check(!markup.includes("<h1>"), "SLICES13_MDXX_NO_ROUTE_H1_DUPLICATE");
  if (pageRecord.documentId === "goodrich-ch4-ex6-harmonic") {
    const codeIncludeCount = (markup.match(/data-study-code-include="goodrich-harmonic-source"/g) ?? []).length;
    check(codeIncludeCount === 1, "SLICES13_GOODRICH_SINGLE_INCLUDE");
    check(!markup.includes("data-study-runnable"), "SLICES13_GOODRICH_NO_RUNNABLE_FALLBACK");
    check(markup.includes("bounded_harmonic"), "SLICES13_GOODRICH_ENTRY");
  } else {
    check((markup.match(/<table/g) ?? []).length === 2, "SLICES13_ROSEN_TABLES");
    check((markup.match(/data-study-reference=/g) ?? []).length === 4, "SLICES13_ROSEN_REFERENCES");
  }
  const exportName = pageRecord.generatedMarkupExport;
  outputs.push(`export const ${exportName} = ${JSON.stringify(markup)};`);
  const publishedProvenance = {
    ...provenance,
    published: {
      route: pageRecord.route,
      sourceBinding: pageRecord.sourcePath,
      provenanceBinding: pageRecord.provenancePath,
      staticOnly: true,
      generatedBy: "tools/build-study-slices13.mjs",
    },
  };
  const publishedPath = join(publicRoot, `provenance/${pageRecord.documentId}.json`);
  const publishedBytes = Buffer.from(JSON.stringify(publishedProvenance, null, 2) + "\n");
  publishedArtifacts.push({ path: publishedPath, bytes: publishedBytes });
  records.push({
    documentId: pageRecord.documentId,
    source: { path: pageRecord.sourcePath, bytes: Buffer.byteLength(pageSource), sha256: hashFile(pagePath) },
    provenance: { path: pageRecord.provenancePath, bytes: readFileSync(provenancePath).byteLength, sha256: hashFile(provenancePath) },
    publishedProvenance: { path: `public/study/provenance/${pageRecord.documentId}.json`, bytes: publishedBytes.byteLength, sha256: sha256(publishedBytes) },
    route: pageRecord.route,
    registry: { symbols: compiled.registry.symbols.length, references: compiled.registry.references.length, mathPolicy: compiled.mathPolicy },
    markup: { exportName, bytes: markup.length, sha256: sha256(Buffer.from(markup)) },
    codeIncludes: codeIncludes.map((include) => ({ includeId: include.includeId, entry: include.entry, sourceBytes: Buffer.byteLength(include.source), sourceSha256: sha256(Buffer.from(include.source)) })),
  });
}

const generated = [
  "// Generated by tools/build-study-slices13.mjs; consumer-owned static source output.",
  ...outputs,
  `export const staticSlices13Metadata = ${JSON.stringify(records)};`,
  "",
].join("\n");
const binding = {
  schema: "personal-study-slices13-build.v1",
  status: "passed-consumer-static-source-generation",
  source: records,
  generated: { path: "src/study/generated-slices13.js", bytes: Buffer.byteLength(generated), sha256: sha256(Buffer.from(generated)) },
  policy: {
    runtime: "static only; no editor, Python worker, or dynamic runner initialization",
    source: "one consumer-owned Python source file is read at build; page MDX has no Python source duplicate",
    math: "trusted first-party MDX input; only the two displayed Rosen finite truth-table equivalences are proof claims, with no general theorem-prover or unrelated mathematical claim",
    browser: "not run",
  },
};
const bindingBytes = Buffer.from(JSON.stringify(binding, null, 2) + "\n");
const expectedOutputs = new Map([
  [generatedPath, Buffer.from(generated)],
  [bindingPath, bindingBytes],
  ...publishedArtifacts.map(({ path, bytes }) => [path, bytes]),
]);
const previousHashes = readPreviousOwnedHashes();
preflightOwnedOutputs(expectedOutputs, previousHashes);
const outputRecords = [...expectedOutputs.entries()]
  .map(([path, bytes]) => ({ path: outputRelativePath(path), bytes: bytes.byteLength, sha256: sha256(bytes) }))
  .sort((left, right) => left.path.localeCompare(right.path));
const outputLockPayload = { schema: outputLockSchema, outputs: outputRecords };
const outputLockBytes = Buffer.from(JSON.stringify({
  ...outputLockPayload,
  lockDigest: sha256(Buffer.from(JSON.stringify(outputLockPayload))),
}, null, 2) + "\n");
writeOwnedOutputs(expectedOutputs, outputLockBytes);
console.log(JSON.stringify({ status: binding.status, pages: records.length, generated: binding.generated }));
