import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputRoot = join(root, "dist");
const bindingPath = join(root, "build/study-source-binding.json");
const outputLockPath = join(root, "build/study-source-output-lock.json");
const slicesBindingPath = join(root, "build/study-slices13-binding.json");
const slicesOutputLockPath = join(root, "build/study-slices13-output-lock.json");
const receiptPath = join(root, "build/study-build-receipt.json");
const packageJsonPath = join(root, "package.json");
const packageLockPath = join(root, "package-lock.json");
const fixturePath = join(root, "test/fixtures/study-baseline.v1.json");
const sourceBuilderPath = join(root, "tools/build-study-source.mjs");
const slicesBuilderPath = join(root, "tools/build-study-slices13.mjs");

const fail = (code) => { throw new Error(code); };
const check = (condition, code) => { if (!condition) fail(code); };
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hashFile = (path) => sha256(readFileSync(path));
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const lockEntriesDigest = (lock) => {
  const entries = Object.entries(lock.packages).filter(([path]) => path !== "").sort(([left], [right]) => left.localeCompare(right));
  return { count: entries.length, sha256: sha256(Buffer.from(entries.map(([path, record]) => `${path}\n${JSON.stringify(record)}\n`).join(""))) };
};

function runSourceBuilder() {
  return spawnSync(process.execPath, [sourceBuilderPath], { cwd: root, encoding: "utf8" });
}

function walkFiles(rootPath, current = rootPath) {
  const records = [];
  for (const name of readdirSync(current).sort()) {
    const path = join(current, name);
    const relativePath = relative(rootPath, path);
    const stat = lstatSync(path);
    check(!stat.isSymbolicLink(), "OUTPUT_SYMLINK");
    if (stat.isDirectory()) records.push(...walkFiles(rootPath, path));
    else if (stat.isFile()) records.push({ path: relative(rootPath, path), bytes: stat.size, sha256: hashFile(path) });
  }
  return records;
}

function checkedPublicFile(relativePath) {
  check(typeof relativePath === "string" && /^[A-Za-z0-9._@/\[\]()-]+$/.test(relativePath)
    && !relativePath.startsWith("/") && !relativePath.endsWith("/"), "PUBLIC_SOURCE_PATH_INVALID");
  const parts = relativePath.split("/");
  check(parts.every((part) => part !== "" && part !== "." && part !== ".."), "PUBLIC_SOURCE_PATH_INVALID");
  let current = root;
  for (const part of parts.slice(0, -1)) {
    current = join(current, part);
    const info = lstatSync(current);
    check(info.isDirectory() && !info.isSymbolicLink(), "PUBLIC_SOURCE_ANCESTOR_CUSTODY");
  }
  const path = join(root, relativePath);
  const info = lstatSync(path);
  // Preserve the baseline Git metadata link. Hash its literal target bytes;
  // do not follow it or authorize any other leaf/ancestor symlink.
  if (relativePath === "CLAUDE.md" && info.isSymbolicLink()) {
    check(info.nlink === 1 && readlinkSync(path) === "AGENTS.md", "PUBLIC_SOURCE_METADATA_LINK");
    return path;
  }
  check(info.isFile() && !info.isSymbolicLink() && info.nlink === 1, "PUBLIC_SOURCE_PATH_CUSTODY");
  return path;
}

function publicSourceBytes(relativePath) {
  const path = checkedPublicFile(relativePath);
  return relativePath === "CLAUDE.md" && lstatSync(path).isSymbolicLink()
    ? Buffer.from(readlinkSync(path), "utf8") : readFileSync(path);
}

function explicitPublicProjection(paths) {
  const seen = new Set();
  return paths.map((relativePath) => {
    check(typeof relativePath === "string" && relativePath !== "" && !relativePath.startsWith("/")
      && !relativePath.split("/").includes(".."), "PUBLIC_SOURCE_PATH_INVALID");
    check(!seen.has(relativePath), "PUBLIC_SOURCE_PATH_DUPLICATE");
    seen.add(relativePath);
    const bytes = publicSourceBytes(relativePath);
    return { path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) };
  });
}

