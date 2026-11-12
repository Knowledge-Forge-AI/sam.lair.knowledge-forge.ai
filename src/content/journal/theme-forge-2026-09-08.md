---
{
  "title": "Separating the theme engine from the theme",
  "description": "Stellar Loom, Terminal Nova and Nebular take distinct roles in a shared theme workflow.",
  "date": "2026-09-08",
  "updated": "2026-11-12",
  "category": "Theme Forge",
  "kind": "release",
  "releases": [
    "theme-forge-stellar-loom@v0.1.0",
    "starlight-theme-terminal-nova@v0.1.0",
    "theme-forge-nebular-fusion@v0.2.0"
  ],
  "sources": [
    {
      "label": "Theme Forge Stellar Loom v0.1.0",
      "url": "https://github.com/Knowledge-Forge-AI/theme-forge-stellar-loom/releases/tag/v0.1.0"
    },
    {
      "label": "Starlight Theme Terminal Nova v0.1.0",
      "url": "https://github.com/Knowledge-Forge-AI/starlight-theme-terminal-nova/releases/tag/v0.1.0"
    },
    {
      "label": "Theme Forge Nebular Fusion v0.2.0",
      "url": "https://github.com/Knowledge-Forge-AI/theme-forge-nebular-fusion/releases/tag/v0.2.0"
    }
  ]
}
---

With Stellar Loom 0.1.0, Terminal Nova 0.1.0 and Nebular 0.2.0, I gave the theme compiler, an installable documentation theme and the desktop review surface distinct jobs.

## What this release means to me

I want a consumer to be able to use the generated theme without needing the private development checkout or a compiler at runtime. That separation keeps the output useful outside the workbench that helped produce it.

## The release boundary

Loom compiles theme specifications into CSS, descriptors and independently consumable packages. Nebular 0.2.0 adds Theme Lab and portable review to the Apple Silicon app. Its ad-hoc signing and unnotarized developer distribution remain explicit.
