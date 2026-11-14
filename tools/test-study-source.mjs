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
const receiptPath = join(root, "build/study-build-receipt.json");
const packageJsonPath = join(root, "package.json");
const packageLockPath = join(root, "package-lock.json");
const fixturePath = join(root, "test/fixtures/study-baseline.v1.json");
const sourceBuilderPath = join(root, "tools/build-study-source.mjs");

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

check(packageJson.scripts.build === "node tools/build-study-source.mjs && astro build", "NORMAL_BUILD_PIPELINE");
for (const forbidden of ["/Users/", "/home/", "pinnedNode", "astroClosure", "knowledge-forge.github.io", "study-components-package1"]) check(!sourceBuild.includes(forbidden), "SOURCE_BUILDER_AMBIENT_PATH");
check(fixture.schema === "personal-study-public-fixture.v1", "PUBLIC_FIXTURE_SCHEMA");
for (const forbiddenPath of ["tools/private", "research", "study-pilot-binding.json"]) check(!existsSync(join(root, forbiddenPath)), `PUBLIC_PRIVATE_PATH_${forbiddenPath}`);
check(existsSync(sourceBuilderPath) && existsSync(join(root, "tools/test-study-source.mjs")), "PUBLIC_TEST_FILES_MISSING");
const publicProjectionPaths = fixture.publicProjectionPaths;
check(Array.isArray(publicProjectionPaths) && publicProjectionPaths.includes("tools/test-study-source.mjs"), "PUBLIC_PROJECTION_PATH_LIST");
// The verifier is included in the explicit public path list but omitted from this aggregate to avoid a self-hash cycle.
const publicProjection = explicitPublicProjection(publicProjectionPaths)
  .filter((record) => record.path !== "tools/test-study-source.mjs");
const publicProjectionAggregate = sha256(Buffer.from(publicProjection.map((record) => `${record.sha256}  ${record.path}\n`).join("")));
check(publicProjection.length === 118 && publicProjection.reduce((total, record) => total + record.bytes, 0) === 965999 && publicProjectionAggregate === "be94db8ab2a097088446990c61867058a41dbbe57ab0685ba6d8c9d15ad353ad", "PUBLIC_PROJECTION_MANIFEST");
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

const outputFiles = walkFiles(outputRoot);
const outputByPath = new Map(outputFiles.map((record) => [record.path, record]));
check(outputFiles.length === 145, "OUTPUT_FILE_COUNT");
check(outputFiles.filter((record) => record.path.endsWith(".html")).length === 44, "OUTPUT_HTML_COUNT");
check(fixture.output.fileCount === 77 && fixture.output.htmlPages === 43, "BASELINE_OUTPUT_FACTS");
check(sha256(Buffer.from(fixture.output.nonGeneratedPaths.join("\n") + "\n")) === fixture.output.nonGeneratedPathsSha256, "BASELINE_OUTPUT_PATHS_HASH");
for (const path of fixture.output.nonGeneratedPaths) check(outputByPath.has(path), `BASELINE_OUTPUT_MISSING_${path}`);
for (const [path, expectedHash] of Object.entries(fixture.output.authoredHeadingSha256)) {
  check(outputByPath.has(path), `BASELINE_HEADING_PATH_${path}`);
  const actual = authoredHeadings(readFileSync(join(outputRoot, path), "utf8"));
  check(sha256(Buffer.from(JSON.stringify(actual))) === expectedHash, `AUTHORED_HEADING_${path}`);
}

const studyLink = 'href="/study/lehman-ch3-p4/"';
let outputPagesWithStudyLink = 0;
check(fixture.shell.studyLinkBaselinePages === 0, "BASELINE_STUDY_LINK_PRESENT");
for (const record of outputFiles.filter((item) => item.path.endsWith(".html"))) {
  const outputHtml = readFileSync(join(outputRoot, record.path), "utf8");
  if (outputHtml.includes(studyLink)) outputPagesWithStudyLink += 1;
}
check(outputPagesWithStudyLink === 38, "OUTPUT_STUDY_LINK_COUNT");
const studyRoute = readFileSync(join(outputRoot, "study/lehman-ch3-p4/index.html"), "utf8");
check(studyRoute.includes('aria-current="page"') && studyRoute.includes(studyLink), "STUDY_LINK_ACTIVE");
check(studyRoute.includes("data-study-kind=\"proof\"") && studyRoute.includes("data-study-kind=\"subproof\""), "STUDY_PROOF_MARKERS");
check(studyRoute.includes('data-study-code-include="lehman-truth-assignments"'), "STUDY_CODE_INCLUDE");
check(studyRoute.includes('class="study-editor-disabled"') && !studyRoute.includes("Activate optional editor"), "EDITOR_DISABLED");
check(studyRoute.includes("http://www.w3.org/1998/Math/MathML"), "STUDY_MATHML");
for (const forbidden of ["new Worker", "fetch(", "pyodide"]) check(!studyRoute.includes(forbidden), `STUDY_RUNTIME_MARKER_${forbidden}`);
for (const href of ["/study/content-terms.md", "/study/provenance/lehman-ch3-p4.json", "/study/licenses/katex-LICENSE.txt", "/study/licenses/lehman-GPL-3.0.txt"]) check(studyRoute.includes(`href=\"${href}\"`), `STUDY_LINK_${href}`);

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
    const inputs = new Set([...publicProjectionPaths, ...generatedPaths, "build/study-source-output-lock.json"]);
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
  intentionalShellDelta: { studyLink: "/study/lehman-ch3-p4/", baselinePagesWithStudyLink: fixture.shell.studyLinkBaselinePages, outputPagesWithStudyLink, allOutputPagesWithStudyLink, note: "One discoverable Study navigation link was added to the existing site shell; no landing page was added and authored headings were preserved." },
  publicProjection: { files: publicProjection.length, bytes: publicProjection.reduce((total, record) => total + record.bytes, 0), aggregateSha256: publicProjectionAggregate },
  checks: { baselineDependencyValues: true, baselineNonRootLockEntries: true, lockTopLevelFields: true, portablePublicFixture: true, publicProjectionManifest: true, outputPrivacyScan: scan, sourceGeneratorNoAmbientPath: true, editorDisabled: true, ownedOutputDriftRefusal: true, danglingLeafAndAncestorRefusal: true, intentionalSourceChangeRebuild: true, isolatedMutationProbes: true },
  boundaries: { browser: "not run", publicRunner: "not activated", mathematicalCorrectness: "not claimed", nativePython: "not run by this build test" },
};
mkdirSync(join(root, "build"), { recursive: true });
writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify({ status: "PASS", output: receipt.output, intentionalShellDelta: receipt.intentionalShellDelta, receiptPath: "build/study-build-receipt.json" }));