function normalizedText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function authoredHeadings(html) {
  return [...html.matchAll(/<(title|h1|h2|h3)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)]
    .map((match) => normalizedText(match[2]))
    .filter(Boolean);
}

function textOutputScan(rootPath) {
  const extensions = new Set([".css", ".html", ".js", ".json", ".md", ".map", ".svg", ".txt", ".webmanifest", ".xml"]);
  const forbidden = ["/Users/", "/home/", "file://", "agent-scratch", "study-components-package4", "tf-closeout"];
  const matches = [];
  for (const record of walkFiles(rootPath)) {
    const extension = record.path.slice(record.path.lastIndexOf("."));
    if (!extensions.has(extension)) continue;
    const text = readFileSync(join(rootPath, record.path), "utf8");
    for (const token of forbidden) if (text.includes(token)) matches.push({ path: record.path, token });
  }
  return { status: matches.length === 0 ? "passed" : "failed", matches };
}

check(existsSync(outputRoot) && existsSync(fixturePath), "BUILD_OUTPUT_MISSING");
check(existsSync(bindingPath), "SOURCE_BINDING_MISSING");
check(existsSync(outputLockPath), "SOURCE_OUTPUT_LOCK_MISSING");
const binding = readJson(bindingPath);
const packageJson = readJson(packageJsonPath);
const packageLock = readJson(packageLockPath);
const fixture = readJson(fixturePath);
const sourceBuild = readFileSync(join(root, "tools/build-study-source.mjs"), "utf8");

check(packageJson.scripts.predev === "node tools/build-study-source.mjs && node tools/build-study-slices13.mjs"
  && packageJson.scripts.prestart === "node tools/build-study-source.mjs && node tools/build-study-slices13.mjs"
  && packageJson.scripts.build === "node tools/build-study-source.mjs && node tools/build-study-slices13.mjs && astro build", "NORMAL_BUILD_PIPELINE");
for (const forbidden of ["/Users/", "/home/", "pinnedNode", "astroClosure", "knowledge-forge.github.io", "study-components-package1"]) check(!sourceBuild.includes(forbidden), "SOURCE_BUILDER_AMBIENT_PATH");
check(fixture.schema === "personal-study-public-fixture.v1", "PUBLIC_FIXTURE_SCHEMA");
for (const forbiddenPath of ["tools/private", "research", "study-pilot-binding.json"]) check(!existsSync(join(root, forbiddenPath)), `PUBLIC_PRIVATE_PATH_${forbiddenPath}`);
check(existsSync(sourceBuilderPath) && existsSync(slicesBuilderPath) && existsSync(join(root, "tools/test-study-source.mjs")), "PUBLIC_TEST_FILES_MISSING");
const publicProjectionPaths = fixture.publicProjectionPaths;
check(Array.isArray(publicProjectionPaths) && publicProjectionPaths.includes("tools/test-study-source.mjs"), "PUBLIC_PROJECTION_PATH_LIST");
// The verifier is included in the explicit public path list but omitted from this aggregate to avoid a self-hash cycle.
const publicProjection = explicitPublicProjection(publicProjectionPaths)
  .filter((record) => record.path !== "tools/test-study-source.mjs");
