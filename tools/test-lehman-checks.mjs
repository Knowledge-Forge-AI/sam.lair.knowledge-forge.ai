// SPDX-License-Identifier: AGPL-3.0-or-later
import assert from "node:assert/strict";
import { LEHMAN_CHECKS, isLessonInput } from "../src/study/lehman-checks.mjs";
const results = (input, value) => LEHMAN_CHECKS.map(test => test.check({ input, value }));
let cases = 0;
for (let n = 0; n <= 8; n++) {
  const rows = Array.from({ length: 2 ** n }, (_, bits) => Array.from({ length: n }, (_, column) => Boolean(bits & (1 << column))));
  assert.deepEqual(results(n, rows), [true, true, true]); cases++;
}
for (const invalid of [-1, 9, 1.5, true, false, null, "4", {}, [], NaN, Infinity]) {
  assert.equal(isLessonInput(invalid), false);
  assert.deepEqual(results(invalid, [[]]), [false, false, false]); cases++;
}
for (const invalid of [undefined, null, {}, "rows", 0]) {
  assert.deepEqual(results(0, invalid), [false, false, false]); cases++;
}
assert.deepEqual(results(0, []), [false, false, false]); cases++;
assert.deepEqual(results(1, [[true], [true]]), [true, true, false]); cases++;
assert.deepEqual(results(1, [[true, false], [false, true]]), [true, false, false]); cases++;
assert.deepEqual(results(1, [[1], [0]]), [true, false, false]); cases++;
assert.deepEqual(results(1, [[true]]), [false, true, true]); cases++;
assert.deepEqual(results(8, Array.from({length:257},()=>Array(8).fill(false))), [false, false, false]); cases++;
assert.equal(Object.isFrozen(LEHMAN_CHECKS), true);
assert.equal(LEHMAN_CHECKS.every(Object.isFrozen), true);
console.log(JSON.stringify({status:"PASS", cases, checkCount:LEHMAN_CHECKS.length, scope:"teaching result predicates; no mathematical proof or runner execution"}));
