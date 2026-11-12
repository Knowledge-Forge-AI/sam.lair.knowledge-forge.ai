---
{
  "title": "Keeping the forge engines independently installable",
  "description": "Burst 0.7.0, Loom 0.5.0 and Solar Sail 0.3.0 keep the engines independently installable.",
  "date": "2026-10-26",
  "updated": "2026-11-12",
  "category": "Theme Forge",
  "kind": "release",
  "releases": [
    "theme-forge-stellar-burst@v0.7.0",
    "theme-forge-stellar-loom@v0.5.0",
    "theme-forge-solar-sail@v0.3.0"
  ],
  "sources": [
    {
      "label": "Theme Forge Stellar Burst v0.7.0",
      "url": "https://github.com/Knowledge-Forge-AI/theme-forge-stellar-burst/releases/tag/v0.7.0"
    },
    {
      "label": "theme-forge-stellar-loom 0.5.0",
      "url": "https://github.com/Knowledge-Forge-AI/theme-forge-stellar-loom/releases/tag/v0.5.0"
    },
    {
      "label": "theme-forge-solar-sail 0.3.0",
      "url": "https://github.com/Knowledge-Forge-AI/theme-forge-solar-sail/releases/tag/v0.3.0"
    }
  ]
}
---

I advanced Burst to 0.7.0, Loom to 0.5.0 and Solar Sail to 0.3.0. The engines keep separate versions so their users can consume the compiler or library they need without adopting the whole workbench.

## What this release means to me

I want source, package inventory and provenance to agree on identity. Registry publication and wheel qualification still need their own records; a family release announcement cannot substitute for them.

## The release boundary

Burst retains deterministic SVG compilation, transactional installation and drift checks. Loom supplies the documentation-theme engine; Solar Sail supplies Tailwind and shadcn compilation and aligns compiler descriptors, provenance and CLI version.