const publicProjectionAggregate = sha256(Buffer.from(publicProjection.map((record) => `${record.sha256}  ${record.path}\n`).join("")));
check(publicProjection.length === 139 && publicProjection.reduce((total, record) => total + record.bytes, 0) === 1085728 && publicProjectionAggregate === "4b9c93d66b836b1f104740593755bc84e6dc4c6a49e6545f6dee148e0b1b9e5f", "PUBLIC_PROJECTION_MANIFEST");
check(binding.schema === "personal-study-source-build.v1", "SOURCE_BINDING_SCHEMA");
check(binding.status === "passed-source-generation", "SOURCE_BINDING_STATUS");
check(packageLock.name === fixture.lock.topLevel.name && packageLock.lockfileVersion === fixture.lock.topLevel.lockfileVersion, "LOCK_TOP_LEVEL_FIELDS");
check(binding.dependencies.astro === readJson(join(root, "node_modules/astro/package.json")).version, "ASTRO_LOCAL_VERSION");
for (const [name, value] of Object.entries(fixture.package.baselineDependencies)) check(packageJson.dependencies[name] === value, `BASELINE_DEPENDENCY_${name}`);
const allowedAddedLockPaths = new Set(fixture.lock.allowedAddedNonRootPaths);
const currentLockEntries = Object.entries(packageLock.packages).filter(([path]) => path !== "");
const addedLockPaths = currentLockEntries.map(([path]) => path).filter((path) => allowedAddedLockPaths.has(path));
check(addedLockPaths.length === fixture.lock.allowedAddedNonRootPaths.length, "LOCK_ADDED_ENTRY_COUNT");
const baselineLockEntries = currentLockEntries.filter(([path]) => !allowedAddedLockPaths.has(path)).sort(([left], [right]) => left.localeCompare(right));
const baselineLockDigest = { count: baselineLockEntries.length, sha256: sha256(Buffer.from(baselineLockEntries.map(([path, record]) => `${path}\n${JSON.stringify(record)}\n`).join(""))) };
const baselineLockPathsSha256 = sha256(Buffer.from(baselineLockEntries.map(([path]) => path).join("\n") + "\n"));
check(baselineLockDigest.count === fixture.lock.nonRootEntryCount && baselineLockDigest.sha256 === fixture.lock.nonRootEntriesSha256 && baselineLockPathsSha256 === fixture.lock.nonRootPathsSha256, "BASELINE_LOCK_ENTRIES");

const lessonChecks = spawnSync(process.execPath, [join(root, "tools/test-lehman-checks.mjs")], {cwd:root,encoding:"utf8"});
check(lessonChecks.status === 0 && lessonChecks.stdout.includes('"status":"PASS"'), "LESSON_EXAMPLE_CHECKS");

const outputFiles = walkFiles(outputRoot);
const outputByPath = new Map(outputFiles.map((record) => [record.path, record]));
check(outputFiles.length === 159, "OUTPUT_FILE_COUNT");
check(outputFiles.filter((record) => record.path.endsWith(".html")).length === 47, "OUTPUT_HTML_COUNT");
check(fixture.output.fileCount === 77 && fixture.output.htmlPages === 43, "BASELINE_OUTPUT_FACTS");
check(sha256(Buffer.from(fixture.output.nonGeneratedPaths.join("\n") + "\n")) === fixture.output.nonGeneratedPathsSha256, "BASELINE_OUTPUT_PATHS_HASH");
for (const path of fixture.output.nonGeneratedPaths) check(outputByPath.has(path), `BASELINE_OUTPUT_MISSING_${path}`);
for (const [path, expectedHash] of Object.entries(fixture.output.authoredHeadingSha256)) {
  check(outputByPath.has(path), `BASELINE_HEADING_PATH_${path}`);
  const actual = authoredHeadings(readFileSync(join(outputRoot, path), "utf8"));
  check(sha256(Buffer.from(JSON.stringify(actual))) === expectedHash, `AUTHORED_HEADING_${path}`);
}

