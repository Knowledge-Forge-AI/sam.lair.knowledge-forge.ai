import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { normalizeGoodrichIslandUid, normalizeGoodrichTypescriptSuccessorUid } from "./study-goodrich-island-uid.mjs";

const root = resolve(process.argv[2] ?? fileURLToPath(new URL("..", import.meta.url)));
const relativeInput = "dist/study/goodrich-ch4-ex6-harmonic/index.html";
const input = readFileSync(join(root, relativeInput), "utf8");
assert(process.argv.length <= 5 && [undefined, "--typescript-successor"].includes(process.argv[3]));
const successor = process.argv[3] === "--typescript-successor";
assert(process.argv[4] === undefined || (successor && process.argv[4] === "--keyboard-semantics"));
const policy = successor
  ? JSON.parse(readFileSync(join(root, "test/fixtures/study-typescript-successor.v1.json"), "utf8")).goodrichUidPolicy
  : {
    targetComponentUrl: "/_astro/GoodrichCh4Ex6Interactive.DJUwVDno.js",
    targetRendererUrl: "/_astro/client.Ccwj8Duh.js",
    targetComponentExport: "GoodrichCh4Ex6Interactive",
    normalizedStudyCssThenUidBytes: 24748,
    normalizedStudyCssThenUidSha256: "7a03303074df77fe49e7600a0fb87fcdeac8dfb610df1bf31b282e9bc1ef0b91",
  };
const { targetComponentUrl: targetUrl, targetComponentExport: targetExport } = policy;
const normalizeIslandUid = successor ? normalizeGoodrichTypescriptSuccessorUid : normalizeGoodrichIslandUid;

const sha256 = (text) => createHash("sha256").update(text).digest("hex");
let expected = { bytes: policy.normalizedStudyCssThenUidBytes, sha256: policy.normalizedStudyCssThenUidSha256 };
if (process.argv[4] === "--keyboard-semantics") {
  const fixture = readFileSync(join(root, "test/fixtures/study-keyboard-semantics.v1.json"));
  assert.equal(sha256(fixture), "7c57ef87e1d1420a26c2ce2399ebf40e9d238cb327a6bf908a0ddafc86d72394");
  expected = JSON.parse(fixture).byHost[process.platform + "/" + process.arch].normalized[relativeInput.slice(5)];
}
const canonicalSha256 = expected.sha256;

function normalizeStudyCssFilenames(html) {
  const matches = [...html.matchAll(/\/_astro\/study\.[A-Za-z0-9_-]+\.css/g)];
  assert.equal(matches.length, 1, "fixture must contain exactly one study CSS link");
  return html.replace(/\/_astro\/study\.[A-Za-z0-9_-]+\.css/g, "/_astro/study.CONTENT.css");
}

function targetTag(html) {
  const tag = html.match(/<astro-island\b[^>]*GoodrichCh4Ex6Interactive[^>]*>/)?.[0];
  assert.ok(tag, "target island tag missing");
  return tag;
}

function uidFromTarget(html) {
  return targetTag(html).match(/\buid="([^"]+)"/)?.[1];
}

function replaceOne(html, needle, replacement) {
  const index = html.indexOf(needle);
  assert.notEqual(index, -1, `fixture marker missing: ${needle}`);
  assert.equal(html.indexOf(needle, index + needle.length), -1, `fixture marker duplicated: ${needle}`);
  return html.slice(0, index) + replacement + html.slice(index + needle.length);
}

function replaceFirstInTarget(html, needle, replacement) {
  const tag = targetTag(html);
  const tagStart = html.indexOf(tag);
  const localIndex = tag.indexOf(needle);
  assert.notEqual(localIndex, -1, `target marker missing: ${needle}`);
  const changedTag = tag.slice(0, localIndex) + replacement + tag.slice(localIndex + needle.length);
  return html.slice(0, tagStart) + changedTag + html.slice(tagStart + tag.length);
}

