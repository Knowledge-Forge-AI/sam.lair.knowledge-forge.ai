---
{
  "title": "Qualifying the application where it runs",
  "description": "The three supported desktop targets receive their own build and packaged-consumer qualification.",
  "date": "2026-10-29",
  "updated": "2026-11-12",
  "category": "Theme Forge",
  "kind": "release",
  "releases": [
    "theme-forge-nebular-fusion@v0.7.0"
  ],
  "sources": [
    {
      "label": "Nebular Fusion v0.7.0",
      "url": "https://github.com/Knowledge-Forge-AI/theme-forge-nebular-fusion/releases/tag/v0.7.0"
    }
  ]
}
---

For Nebular 0.7.0, I used the matching public native environments for the three supported desktop targets. A source test and a packaged application scenario are different pieces of the release.

## What this release means to me

The connection I care about is between a frozen artifact and a real consumer. Native build records, application lifecycle checks and hashes let that connection be traced instead of inferred from portable code.

## The release boundary

The release corrects plan-authority notifications across initial mount and StrictMode replay, strengthens native graphics-provider authentication and prepares gallery themes from locked inputs. Native archives and npm-format packages cover all three targets, with Bookworm used for Linux qualification.