const studyLink = 'href="/study/"';
let outputPagesWithStudyLink = 0;
check(fixture.shell.studyLinkBaselinePages === 0, "BASELINE_STUDY_LINK_PRESENT");
for (const record of outputFiles.filter((item) => item.path.endsWith(".html"))) {
  const outputHtml = readFileSync(join(outputRoot, record.path), "utf8");
  if (outputHtml.includes(studyLink)) outputPagesWithStudyLink += 1;
}
check(outputPagesWithStudyLink === 41, "OUTPUT_STUDY_LINK_COUNT");
const studyRoute = readFileSync(join(outputRoot, "study/lehman-ch3-p4/index.html"), "utf8");
check(studyRoute.includes('aria-current="page"') && studyRoute.includes(studyLink), "STUDY_LINK_ACTIVE");
check(studyRoute.includes("data-study-kind=\"proof\"") && studyRoute.includes("data-study-kind=\"subproof\""), "STUDY_PROOF_MARKERS");
check(studyRoute.includes('data-study-code-include="lehman-truth-assignments"'), "STUDY_CODE_INCLUDE");
check(editorSourceForLayout().includes('study-editor-slot study-editor-gate'), "EDITOR_LAYOUT_SCOPE");
function editorSourceForLayout() { return readFileSync(join(root, "src/study/LehmanCh3P4Interactive.tsx"), "utf8"); }
check(readFileSync(join(root,"src/styles/study.css"),"utf8").includes("max-height: 30rem"), "EDITOR_BOUNDED_SCROLL");
check(studyRoute.includes("Example checks inspect the current result") && editorSourceForLayout().includes("checks={LEHMAN_CHECKS}"), "VISIBLE_LESSON_CHECKS");
check(studyRoute.includes("Optional Python editor") && studyRoute.includes("LehmanCh3P4Interactive") && !studyRoute.includes('class="study-editor-disabled"'), "OPTIONAL_EDITOR_ISLAND");
const editorSource = readFileSync(join(root, "src/study/LehmanCh3P4Interactive.tsx"), "utf8");
const runnerConfig = readJson(join(root, "public/study/runner-config.json"));
check(editorSource.includes(`LEHMAN_PARENT_ORIGIN = "${runnerConfig.parentOrigin}"`) && editorSource.includes(`LEHMAN_RUNNER_ORIGIN = "${runnerConfig.runnerOrigin}"`), "EDITOR_ORIGIN_BINDING");
check(editorSource.includes("maxProgramMs: 3_000") && editorSource.includes("maxInitMs: 45_000") && editorSource.includes('pythonEntry={{ entry: "bounded_truth_value_array"'), "EDITOR_BOUNDED_ENTRY");
check(studyRoute.includes('href="/study/licenses/codemirror-NOTICES.txt"') && outputByPath.has("study/licenses/codemirror-NOTICES.txt"), "EDITOR_LICENSE");
check(studyRoute.includes("http://www.w3.org/1998/Math/MathML"), "STUDY_MATHML");
for (const forbidden of ["new Worker", "fetch(", "pyodide"]) check(!studyRoute.includes(forbidden), `STUDY_RUNTIME_MARKER_${forbidden}`);
for (const href of ["/study/content-terms.md", "/study/provenance/lehman-ch3-p4.json", "/study/licenses/katex-LICENSE.txt", "/study/licenses/lehman-GPL-3.0.txt"]) check(studyRoute.includes(`href=\"${href}\"`), `STUDY_LINK_${href}`);

