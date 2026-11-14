import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  readFileSync,
  renameSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.argv[2] ?? "");
if (!existsSync(join(root, "tools/build-study-source.mjs"))) throw new Error("PROBE_ROOT_MISSING");
const sourceBuilderPath = join(root, "tools/build-study-source.mjs");
const slicesBuilderPath = join(root, "tools/build-study-slices13.mjs");
const outputLockPath = join(root, "build/study-source-output-lock.json");
const bindingPath = join(root, "build/study-source-binding.json");
const slicesOutputLockPath = join(root, "build/study-slices13-output-lock.json");
const slicesBindingPath = join(root, "build/study-slices13-binding.json");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hashFile = (path) => sha256(readFileSync(path));
const check = (condition, code) => { if (!condition) throw new Error(code); };

function runSourceBuilder() {
  return spawnSync(process.execPath, [sourceBuilderPath], { cwd: root, encoding: "utf8" });
}

function runSlicesBuilder() {
  return spawnSync(process.execPath, [slicesBuilderPath], { cwd: root, encoding: "utf8" });
}

const ownedLockBeforeTests = readFileSync(outputLockPath);
const ownedRecords = JSON.parse(ownedLockBeforeTests).outputs;
check(Array.isArray(ownedRecords) && ownedRecords.length === 65, "OWNED_OUTPUT_SET");
const ownedSnapshot = new Map(ownedRecords.map((record) => [record.path, hashFile(join(root, record.path))]));

function expectDriftRefusal(relativePath, label) {
  const path = join(root, relativePath);
  const original = readFileSync(path);
  const tampered = Buffer.concat([original, Buffer.from("\nsource-drift-probe\n")]);
  try {
    writeFileSync(path, tampered);
    const result = runSourceBuilder();
    check(result.status !== 0, `${label}_DRIFT_ACCEPTED`);
    check(`${result.stdout ?? ""}${result.stderr ?? ""}`.includes("OWNED_DERIVATIVE_DRIFT"), `${label}_DRIFT_CODE`);
    check(readFileSync(path).equals(tampered), `${label}_DRIFT_REWRITTEN`);
    for (const [ownedPath, beforeHash] of ownedSnapshot) {
      if (ownedPath !== relativePath) check(hashFile(join(root, ownedPath)) === beforeHash, `${label}_OTHER_OUTPUT_WRITTEN`);
    }
    check(readFileSync(outputLockPath).equals(ownedLockBeforeTests), `${label}_LOCK_WRITTEN`);
  } finally {
    writeFileSync(path, original);
  }
  check(runSourceBuilder().status === 0, `${label}_UNCHANGED_REBUILD`);
}

