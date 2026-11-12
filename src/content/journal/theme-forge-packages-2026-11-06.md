---
{
  "title": "Connecting the releases to signed Linux repositories",
  "description": "APT, DNF and pacman connect the qualified family artifacts to familiar package managers.",
  "date": "2026-11-06",
  "updated": "2026-11-12",
  "category": "Distribution",
  "kind": "milestone",
  "releases": [],
  "sources": [
    {
      "label": "Signed repository publication receipt and architecture inventory",
      "url": "https://github.com/Knowledge-Forge-AI/theme-forge-packages/releases/tag/packages-current-202611"
    },
    {
      "label": "Production repository deployment for the 0.7.1 generation",
      "url": "https://github.com/Knowledge-Forge-AI/theme-forge-packages/actions/runs/42154056906"
    },
    {
      "label": "Theme Forge package service",
      "url": "https://tf.rs9.knowledge-forge.ai/"
    }
  ]
}
---

I brought the 0.7.1 generation to the project-operated APT, DNF and pacman repositories. Release Starport 9 connects the independently versioned upstream products to this package distribution layer.

## What this milestone means to me

I want the signing certificate, package signatures and publication receipt to remain visible. These are our repositories; this milestone does not claim acceptance into Debian, Fedora or Arch’s official repositories, or an AUR submission.

## The release boundary

The service at tf.rs9.knowledge-forge.ai covers both Linux architectures, including pacman AArch64. Repository metadata and package signatures bind to the qualified inputs; products retain their independent upstream identities.