check(existsSync(slicesBindingPath) && existsSync(slicesOutputLockPath), "SLICES13_OUTPUT_METADATA_MISSING");
const slicesBinding = readJson(slicesBindingPath);
const slicesOutputLock = readJson(slicesOutputLockPath);
check(slicesBinding.schema === "personal-study-slices13-build.v1" && slicesBinding.status === "passed-consumer-static-source-generation", "SLICES13_BINDING_STATUS");
check(slicesBinding.generated.sha256 === hashFile(join(root, slicesBinding.generated.path)), "SLICES13_GENERATED_HASH");
check(slicesOutputLock.schema === "personal-study-slices13-output-lock.v1" && slicesOutputLock.outputs.length === 4, "SLICES13_OUTPUT_LOCK");
for (const record of slicesOutputLock.outputs) check(hashFile(join(root, record.path)) === record.sha256, `SLICES13_OUTPUT_HASH_${record.path}`);
const studyIndex = readFileSync(join(outputRoot, "study/index.html"), "utf8");
for (const href of ["/study/lehman-ch3-p4/", "/study/goodrich-ch4-ex6-harmonic/", "/study/rosen-1-3-ex5-6/"]) check(studyIndex.includes(`href=\"${href}\"`), `SLICES13_INDEX_LINK_${href}`);
check(studyIndex.includes("Three pages on a recurrence")
  && studyIndex.includes("Recursive harmonic numbers")
  && studyIndex.includes("Truth assignments")
  && !studyIndex.includes("new Worker") && !studyIndex.includes("pyodide"), "SLICES13_INDEX_CONTENT");
const goodrichRoute = readFileSync(join(outputRoot, "study/goodrich-ch4-ex6-harmonic/index.html"), "utf8");
const rosenRoute = readFileSync(join(outputRoot, "study/rosen-1-3-ex5-6/index.html"), "utf8");
const goodrichPublished = readJson(join(root, "public/study/provenance/goodrich-ch4-ex6-harmonic.json"));
const rosenPublished = readJson(join(root, "public/study/provenance/rosen-1-3-ex5-6.json"));
check(goodrichPublished.published.staticOnly === false && goodrichPublished.published.mdxSliceStaticOnly === true
  && goodrichPublished.interactiveConsumer.route === "/study/goodrich-ch4-ex6-harmonic/"
  && rosenPublished.published.staticOnly === true && rosenPublished.published.mdxSliceStaticOnly === true, "SLICES13_ROUTE_RUNTIME_SCOPE");
const goodrichEditorSource = readFileSync(join(root,"src/study/GoodrichCh4Ex6Interactive.tsx"),"utf8");
check(goodrichEditorSource.includes(`GOODRICH_PARENT_ORIGIN = "${runnerConfig.parentOrigin}"`)
  && goodrichEditorSource.includes(`GOODRICH_RUNNER_ORIGIN = "${runnerConfig.runnerOrigin}"`)
  && goodrichEditorSource.includes("study-editor-slot study-editor-gate")
  && goodrichRoute.includes('href="/study/licenses/codemirror-NOTICES.txt"')
  && goodrichRoute.includes('href="/study/provenance/goodrich-ch4-ex6-harmonic.json"'), "GOODRICH_EDITOR_CONSUMER_BINDING");

check((goodrichRoute.match(/data-study-code-include="goodrich-harmonic-source"/g) ?? []).length === 1
  && !goodrichRoute.includes("data-study-runnable")
  && (goodrichRoute.match(/<h1>/g) ?? []).length === 1
  && goodrichRoute.includes("bounded_harmonic"), "SLICES13_GOODRICH_SINGLE_OUTPUT");
check((rosenRoute.match(/<h1>/g) ?? []).length === 1
  && (rosenRoute.match(/<table/g) ?? []).length === 2
  && (rosenRoute.match(/data-study-reference=/g) ?? []).length === 4, "SLICES13_ROSEN_OUTPUT");
