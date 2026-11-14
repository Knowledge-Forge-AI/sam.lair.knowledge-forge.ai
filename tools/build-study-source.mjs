import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(root, "src/study");
const publicStudyRoot = join(root, "public/study");
const packageRoot = join(root, "node_modules/@knowledge-forge-ai/study-components");
const buildRoot = join(root, "build");

const paths = {
  lesson: join(sourceRoot, "lehman-ch3-p4.mdx"),
  provenance: join(sourceRoot, "lehman-ch3-p4.provenance.json"),
  python: join(sourceRoot, "lehman-ch3-p4.py"),
  editor: join(sourceRoot, "LehmanCh3P4Editor.tsx"),
  generatedStudy: join(sourceRoot, "generated-study.js"),
  contentTerms: join(publicStudyRoot, "content-terms.md"),
  lehmanLicense: join(publicStudyRoot, "licenses/lehman-GPL-3.0.txt"),
  katexCss: join(publicStudyRoot, "katex.css"),
  katexLicense: join(publicStudyRoot, "licenses/katex-LICENSE.txt"),
  katexFonts: join(publicStudyRoot, "fonts"),
  publishedProvenance: join(publicStudyRoot, "provenance/lehman-ch3-p4.json"),
  runnerConfig: join(publicStudyRoot, "runner-config.json"),
  binding: join(buildRoot, "study-source-binding.json"),
  outputLock: join(buildRoot, "study-source-output-lock.json"),
};

const fail = (code) => {
  throw new Error(code);
};
const check = (condition, code) => {
  if (!condition) fail(code);
};
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hashFile = (path) => sha256(readFileSync(path));
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

function lstatIfPresent(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    fail("OWNED_PATH_STAT");
  }
}

function ensureInput(path, code) {
  check(existsSync(path) && statSync(path).isFile(), code);
}

const outputLockSchema = "personal-study-source-output-lock.v1";

function outputRelativePath(path) {
  const pathRelativeToRoot = relative(root, path).replaceAll("\\", "/");
  check(pathRelativeToRoot !== "" && !pathRelativeToRoot.startsWith("..") && !isAbsolute(pathRelativeToRoot), "OWNED_PATH_OUTSIDE_REPO");
  check(!pathRelativeToRoot.split("/").includes("."), "OWNED_PATH_DOT_SEGMENT");
  return pathRelativeToRoot;
}

function assertAncestorCustody(path) {
  const rootStat = lstatIfPresent(root);
  check(rootStat?.isDirectory() && !rootStat.isSymbolicLink(), "OWNED_ROOT_CUSTODY");
  let current = path;
  while (current !== root) {
    const stat = lstatIfPresent(current);
    if (stat !== null) {
      check(!stat.isSymbolicLink(), "OWNED_ANCESTOR_SYMLINK");
      check(stat.isDirectory(), "OWNED_ANCESTOR_NOT_DIRECTORY");
    }
    const parent = dirname(current);
    check(parent !== current && relative(root, parent) !== "..", "OWNED_ANCESTOR_OUTSIDE_REPO");
    current = parent;
  }
}

function assertOwnedOutputPath(path) {
  outputRelativePath(path);
  assertAncestorCustody(dirname(path));
  const stat = lstatIfPresent(path);
  if (stat !== null) {
    check(!stat.isSymbolicLink(), "OWNED_DERIVATIVE_SYMLINK");
    check(stat.isFile() && stat.nlink === 1, "OWNED_DERIVATIVE_NOT_REGULAR");
  }
}

function parseOutputLock() {
  const lockStat = lstatIfPresent(paths.outputLock);
  if (lockStat === null) {
    assertOwnedOutputPath(paths.outputLock);
    return new Map();
  }
  assertOwnedOutputPath(paths.outputLock);
  let lock;
  try {
    lock = readJson(paths.outputLock);
  } catch {
    fail("OWNED_OUTPUT_LOCK_INVALID");
  }
  check(lock?.schema === outputLockSchema && Array.isArray(lock.outputs) && typeof lock.lockDigest === "string", "OWNED_OUTPUT_LOCK_INVALID");
  const payload = { schema: lock.schema, outputs: lock.outputs };
  check(lock.lockDigest === sha256(Buffer.from(JSON.stringify(payload))), "OWNED_OUTPUT_LOCK_INVALID");
  const hashes = new Map();
  for (const record of lock.outputs) {
    check(record && typeof record.path === "string" && /^[0-9a-f]{64}$/.test(record.sha256), "OWNED_OUTPUT_LOCK_INVALID");
    const outputPath = join(root, record.path);
    check(outputRelativePath(outputPath) === record.path && !hashes.has(record.path), "OWNED_OUTPUT_LOCK_INVALID");
    hashes.set(record.path, record.sha256);
  }
  return hashes;
}

