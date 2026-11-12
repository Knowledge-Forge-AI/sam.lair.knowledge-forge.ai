---
{
  "title": "Making qualification evidence portable",
  "description": "A strict CI summary contract and caller-owned adapters support composition with JACA XO.",
  "date": "2026-09-08",
  "updated": "2026-11-12",
  "category": "APGR",
  "kind": "release",
  "releases": [
    "agentic-praxis-grimoire@v0.9.0"
  ],
  "sources": [
    {
      "label": "v0.9.0",
      "url": "https://github.com/Knowledge-Forge-AI/agentic-praxis-grimoire/releases/tag/v0.9.0"
    }
  ]
}
---

In APGR 0.9.0, I gave integrations a machine-readable qualification summary. A caller should be able to identify the version, suite, source and gate result without guessing from a human-oriented log.

## What this release means to me

The caller-owned XO fixture demonstrates an integration boundary. It is not JACA’s production adapter, and JACA-side registration was still pending at this release. I want that limitation to remain legible.

## The release boundary

The summary carries version, subproject, suite, test status, gate status and source commit. Qualification distinguishes policy, unit, integration and combined roles. APGR supplies domain primitives; the consuming project owns its data types and orchestration.