for (const [routeName, routeHtml] of [["index", studyIndex], ["goodrich", goodrichRoute], ["rosen", rosenRoute]]) {
  for (const forbidden of ["new Worker", "fetch(", "pyodide", "Activate optional editor"])
    check(!routeHtml.includes(forbidden), `SLICES13_${routeName.toUpperCase()}_RUNTIME_MARKER_${forbidden}`);
}
for (const routeHtml of [goodrichRoute, rosenRoute]) {
  check(routeHtml.includes('href="/study/licenses/lehman-GPL-3.0.txt"')
    && routeHtml.includes('href="/study/licenses/katex-LICENSE.txt"'), "SLICES13_LICENSE_LINKS");
}
check(fixture.goodrichEditor.schema === "personal-study-goodrich-editor.v1" && fixture.goodrichEditor.route === "study/goodrich-ch4-ex6-harmonic/index.html" && fixture.goodrichEditor.positiveIntegerMaximum === 8, "GOODRICH_EDITOR_FIXTURE");
for (const [outputPath, historicalExpected] of Object.entries(fixture.studySlices13.htmlNormalizedStudyCssSha256)) {
  const expected = outputPath === fixture.goodrichEditor.route ? fixture.goodrichEditor.htmlNormalizedStudyCssSha256 : historicalExpected;
  const html = readFileSync(join(outputRoot, outputPath), "utf8");
  const cssLinks = [...html.matchAll(/\/_astro\/study\.[A-Za-z0-9_-]+\.css/g)];
  check(cssLinks.length === 1 && outputByPath.has(cssLinks[0][0].slice(1)), "SLICES13_STUDY_CSS_BINDING");
  const normalized = html.replace(/\/_astro\/study\.[A-Za-z0-9_-]+\.css/g, "/_astro/study.CONTENT.css");
  check(sha256(Buffer.from(normalized)) === expected, `SLICES13_HTML_NORMALIZED_HASH_${outputPath}`);
}

check(binding.generated.studyModule.sha256 === hashFile(join(root, "src/study/generated-study.js")), "GENERATED_STUDY_HASH");
check(binding.generated.provenance.sha256 === hashFile(join(root, "public/study/provenance/lehman-ch3-p4.json")), "GENERATED_PROVENANCE_HASH");
check(binding.generated.katex.css.sha256 === hashFile(join(root, "public/study/katex.css")), "GENERATED_KATEX_CSS_HASH");
check(binding.generated.katex.license.sha256 === hashFile(join(root, "public/study/licenses/katex-LICENSE.txt")), "GENERATED_KATEX_LICENSE_HASH");
check(binding.generated.katex.fonts.length === 60, "GENERATED_KATEX_FONT_COUNT");
for (const font of binding.generated.katex.fonts) check(hashFile(join(root, font.path)) === font.sha256, `GENERATED_FONT_HASH_${font.path}`);
const scan = textOutputScan(outputRoot);
check(scan.status === "passed" && scan.matches.length === 0, "OUTPUT_PRIVACY_SCAN");