function hashesFromPreviousBinding() {
  if (lstatIfPresent(paths.binding) === null) {
    assertOwnedOutputPath(paths.binding);
    return new Map();
  }
  assertOwnedOutputPath(paths.binding);
  let binding;
  try {
    binding = readJson(paths.binding);
  } catch {
    fail("OWNED_BINDING_INVALID");
  }
  const hashes = new Map();
  const generated = binding?.generated;
  check(generated && typeof generated === "object", "OWNED_BINDING_INVALID");
  const add = (record) => {
    check(record && typeof record.path === "string" && /^[0-9a-f]{64}$/.test(record.sha256), "OWNED_BINDING_INVALID");
    const outputPath = join(root, record.path);
    check(outputRelativePath(outputPath) === record.path && !hashes.has(record.path), "OWNED_BINDING_INVALID");
    hashes.set(record.path, record.sha256);
  };
  add(generated.studyModule);
  add(generated.provenance);
  add(generated.katex?.css);
  add(generated.katex?.license);
  for (const font of generated.katex?.fonts ?? []) add(font);
  return hashes;
}

function readPreviousOwnedHashes() {
  const lockHashes = parseOutputLock();
  return lockHashes.size > 0 ? lockHashes : hashesFromPreviousBinding();
}

function preflightOwnedOutputs(expectedOutputs, previousHashes) {
  assertOwnedOutputPath(paths.outputLock);
  const expectedPaths = new Set();
  for (const [path, bytes] of expectedOutputs) {
    const pathRelative = outputRelativePath(path);
    check(!expectedPaths.has(pathRelative), "OWNED_OUTPUT_DUPLICATE");
    check(Buffer.isBuffer(bytes), "OWNED_OUTPUT_BYTES");
    expectedPaths.add(pathRelative);
    assertOwnedOutputPath(path);
  }
  const previousPaths = new Set(previousHashes.keys());
  for (const pathRelative of previousPaths) check(expectedPaths.has(pathRelative), "OWNED_OUTPUT_SET_CHANGED");

  const fontDirectory = paths.katexFonts;
  const fontDirectoryStat = lstatIfPresent(fontDirectory);
  if (fontDirectoryStat !== null) {
    check(!fontDirectoryStat.isSymbolicLink() && fontDirectoryStat.isDirectory(), "OWNED_FONT_DIRECTORY_CUSTODY");
    for (const name of readdirSync(fontDirectory)) {
      const entry = join(fontDirectory, name);
      const entryStat = lstatSync(entry);
      check(entryStat.isFile() && !entryStat.isSymbolicLink() && entryStat.nlink === 1, "OWNED_FONT_ENTRY_UNEXPECTED");
      check(expectedPaths.has(outputRelativePath(entry)), "OWNED_FONT_ENTRY_UNEXPECTED");
    }
  }

  for (const [path, bytes] of expectedOutputs) {
    if (lstatIfPresent(path) === null) continue;
    const pathRelative = outputRelativePath(path);
    const actualHash = hashFile(path);
    const previousHash = previousHashes.get(pathRelative);
    if (previousHash !== undefined) check(actualHash === previousHash, "OWNED_DERIVATIVE_DRIFT");
    else check(actualHash === sha256(bytes), "UNOWNED_DERIVATIVE_DRIFT");
  }
}

function writeOwnedOutputs(expectedOutputs, lockBytes) {
  for (const [path, bytes] of expectedOutputs) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
  }
  mkdirSync(dirname(paths.outputLock), { recursive: true });
  writeFileSync(paths.outputLock, lockBytes);
}

function stripFrontmatter(source) {
  const match = source.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)\s*/);
  check(match !== null, "MDX_FRONTMATTER_MISSING");
  return source.slice(match[0].length);
}

