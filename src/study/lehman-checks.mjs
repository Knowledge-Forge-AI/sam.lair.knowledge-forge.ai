// SPDX-License-Identifier: AGPL-3.0-or-later
// Consumer-owned teaching checks; they inspect a completed bounded value.
export function isLessonInput(value) {
  return Number.isInteger(value) && value >= 0 && value <= 8;
}

function booleanRows(input, value) {
  if (!isLessonInput(input) || !Array.isArray(value) || value.length === 0 || value.length > 256) return null;
  return value.every(row => Array.isArray(row) && row.length === input && row.every(cell => typeof cell === "boolean")) ? value : null;
}

export const LEHMAN_CHECKS = Object.freeze([
  Object.freeze({
    id: "row-count",
    label: "Exactly 2^n rows (including one empty row for n = 0)",
    check: ({ input, value }) => isLessonInput(input) && Array.isArray(value) && value.length === 2 ** input,
  }),
  Object.freeze({
    id: "row-width",
    label: "Every row has n Boolean values",
    check: ({ input, value }) => booleanRows(input, value) !== null,
  }),
  Object.freeze({
    id: "unique-rows",
    label: "All returned rows are distinct",
    check: ({ input, value }) => {
      const rows = booleanRows(input, value);
      return rows !== null && new Set(rows.map(row => row.map(cell => cell ? "1" : "0").join(""))).size === rows.length;
    },
  }),
]);