function runIsolatedMutationProbes() {
  const probeRoot = mkdtempSync(join(tmpdir(), "personal-study-source-probe-"));
  try {
    // Copy only declared public inputs and the generator's closed owned outputs.
    // Never traverse the checkout: Git objects, ignored files and credentials
    // are outside this probe's input scope even in a normal developer clone.
    const ownedLock = readJson(outputLockPath);
    check(ownedLock.schema === "personal-study-source-output-lock.v1"
      && Array.isArray(ownedLock.outputs) && ownedLock.outputs.length === 65, "PROBE_OUTPUT_LOCK");
    const generatedPaths = ownedLock.outputs.map((record) => {
      check(typeof record.path === "string" && (
        record.path === "build/study-source-binding.json"
        || record.path === "src/study/generated-study.js"
        || record.path === "public/study/katex.css"
        || record.path === "public/study/licenses/katex-LICENSE.txt"
        || record.path === "public/study/provenance/lehman-ch3-p4.json"
        || /^public\/study\/fonts\/KaTeX_[A-Za-z0-9_-]+\.(ttf|woff|woff2)$/.test(record.path)
      ), "PROBE_OUTPUT_PATH");
      return record.path;
    });
    const slicesLock = readJson(slicesOutputLockPath);
    check(slicesLock.schema === "personal-study-slices13-output-lock.v1"
      && Array.isArray(slicesLock.outputs) && slicesLock.outputs.length === 4, "PROBE_SLICES13_OUTPUT_LOCK");
    const slicesGeneratedPaths = slicesLock.outputs.map((record) => {
      check(typeof record.path === "string" && (
        record.path === "build/study-slices13-binding.json"
        || record.path === "src/study/generated-slices13.js"
        || /^public\/study\/provenance\/(goodrich-ch4-ex6-harmonic|rosen-1-3-ex5-6)\.json$/.test(record.path)
      ), "PROBE_SLICES13_OUTPUT_PATH");
      return record.path;
    });
    const inputs = new Set([...publicProjectionPaths, ...generatedPaths, ...slicesGeneratedPaths, "build/study-source-output-lock.json", "build/study-slices13-output-lock.json"]);
    for (const name of inputs) {
      const from = checkedPublicFile(name);
      const to = join(probeRoot, name);
      mkdirSync(resolve(to, ".."), { recursive: true });
      if (name === "CLAUDE.md") writeFileSync(to, publicSourceBytes(name));
      else cpSync(from, to);
    }
    symlinkSync(join(root, "node_modules"), join(probeRoot, "node_modules"), "dir");
    const result = spawnSync(process.execPath, [join(root, "tools/test-study-source-probes.mjs"), probeRoot], { cwd: probeRoot, encoding: "utf8" });
    check(result.status === 0, `ISOLATED_MUTATION_PROBES_${(result.stdout ?? "").trim()}${(result.stderr ?? "").trim()}`);
    check(`${result.stdout ?? ""}${result.stderr ?? ""}`.includes('"status":"PASS"'), "ISOLATED_MUTATION_PROBES_RECEIPT");
  } finally {
    rmSync(probeRoot, { recursive: true, force: true });
  }
}
runIsolatedMutationProbes();

const outputManifestSha256 = sha256(Buffer.from(outputFiles.map((record) => `${record.sha256}  ${record.path}\n`).join("")));
const finalBinding = readJson(bindingPath);
const allOutputPagesWithStudyLink = outputFiles
  .filter((record) => record.path.endsWith(".html"))
  .filter((record) => readFileSync(join(outputRoot, record.path), "utf8").includes(studyLink)).length;
const receipt = {
  schema: "personal-study-source-build-receipt.v1",
  status: "passed-normal-source-build",
  toolchain: { node: process.version, astro: finalBinding.dependencies.astro },
  sourceBinding: finalBinding,
  output: { files: outputFiles.length, htmlPages: outputFiles.filter((record) => record.path.endsWith(".html")).length, manifestSha256: outputManifestSha256 },
  baseline: { files: fixture.output.fileCount, htmlPages: fixture.output.htmlPages, manifestSha256: fixture.output.manifestSha256 },
  intentionalShellDelta: { studyLink: "/study/", baselinePagesWithStudyLink: fixture.shell.studyLinkBaselinePages, outputPagesWithStudyLink, allOutputPagesWithStudyLink, note: "The existing Study navigation link now points to the new static index; authored headings and ordinary articles were preserved." },
  publicProjection: { files: publicProjection.length, bytes: publicProjection.reduce((total, record) => total + record.bytes, 0), aggregateSha256: publicProjectionAggregate },
  checks: { baselineDependencyValues: true, baselineNonRootLockEntries: true, lockTopLevelFields: true, portablePublicFixture: true, publicProjectionManifest: true, outputPrivacyScan: scan, sourceGeneratorNoAmbientPath: true, optionalEditorIsland: true, ownedOutputDriftRefusal: true, danglingLeafAndAncestorRefusal: true, intentionalSourceChangeRebuild: true, isolatedMutationProbes: true },
  boundaries: { browser: "not run", publicRunner: "not activated", mathematicalCorrectness: "not claimed", nativePython: "not run by this build test" },
};
mkdirSync(join(root, "build"), { recursive: true });
writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify({ status: "PASS", output: receipt.output, intentionalShellDelta: receipt.intentionalShellDelta, receiptPath: "build/study-build-receipt.json" }));
