---
{
  "title": "Taking Nebular to Linux",
  "description": "The workbench release covers Apple Silicon and both Linux architectures with separate channel claims.",
  "date": "2026-09-30",
  "updated": "2026-11-12",
  "category": "Theme Forge",
  "kind": "release",
  "releases": [
    "theme-forge-nebular-fusion@v0.6.1"
  ],
  "sources": [
    {
      "label": "Theme Forge Nebular Fusion 0.6.1",
      "url": "https://github.com/Knowledge-Forge-AI/theme-forge-nebular-fusion/releases/tag/v0.6.1"
    }
  ]
}
---

Nebular Fusion 0.6.1 extends the native workbench to Linux ARM64 and AMD64 alongside Apple Silicon. I wanted the growing target matrix to be backed by artifact identities and qualification records.

## What this release means to me

This is still a set of specific distribution claims. The macOS build is ad-hoc signed, Nix is withheld for this release and no 0.6.0 Nebular release is implied by the version sequence.

## The release boundary

The npm wrapper selects a matching native platform package. The release records the Apple Silicon Homebrew Formula route and attaches checksums and provenance connecting source, qualification and native artifacts. Developer ID signing and Gatekeeper qualification are not claimed.
