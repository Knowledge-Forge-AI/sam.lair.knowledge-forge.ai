---
{
  "title": "Making APGR useful as a library",
  "description": "A library-first Go surface and native packaging extend the existing CLI workflows.",
  "date": "2026-08-24",
  "updated": "2026-11-12",
  "category": "APGR",
  "kind": "release",
  "releases": [
    "agentic-praxis-grimoire@v0.7.0"
  ],
  "sources": [
    {
      "label": "v0.7.0",
      "url": "https://github.com/Knowledge-Forge-AI/agentic-praxis-grimoire/releases/tag/v0.7.0"
    }
  ]
}
---

With APGR 0.7.0, I moved toward a toolkit another system can embed. Public Go packages expose domain primitives while the command line keeps compatible Python adapters.

## What this release means to me

I care about that distinction because a useful library should not take ownership of its caller’s orchestration. Packaging and native execution also need their own proof; portable source alone does not establish a working distribution.

## The release boundary

The public packages expose schemas, reports, skill bundles, environment snapshots and structural hotspot analysis. Native Python wheels, an npm launcher and platform packages target Apple Silicon, Linux AMD64 and Linux ARM64; the records distinguish each distribution route.