function assertProvenance(provenance, sourceFiles) {
  check(provenance.schema_version === 2, "PROVENANCE_SCHEMA");
  check(provenance.document_id === "lehman-ch3-p4", "PROVENANCE_DOCUMENT");
  check(/^[0-9a-f]{40}$/.test(provenance.source_repository?.revision ?? ""), "PROVENANCE_REVISION");
  check(provenance.attribution?.license_label === "GPL-3.0", "PROVENANCE_LICENSE");
  check(provenance.attribution?.or_later === "not-stated; do not relabel as GPL-3.0-or-later", "PROVENANCE_OR_LATER");
  const expected = new Map([
    ["src/study/lehman-ch3-p4.mdx", sourceFiles.lesson],
    ["src/study/lehman-ch3-p4.py", sourceFiles.python],
    ["public/study/content-terms.md", sourceFiles.contentTerms],
  ]);
  for (const record of provenance.materialized_files ?? []) {
    const path = expected.get(record.path);
    if (path === undefined) continue;
    check(record.sha256 === hashFile(path), "PROVENANCE_MATERIALIZED_HASH");
  }
  for (const [path, source] of expected) {
    const record = (provenance.materialized_files ?? []).find((item) => item.path === path);
    check(record?.sha256 === hashFile(source), "PROVENANCE_REQUIRED_HASH");
  }
}

function validateStaticRunner() {
  const runner = readJson(paths.runnerConfig);
  check(runner.schema === "study-runner-consumer-boundary-v1", "RUNNER_SCHEMA");
  check(runner.status === "static-not-active", "RUNNER_STATUS");
  check(runner.pyodideAssetsLoadedBeforeRun === false, "RUNNER_PRELOAD");
  check(runner.editorStatus === "static-only", "RUNNER_EDITOR_STATUS");
  check(runner.publicActivation === "not enabled", "RUNNER_ACTIVATION");
}

function buildKaTeXAssets() {
  const katexRoot = join(root, "node_modules/katex");
  const katexPackage = readJson(join(katexRoot, "package.json"));
  check(katexPackage.version === "0.19.1", "KATEX_VERSION");
  const cssSource = join(katexRoot, "dist/katex.min.css");
  const licenseSource = join(katexRoot, "LICENSE");
  ensureInput(cssSource, "KATEX_CSS_SOURCE");
  ensureInput(licenseSource, "KATEX_LICENSE_SOURCE");
  const css = readFileSync(cssSource, "utf8");
  const fontPaths = [...new Set([...css.matchAll(/url\((?:"|')?([^"')]+)(?:"|')?\)/g)].map((match) => match[1]))];
  check(fontPaths.length === 60, "KATEX_FONT_COUNT");
  const fontNames = new Set();
  const files = new Map();
  for (const fontPath of fontPaths) {
    check(/^fonts\/[A-Za-z0-9_.-]+$/.test(fontPath), "KATEX_FONT_PATH");
    const name = fontPath.slice("fonts/".length);
    fontNames.add(name);
    const source = join(katexRoot, "dist", fontPath);
    ensureInput(source, "KATEX_FONT_SOURCE");
    files.set(`public/study/fonts/${name}`, readFileSync(source));
  }
  const licenseBytes = readFileSync(licenseSource);
  files.set("public/study/katex.css", Buffer.from(css));
  files.set("public/study/licenses/katex-LICENSE.txt", licenseBytes);
  const license = readFileSync(licenseSource, "utf8");
  check(license.startsWith("The MIT License (MIT)") && license.includes("Khan Academy"), "KATEX_LICENSE_CONTENT");
  return {
    version: katexPackage.version,
    files,
    css: { path: "public/study/katex.css", bytes: files.get("public/study/katex.css").byteLength, sha256: sha256(files.get("public/study/katex.css")) },
    license: { path: "public/study/licenses/katex-LICENSE.txt", bytes: files.get("public/study/licenses/katex-LICENSE.txt").byteLength, sha256: sha256(files.get("public/study/licenses/katex-LICENSE.txt")) },
    fonts: [...fontNames].sort().map((name) => {
      const bytes = files.get(`public/study/fonts/${name}`);
      return { path: `public/study/fonts/${name}`, bytes: bytes.byteLength, sha256: sha256(bytes) };
    }),
  };
}

