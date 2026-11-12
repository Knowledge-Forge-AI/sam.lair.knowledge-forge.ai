---
{
  "title": "Starting the forge with inspectable vectors",
  "description": "A declarative SVG compiler brings repeatability and lifecycle checks to vector assets.",
  "date": "2026-08-22",
  "updated": "2026-11-12",
  "category": "Theme Forge",
  "kind": "release",
  "releases": [
    "theme-forge-stellar-burst@v0.1.0"
  ],
  "sources": [
    {
      "label": "v0.1.0",
      "url": "https://github.com/Knowledge-Forge-AI/theme-forge-stellar-burst/releases/tag/v0.1.0"
    }
  ]
}
---

I began Stellar Burst with a small asset pipeline: a human-editable TOML description, deterministic SVG output and an installation record. I wanted the generated vector and the explanation of how it arrived to travel together.

## What this release means to me

That is the seed of Theme Forge for me. Visual tooling should support inspection and repeatable changes, while remaining honest about the bounded set of constructs its compiler actually understands.

## The release boundary

Version 0.1.0 compiles a bounded SVG model from TOML and records deterministic output. The declaration, generated vector and installation history have distinct roles in the asset lifecycle.
