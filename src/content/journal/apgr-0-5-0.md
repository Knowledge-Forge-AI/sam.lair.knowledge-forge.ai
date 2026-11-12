---
{
  "title": "Giving the grimoire a command line",
  "description": "The Python CLI introduces explicit user/project configuration and report contracts.",
  "date": "2026-08-16",
  "updated": "2026-11-12",
  "category": "APGR",
  "kind": "release",
  "releases": [
    "agentic-praxis-grimoire@v0.5.0"
  ],
  "sources": [
    {
      "label": "v0.5.0",
      "url": "https://github.com/Knowledge-Forge-AI/agentic-praxis-grimoire/releases/tag/v0.5.0"
    }
  ]
}
---

This is where I introduced the apgr command-line name. A Python CLI made requests, configuration and recorded results more concrete than a loose collection of files, while preserving separate user and project ownership.

## What this release means to me

I want a tool’s interface to make its boundaries visible. A request, an outbox item and an accepted result each need an identity; one should not silently stand in for another.

## The release boundary

CSS, Markdown, JavaScript, TypeScript and Node.js profiles bring the library to thirty-three skills. Maturity remains specific to each skill, with the accepted CSS and JavaScript qualification debt retained. This release does not include a Nix deployment adapter.