function renderDisabledEditor(editorSource) {
  for (const marker of ["study-editor-disabled", "Optional editor unavailable", "Interactive execution is not enabled in this build"]) check(editorSource.includes(marker), "EDITOR_SOURCE_BOUNDARY");
  check(!editorSource.includes("<button") && !editorSource.includes("createStudyBrowserRunnerController"), "EDITOR_SOURCE_RUNTIME");
  return [
    '<section class="study-editor-disabled" aria-label="Optional study editor">',
    "<h3>Optional editor unavailable</h3>",
    "<p>The lesson, equations, proof, and maintained source are readable. The interactive editor is not part of this static lesson build.</p>",
    '<p role="status">Interactive execution is not enabled in this build.</p>',
    "</section>",
  ].join("");
}

const sourceFiles = {
  lesson: paths.lesson,
  python: paths.python,
  contentTerms: paths.contentTerms,
};
for (const path of [paths.lesson, paths.provenance, paths.python, paths.editor, paths.contentTerms, paths.lehmanLicense, paths.runnerConfig]) ensureInput(path, "SOURCE_INPUT_MISSING");

const lesson = readFileSync(paths.lesson, "utf8");
const provenance = readJson(paths.provenance);
assertProvenance(provenance, sourceFiles);
validateStaticRunner();
const pythonSource = readFileSync(paths.python, "utf8");
check(pythonSource.startsWith("# SPDX-License-Identifier: GPL-3.0-only\n"), "PYTHON_SPDX_LICENSE");
check(pythonSource.includes("Adapted from Samuel Lair's GPLv3 source"), "PYTHON_ATTRIBUTION");
const editorSource = readFileSync(paths.editor, "utf8");
const lehmanLicense = readFileSync(paths.lehmanLicense, "utf8");
check(lehmanLicense.startsWith("                    GNU GENERAL PUBLIC LICENSE\n                       Version 3, 29 June 2007"), "LEHMAN_LICENSE_HEADER");
check(lehmanLicense.includes("END OF TERMS AND CONDITIONS"), "LEHMAN_LICENSE_BODY");

const package4 = readJson(join(packageRoot, "package.json"));
check(package4.name === "@knowledge-forge-ai/study-components" && package4.version === "0.0.0-private.0", "PACKAGE4_IDENTITY");
check(package4.license === "AGPL-3.0-or-later", "PACKAGE4_LICENSE");
for (const file of ["LICENSE", "NOTICE", "COMMERCIAL-LICENSE.md"]) ensureInput(join(packageRoot, file), "PACKAGE4_LEGAL_FILE");
const dependencies = {
  astro: readJson(join(root, "node_modules/astro/package.json")).version,
  mdx: readJson(join(root, "node_modules/@mdx-js/mdx/package.json")).version,
  katex: readJson(join(root, "node_modules/katex/package.json")).version,
  remarkMath: readJson(join(root, "node_modules/remark-math/package.json")).version,
  rehypeKatex: readJson(join(root, "node_modules/rehype-katex/package.json")).version,
  react: readJson(join(root, "node_modules/react/package.json")).version,
  reactDom: readJson(join(root, "node_modules/react-dom/package.json")).version,
};
for (const [name, version] of Object.entries({ mdx: "3.1.1", katex: "0.19.1", remarkMath: "6.0.0", rehypeKatex: "7.0.1", react: "19.2.8", reactDom: "19.2.8" })) check(dependencies[name] === version, `DEPENDENCY_${name}`);

