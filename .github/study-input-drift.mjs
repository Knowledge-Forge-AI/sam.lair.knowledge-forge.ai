import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const SCHEMA = "study-ci-tracked-input-drift-v2";
const MAX_STATUS_BYTES = 64 * 1024;
const PHASES = new Set(["install", "build"]);
const CATEGORY_PATHS = Object.freeze({
  lock: Object.freeze(["package-lock.json"]),
  package: Object.freeze(["package.json"]),
  tsconfig: Object.freeze(["tsconfig.json"]),
  other: Object.freeze([".", ":(exclude)package-lock.json", ":(exclude)package.json", ":(exclude)tsconfig.json"]),
});

const emptyCategories = () => ({
  lock: false,
  package: false,
  tsconfig: false,
  other: false,
  "inspection-refused": false,
});

export function classifyExit(result) {
  if (!result || result.error || result.signal !== null && result.signal !== undefined) return "inspection-refused";
  if (result.status === 0) return "unchanged";
  if (result.status === 1) return "changed";
  if (Number.isInteger(result.status) && result.status > 1) return "inspection-refused";
  return "inspection-refused";
}

function invokeRunner(runner, args) {
  try {
    return runner(args);
  } catch {
    return { error: true };
  }
}

export function classifyPhase(phase, runner) {
  const categories = emptyCategories();
  if (!PHASES.has(phase) || typeof runner !== "function") {
    categories["inspection-refused"] = true;
    return { status: "inspection-refused", phase: "unknown", categories };
  }
  for (const [category, paths] of Object.entries(CATEGORY_PATHS)) {
    const result = invokeRunner(runner, ["-c", "core.fsmonitor=false", "diff", "--quiet", "--no-ext-diff", "--no-textconv", "--exit-code", "--", ...paths]);
    const classification = classifyExit(result);
    if (classification === "changed") categories[category] = true;
    if (classification === "inspection-refused") categories["inspection-refused"] = true;
  }
  const statusResult = invokeRunner(runner, ["-c", "core.fsmonitor=false", "status", "--porcelain=v1", "--untracked-files=no"]);
  const statusClassification = classifyExit(statusResult);
  if (statusClassification !== "unchanged"
    || typeof statusResult.stdout !== "string"
    || Buffer.byteLength(statusResult.stdout, "utf8") > MAX_STATUS_BYTES) {
    categories["inspection-refused"] = true;
  } else if (statusResult.stdout.length > 0 && !Object.entries(categories).some(([key, value]) => key !== "inspection-refused" && value)) {
    categories["inspection-refused"] = true;
  }
  const drift = Object.entries(categories).some(([key, value]) => key !== "inspection-refused" && value);
  return {
    status: categories["inspection-refused"] ? "inspection-refused" : drift ? "drift-detected" : "passed",
    phase,
    categories,
  };
}

function runGit(args) {
  return spawnSync("git", args, {
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    encoding: "utf8",
    maxBuffer: MAX_STATUS_BYTES,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 15000,
  });
}

function emit(result) {
  process.stdout.write(`${JSON.stringify({ schema: SCHEMA, ...result })}\n`);
  process.exitCode = result.status === "passed" ? 0 : 1;
}

function main() {
  const [phase] = process.argv.slice(2);
  if (!PHASES.has(phase)) {
    const categories = emptyCategories();
    categories["inspection-refused"] = true;
    emit({ status: "inspection-refused", phase: "unknown", categories });
    return;
  }
  emit(classifyPhase(phase, runGit));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main();