function lstatPresent(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function expectDanglingLeafRefusal(relativePath, target, label, expectedCode) {
  check(lstatPresent(target) === null, `${label}_TARGET_PREEXISTING`);
  const path = join(root, relativePath);
  const original = readFileSync(path);
  try {
    unlinkSync(path);
    symlinkSync(target, path);
    const result = runSourceBuilder();
    check(result.status !== 0, `${label}_ACCEPTED`);
    check(`${result.stdout ?? ""}${result.stderr ?? ""}`.includes(expectedCode), `${label}_CODE`);
    check(lstatPresent(path)?.isSymbolicLink() === true && lstatPresent(target) === null, `${label}_TARGET_CREATED`);
    for (const [ownedPath, beforeHash] of ownedSnapshot) {
      if (ownedPath !== relativePath) check(hashFile(join(root, ownedPath)) === beforeHash, `${label}_OTHER_OUTPUT_WRITTEN`);
    }
    if (relativePath !== "build/study-source-output-lock.json") check(readFileSync(outputLockPath).equals(ownedLockBeforeTests), `${label}_LOCK_WRITTEN`);
  } finally {
    unlinkSync(path);
    writeFileSync(path, original);
  }
  check(readFileSync(outputLockPath).equals(ownedLockBeforeTests), `${label}_LOCK_RESTORED`);
  check(runSourceBuilder().status === 0, `${label}_RESTORE_REBUILD`);
}

expectDriftRefusal("src/study/generated-study.js", "GENERATED_MODULE");
expectDriftRefusal(JSON.parse(readFileSync(bindingPath, "utf8")).generated.katex.fonts[0].path, "KATEX_FONT");
expectDriftRefusal("public/study/provenance/lehman-ch3-p4.json", "PUBLISHED_PROVENANCE");

const custodyParent = resolve(root, "..");
expectDanglingLeafRefusal("src/study/generated-study.js", join(custodyParent, ".study-source-dangling-leaf-v1"), "DANGLING_LEAF", "OWNED_DERIVATIVE_SYMLINK");
expectDanglingLeafRefusal("build/study-source-output-lock.json", join(custodyParent, ".study-source-dangling-lock-v1"), "DANGLING_LOCK", "OWNED_DERIVATIVE_SYMLINK");

check(existsSync(slicesBuilderPath) && existsSync(slicesBindingPath) && existsSync(slicesOutputLockPath), "SLICES13_PROBE_INPUT_MISSING");
const slicesLockBeforeTests = readFileSync(slicesOutputLockPath);
const slicesRecords = JSON.parse(slicesLockBeforeTests).outputs;
check(Array.isArray(slicesRecords) && slicesRecords.length === 4, "SLICES13_PROBE_OUTPUT_SET");
const slicesSnapshot = new Map(slicesRecords.map((record) => [record.path, hashFile(join(root, record.path))]));

function expectSlicesDriftRefusal(relativePath, label) {
  const path = join(root, relativePath);
  const original = readFileSync(path);
  const tampered = Buffer.concat([original, Buffer.from("\nslices13-drift-probe\n")]);
  try {
    writeFileSync(path, tampered);
    const result = runSlicesBuilder();
    check(result.status !== 0, `${label}_DRIFT_ACCEPTED`);
    check(`${result.stdout ?? ""}${result.stderr ?? ""}`.includes("SLICES13_OWNED_DERIVATIVE_DRIFT"), `${label}_DRIFT_CODE`);
    check(readFileSync(path).equals(tampered), `${label}_DRIFT_REWRITTEN`);
    for (const [ownedPath, beforeHash] of slicesSnapshot) {
      if (ownedPath !== relativePath) check(hashFile(join(root, ownedPath)) === beforeHash, `${label}_OTHER_OUTPUT_WRITTEN`);
    }
    if (relativePath !== "build/study-slices13-output-lock.json") check(readFileSync(slicesOutputLockPath).equals(slicesLockBeforeTests), `${label}_LOCK_WRITTEN`);
  } finally {
    writeFileSync(path, original);
  }
  check(runSlicesBuilder().status === 0, `${label}_UNCHANGED_REBUILD`);
}

expectSlicesDriftRefusal("src/study/generated-slices13.js", "SLICES13_GENERATED_MODULE");
expectSlicesDriftRefusal("public/study/provenance/goodrich-ch4-ex6-harmonic.json", "SLICES13_GOODRICH_PROVENANCE");

function expectSlicesDanglingLeafRefusal(relativePath, target, label) {
  check(lstatPresent(target) === null, `${label}_TARGET_PREEXISTING`);
  const path = join(root, relativePath);
  const original = readFileSync(path);
  try {
    unlinkSync(path);
    symlinkSync(target, path);
    const result = runSlicesBuilder();
    check(result.status !== 0, `${label}_ACCEPTED`);
    check(`${result.stdout ?? ""}${result.stderr ?? ""}`.includes("SLICES13_OWNED_OUTPUT_SYMLINK"), `${label}_CODE`);
    check(lstatPresent(path)?.isSymbolicLink() === true && lstatPresent(target) === null, `${label}_TARGET_CREATED`);
    for (const [ownedPath, beforeHash] of slicesSnapshot) {
      if (ownedPath !== relativePath) check(hashFile(join(root, ownedPath)) === beforeHash, `${label}_OTHER_OUTPUT_WRITTEN`);
    }
    if (relativePath !== "build/study-slices13-output-lock.json") check(readFileSync(slicesOutputLockPath).equals(slicesLockBeforeTests), `${label}_LOCK_WRITTEN`);
  } finally {
    unlinkSync(path);
    writeFileSync(path, original);
  }
  check(readFileSync(slicesOutputLockPath).equals(slicesLockBeforeTests), `${label}_LOCK_RESTORED`);
  check(runSlicesBuilder().status === 0, `${label}_RESTORE_REBUILD`);
}

expectSlicesDanglingLeafRefusal("src/study/generated-slices13.js", join(custodyParent, ".study-slices13-dangling-leaf-v1"), "SLICES13_DANGLING_LEAF");
expectSlicesDanglingLeafRefusal("build/study-slices13-output-lock.json", join(custodyParent, ".study-slices13-dangling-lock-v1"), "SLICES13_DANGLING_LOCK");

const fontDirectory = join(root, "public/study/fonts");
const fontDirectoryBackup = join(root, "public/study/.fonts-custody-backup-v1");
const fontDirectoryTarget = join(custodyParent, ".study-source-dangling-font-directory-v1");
check(lstatPresent(fontDirectoryBackup) === null && lstatPresent(fontDirectoryTarget) === null, "DANGLING_FONT_SETUP");
renameSync(fontDirectory, fontDirectoryBackup);
try {
  symlinkSync(fontDirectoryTarget, fontDirectory);
  const result = runSourceBuilder();
  check(result.status !== 0, "DANGLING_FONT_ANCESTOR_ACCEPTED");
  check(`${result.stdout ?? ""}${result.stderr ?? ""}`.includes("OWNED_ANCESTOR_SYMLINK"), "DANGLING_FONT_ANCESTOR_CODE");
  check(lstatPresent(fontDirectory)?.isSymbolicLink() === true && lstatPresent(fontDirectoryTarget) === null, "DANGLING_FONT_TARGET_CREATED");
  for (const [ownedPath, beforeHash] of ownedSnapshot) {
    if (!ownedPath.startsWith("public/study/fonts/")) check(hashFile(join(root, ownedPath)) === beforeHash, "DANGLING_FONT_OTHER_OUTPUT_WRITTEN");
  }
  check(readFileSync(outputLockPath).equals(ownedLockBeforeTests), "DANGLING_FONT_LOCK_WRITTEN");
} finally {
  unlinkSync(fontDirectory);
  renameSync(fontDirectoryBackup, fontDirectory);
}
check(runSourceBuilder().status === 0, "DANGLING_FONT_RESTORE_REBUILD");

const lessonPath = join(root, "src/study/lehman-ch3-p4.mdx");
const provenancePath = join(root, "src/study/lehman-ch3-p4.provenance.json");
const originalLesson = readFileSync(lessonPath);
const originalProvenance = readFileSync(provenancePath);
const originalBinding = JSON.parse(readFileSync(bindingPath, "utf8"));
const changedLesson = Buffer.concat([originalLesson, Buffer.from("\n\nSource pipeline probe paragraph.\n")]);
const changedProvenance = JSON.parse(originalProvenance);
const lessonRecord = (changedProvenance.materialized_files ?? []).find((record) => record.path === "src/study/lehman-ch3-p4.mdx");
check(lessonRecord !== undefined, "SOURCE_CHANGE_PROVENANCE_RECORD");
lessonRecord.sha256 = sha256(changedLesson);
try {
  writeFileSync(lessonPath, changedLesson);
  writeFileSync(provenancePath, JSON.stringify(changedProvenance, null, 2) + "\n");
  const changedBuild = runSourceBuilder();
  check(changedBuild.status === 0, "SOURCE_CHANGE_REJECTED");
  const changedBinding = JSON.parse(readFileSync(bindingPath, "utf8"));
  check(changedBinding.source.lessonSha256 === sha256(changedLesson), "SOURCE_CHANGE_NOT_BOUND");
  check(changedBinding.generated.studyModule.sha256 !== originalBinding.generated.studyModule.sha256, "SOURCE_CHANGE_NO_DERIVATIVE_UPDATE");
} finally {
  writeFileSync(lessonPath, originalLesson);
  writeFileSync(provenancePath, originalProvenance);
}
check(runSourceBuilder().status === 0, "SOURCE_RESTORE_REJECTED");
console.log(JSON.stringify({ status: "PASS", scope: "isolated-source-copy-and-slices13" }));
