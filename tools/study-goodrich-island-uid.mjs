const TARGET_COMPONENT_URL = "/_astro/GoodrichCh4Ex6Interactive.DJUwVDno.js";
const TARGET_COMPONENT_EXPORT = "GoodrichCh4Ex6Interactive";
const NORMALIZED_UID = "GoodrichUid";
const MAX_HTML_CODE_UNITS = 2_000_000;
// Astro's installed shorthash uses a 61-character dictionary (0-9, a-z,
// A-Y) over a signed 32-bit integer. A non-negative result is at most six
// dictionary characters; a negative result adds one leading Z sign marker.
// This is only a bounded format check, not proof that a value was generated
// by Astro.
const UID_PATTERN = /^(?:[0-9a-zA-Y]{1,6}|Z[0-9a-zA-Y]{1,6})$/;

const fail = (code) => {
  throw new Error(code);
};

const isWhitespace = (value) => /\s/.test(value);
const isNameStart = (value) => /[A-Za-z_:]/.test(value);
const isNamePart = (value) => /[A-Za-z0-9:._-]/.test(value);

function validateInput(html) {
  if (typeof html !== "string") fail("HTML_TYPE");
  if (html.length === 0 || html.length > MAX_HTML_CODE_UNITS) fail("HTML_SIZE");
  if (html.charCodeAt(0) === 0xfeff) fail("HTML_BOM");
  for (let index = 0; index < html.length; index += 1) {
    const code = html.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = html.charCodeAt(index + 1);
      if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff) fail("HTML_ENCODING");
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      fail("HTML_ENCODING");
    }
  }
}

function scanAstroIslandTags(html) {
  const tags = [];
  const marker = "<astro-island";
  let cursor = 0;
  while (cursor < html.length) {
    const start = html.indexOf(marker, cursor);
    if (start < 0) break;
    const afterName = html[start + marker.length];
    if (afterName !== undefined && !isWhitespace(afterName) && afterName !== ">") {
      cursor = start + marker.length;
      continue;
    }
    let quote = null;
    let end = -1;
    for (let index = start + marker.length; index < html.length; index += 1) {
      const character = html[index];
      if (quote !== null) {
        if (character === quote) quote = null;
        continue;
      }
      if (character === '"' || character === "'") {
        quote = character;
      } else if (character === ">") {
        end = index;
        break;
      }
    }
    if (quote !== null || end < 0) fail("ASTRO_ISLAND_TAG_UNTERMINATED");
    tags.push({ start, end: end + 1, raw: html.slice(start, end + 1) });
    cursor = end + 1;
  }
  return tags;
}

function parseTag(raw) {
  const attributes = [];
  const seenNames = new Set();
  let cursor = "<astro-island".length;
  const end = raw.length - 1;
  while (cursor < end) {
    while (cursor < end && isWhitespace(raw[cursor])) cursor += 1;
    if (cursor >= end) break;
    if (raw[cursor] === "/") {
      cursor += 1;
      while (cursor < end && isWhitespace(raw[cursor])) cursor += 1;
      if (cursor !== end) fail("ASTRO_ISLAND_ATTR_SYNTAX");
      break;
    }
    if (!isNameStart(raw[cursor])) fail("ASTRO_ISLAND_ATTR_SYNTAX");
    const nameStart = cursor;
    cursor += 1;
    while (cursor < end && isNamePart(raw[cursor])) cursor += 1;
    const name = raw.slice(nameStart, cursor);
    const lowerName = name.toLowerCase();
    if (seenNames.has(lowerName)) fail("ASTRO_ISLAND_ATTR_DUPLICATE");
    seenNames.add(lowerName);
    while (cursor < end && isWhitespace(raw[cursor])) cursor += 1;
    let value = null;
    let valueStart = -1;
    let valueEnd = -1;
    if (raw[cursor] === "=") {
      cursor += 1;
      while (cursor < end && isWhitespace(raw[cursor])) cursor += 1;
      const quote = raw[cursor];
      if (quote !== '"' && quote !== "'") fail("ASTRO_ISLAND_ATTR_SYNTAX");
      cursor += 1;
      valueStart = cursor;
      while (cursor < end && raw[cursor] !== quote) cursor += 1;
      if (cursor >= end) fail("ASTRO_ISLAND_ATTR_UNTERMINATED");
      valueEnd = cursor;
      value = raw.slice(valueStart, valueEnd);
      cursor += 1;
    }
    attributes.push({ name, lowerName, value, valueStart, valueEnd });
  }
  return attributes;
}

function targetAttribute(attributes, name) {
  return attributes.find((attribute) => attribute.name === name) ?? null;
}

/**
 * Canonicalize the one known Goodrich Astro island UID after the existing
 * study CSS filename normalizer has run. This is a comparison fixture
 * transform, not a served HTML transform: the fixed UID is intentionally a
 * stable sentinel, while input UIDs must be bounded Astro-style alphanumerics.
 */
export function normalizeGoodrichIslandUid(html) {
  validateInput(html);
  const tags = scanAstroIslandTags(html);
  const targets = [];
  for (const tag of tags) {
    const attributes = parseTag(tag.raw);
    const componentUrl = targetAttribute(attributes, "component-url");
    const componentExport = targetAttribute(attributes, "component-export");
    if (componentUrl?.value !== TARGET_COMPONENT_URL || componentExport?.value !== TARGET_COMPONENT_EXPORT) continue;
    targets.push({ tag, attributes });
  }
  if (targets.length !== 1) fail("GOODRICH_TARGET_COUNT");
  const [{ tag, attributes }] = targets;
  const uidAttributes = attributes.filter((attribute) => attribute.lowerName === "uid");
  if (uidAttributes.length !== 1 || uidAttributes[0].name !== "uid") fail("GOODRICH_UID_COUNT");
  for (const attribute of attributes) {
    if (attribute.lowerName.includes("uid") && attribute.lowerName !== "uid") fail("GOODRICH_UID_LOOKALIKE");
  }
  const uid = uidAttributes[0];
  if (uid.value === null || !UID_PATTERN.test(uid.value)) fail("GOODRICH_UID_INVALID");
  const replacementStart = tag.start + uid.valueStart;
  const replacementEnd = tag.start + uid.valueEnd;
  return html.slice(0, replacementStart) + NORMALIZED_UID + html.slice(replacementEnd);
}
