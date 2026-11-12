---
{
  "title": "Looking before importing",
  "description": "Archive analysis and a richer vector model make supported, unsupported and unsafe inputs distinguishable.",
  "date": "2026-08-24",
  "updated": "2026-11-12",
  "category": "Theme Forge",
  "kind": "release",
  "releases": [
    "theme-forge-stellar-burst@v0.3.0"
  ],
  "sources": [
    {
      "label": "v0.3.0",
      "url": "https://github.com/Knowledge-Forge-AI/theme-forge-stellar-burst/releases/tag/v0.3.0"
    }
  ]
}
---

I added pre-import analysis in Burst 0.3.0 to keep different outcomes distinct. An asset that can be imported, one that needs normalization, an unsupported construct and an unsafe input should not all become the same generic failure.

## What this release means to me

The boundary matters more than an impressive format checklist. I would rather expose a precise limit than make a broad import claim that hides transformations or quietly drops information.

## The release boundary

The pre-import report classifies directly importable, normalization-needed, unsupported and unsafe entries before adoption. The richer vector model does not remove the compiler’s explicit input limits.