const { compileStudyMdxDocument } = await import("@knowledge-forge-ai/study-components/mdx");
const { createStudySemanticComponents } = await import("@knowledge-forge-ai/study-components/semantic");
const React = await import("react");
const reactRuntime = await import("react/jsx-runtime");
const { renderToStaticMarkup } = await import("react-dom/server");
const result = await compileStudyMdxDocument({
  source: stripFrontmatter(lesson),
  documentId: provenance.document_id,
  provenance: {
    repo: provenance.source_repository.repo,
    revision: provenance.source_repository.revision,
    path: provenance.source_files[0].path,
    exercise: provenance.document_id,
    attribution: provenance.attribution.text,
    license: provenance.attribution.license_label,
    treatment: "adapted",
    conversionDate: provenance.conversion_date,
  },
});
const semantic = createStudySemanticComponents({
  registry: result.registry,
  documentId: provenance.document_id,
  codeIncludes: [{ includeId: "lehman-truth-assignments", source: pythonSource, language: "python", entry: "bounded_truth_value_array" }],
});
const compiledModule = new Function(result.compiledSource)({
  Fragment: reactRuntime.Fragment,
  jsx: reactRuntime.jsx,
  jsxs: reactRuntime.jsxs,
});
const lessonMarkup = renderToStaticMarkup(compiledModule.default({ components: semantic }));
const editorMarkup = renderDisabledEditor(editorSource);
const generated = [
  "// Generated by tools/build-study-source.mjs; trusted first-party source output.",
  `export const lessonMarkup = ${JSON.stringify(lessonMarkup)};`,
  `export const editorMarkup = ${JSON.stringify(editorMarkup)};`,
  "",
].join("\n");
const generatedBytes = Buffer.from(generated);
const assets = buildKaTeXAssets();
const assetsMetadata = {
  version: assets.version,
  css: assets.css,
  license: assets.license,
  fonts: assets.fonts,
};
const publishedProvenance = {
  ...provenance,
  published_files: [
    { path: "study/content-terms.md", sha256: hashFile(paths.contentTerms) },
    { path: "study/licenses/lehman-GPL-3.0.txt", sha256: hashFile(paths.lehmanLicense) },
    { path: "study/licenses/katex-LICENSE.txt", sha256: assets.license.sha256 },
  ],
  published_manifest: {
    note: "Generated from the maintained study provenance record by the normal repository build.",
    output_root: "static-output",
  },
};
const publishedProvenanceBytes = Buffer.from(JSON.stringify(publishedProvenance, null, 2) + "\n");

const binding = {
  schema: "personal-study-source-build.v1",
  status: "passed-source-generation",
  source: {
    lessonSha256: hashFile(paths.lesson),
    provenanceSha256: hashFile(paths.provenance),
    pythonSha256: hashFile(paths.python),
    contentTermsSha256: hashFile(paths.contentTerms),
    lehmanLicenseSha256: hashFile(paths.lehmanLicense),
    editorSha256: hashFile(paths.editor),
  },
  package4: {
    version: package4.version,
    packageJsonSha256: hashFile(join(packageRoot, "package.json")),
    licenseSha256: hashFile(join(packageRoot, "LICENSE")),
    noticeSha256: hashFile(join(packageRoot, "NOTICE")),
    commercialLicenseSha256: hashFile(join(packageRoot, "COMMERCIAL-LICENSE.md")),
  },
  dependencies,
  registry: { documentId: provenance.document_id, symbols: result.registry.symbols.length, references: result.registry.references.length, mathPolicy: result.mathPolicy },
  generated: {
    studyModule: { path: "src/study/generated-study.js", bytes: generatedBytes.byteLength, sha256: sha256(generatedBytes) },
    provenance: { path: "public/study/provenance/lehman-ch3-p4.json", bytes: publishedProvenanceBytes.byteLength, sha256: sha256(publishedProvenanceBytes) },
    katex: assetsMetadata,
  },
  boundaries: {
    build: "normal package build invokes this source generator then the local Astro CLI",
    runtime: "static editor disabled; no Python runtime assets loaded",
    browser: "not run",
    mathematicalCorrectness: "not claimed",
  },
};
const bindingBytes = Buffer.from(JSON.stringify(binding, null, 2) + "\n");
const expectedOutputs = new Map([
  [paths.generatedStudy, generatedBytes],
  [paths.publishedProvenance, publishedProvenanceBytes],
  [paths.binding, bindingBytes],
]);
for (const [pathRelative, bytes] of assets.files) expectedOutputs.set(join(root, pathRelative), bytes);
const previousHashes = readPreviousOwnedHashes();
preflightOwnedOutputs(expectedOutputs, previousHashes);
const outputRecords = [...expectedOutputs.entries()]
  .map(([path, bytes]) => ({ path: outputRelativePath(path), bytes: bytes.byteLength, sha256: sha256(bytes) }))
  .sort((left, right) => left.path.localeCompare(right.path));
const outputLockPayload = { schema: outputLockSchema, outputs: outputRecords };
const outputLock = {
  ...outputLockPayload,
  lockDigest: sha256(Buffer.from(JSON.stringify(outputLockPayload))),
};
const outputLockBytes = Buffer.from(JSON.stringify(outputLock, null, 2) + "\n");
writeOwnedOutputs(expectedOutputs, outputLockBytes);
console.log(JSON.stringify({ status: binding.status, route: "src/pages/study/lehman-ch3-p4.astro", generated: binding.generated.studyModule, output: "dist/" }));
