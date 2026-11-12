---
{
  "title": "Respecting an immutable installation",
  "description": "A narrow verification correction accepts Nix permissions while retaining content and executable identity checks.",
  "date": "2026-10-31",
  "updated": "2026-11-12",
  "category": "Theme Forge",
  "kind": "release",
  "releases": [
    "theme-forge-nebular-fusion@v0.7.1"
  ],
  "sources": [
    {
      "label": "Theme Forge Nebular Fusion 0.7.1",
      "url": "https://github.com/Knowledge-Forge-AI/theme-forge-nebular-fusion/releases/tag/v0.7.1"
    }
  ]
}
---

I prepared Nebular 0.7.1 to accept Nix’s removal of write bits while keeping content hashes, inventory and pre-spawn executable checks. An immutable installation should not be mistaken for tampered content.

## What this release means to me

The release also updates the embedded Node runtime. It does not collapse the remaining Python, Homebrew, Nix or Linux repository publication work into one success claim; I track those channels separately.

## The release boundary

Embedded Node moves to 22.23.4 in response to findings against 22.23.3. Native downloads cover Apple Silicon and both Linux architectures; Linux uses the host’s WebKitGTK 4.1 and GTK3. AUR publication remains a separate deferred step.