function replaceFirstInTargetBody(html, needle, replacement) {
  const tag = targetTag(html);
  const tagStart = html.indexOf(tag);
  const bodyIndex = html.indexOf(needle, tagStart + tag.length);
  assert.notEqual(bodyIndex, -1, `target body marker missing: ${needle}`);
  return html.slice(0, bodyIndex) + replacement + html.slice(bodyIndex + needle.length);
}

function replaceTargetUid(html, uid) {
  const current = uidFromTarget(html);
  assert.ok(current, "target UID missing");
  return replaceOne(html, `uid="${current}"`, `uid="${uid}"`);
}

function assertRejectsCode(fn, code) {
  assert.throws(fn, (error) => error instanceof Error && error.message === code);
}

const cssNormalized = normalizeStudyCssFilenames(input);
assert.equal(targetTag(cssNormalized).includes(`component-url="${targetUrl}"`), true);
assert.equal(targetTag(cssNormalized).includes(`component-export="${targetExport}"`), true);
const canonical = normalizeIslandUid(cssNormalized);
assert.equal(Buffer.byteLength(canonical), expected.bytes);
assert.equal(sha256(canonical), canonicalSha256);
assertRejectsCode(
  () => (successor ? normalizeGoodrichIslandUid : normalizeGoodrichTypescriptSuccessorUid)(cssNormalized),
  "GOODRICH_TARGET_COUNT",
);

for (const syntheticUid of ["a", "ZQdqUu"]) {
  assert.equal(sha256(normalizeIslandUid(replaceTargetUid(cssNormalized, syntheticUid))), canonicalSha256);
}

for (const [label, changed] of [
  ["props", replaceFirstInTarget(cssNormalized, "maximum=MAX_N", "maximum=MAX_CHANGED")],
  ["renderer", replaceFirstInTarget(cssNormalized, `renderer-url="${policy.targetRendererUrl}"`, 'renderer-url="/_astro/client.changed.js"')],
  ["ssr", replaceFirstInTarget(cssNormalized, " ssr client=", ' ssr="changed" client=')],
  ["body", replaceFirstInTargetBody(cssNormalized, "Optional Goodrich Python editor", "Changed Goodrich Python editor")],
]) {
  assert.notEqual(sha256(normalizeIslandUid(changed)), canonicalSha256, `${label} change was hidden`);
}

assertRejectsCode(
  () => normalizeIslandUid(replaceOne(cssNormalized, targetUrl, "/_astro/OtherInteractive.js")),
  "GOODRICH_TARGET_COUNT",
);
assertRejectsCode(
  () => normalizeIslandUid(replaceOne(cssNormalized, `component-export="${targetExport}"`, 'component-export="OtherExport"')),
  "GOODRICH_TARGET_COUNT",
);
const currentUid = uidFromTarget(cssNormalized);
assertRejectsCode(
  () => normalizeIslandUid(replaceOne(cssNormalized, `uid="${currentUid}"`, `uid="${currentUid}" uid="${currentUid}"`)),
  "ASTRO_ISLAND_ATTR_DUPLICATE",
);
assertRejectsCode(
  () => normalizeIslandUid(replaceOne(cssNormalized, `uid="${currentUid}"`, "")),
  "GOODRICH_UID_COUNT",
);
assertRejectsCode(
  () => normalizeIslandUid(replaceOne(cssNormalized, `uid="${currentUid}"`, `uid="${currentUid}-x"`)),
  "GOODRICH_UID_INVALID",
);

console.log(JSON.stringify({
  status: "PASS",
  scope: "actual Goodrich dist HTML plus synthetic UID/control mutations",
  actualInput: relativeInput,
  syntheticControls: ["uid", "props", "renderer", "ssr", "body", "componentURL", "componentExport", "duplicateUID", "missingUID"],
  servedRuntimeOutput: false,
}));
