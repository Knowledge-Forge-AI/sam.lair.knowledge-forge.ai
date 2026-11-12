---
{
  "title": "Getting Nebular 0.8.0 into the package managers",
  "description": "The workbench release reaches the signed Linux repositories.",
  "date": "2026-11-10",
  "updated": "2026-11-12",
  "category": "Distribution",
  "kind": "milestone",
  "releases": [],
  "sources": [
    {
      "label": "Signed repository publication receipt and architecture inventory",
      "url": "https://github.com/Knowledge-Forge-AI/theme-forge-packages/releases/tag/packages-current-202611-nebular080"
    },
    {
      "label": "Production repository deployment for the 0.8.0 generation",
      "url": "https://github.com/Knowledge-Forge-AI/theme-forge-packages/actions/runs/42859410403"
    },
    {
      "label": "Theme Forge package service",
      "url": "https://tf.rs9.knowledge-forge.ai/"
    }
  ]
}
---

I’ve brought Nebular Fusion 0.8.0 into the signed Linux repositories. This milestone connects the workbench release to APT, DNF and pacman, including AArch64.

## A release has more than one finish line

The source release, the packaged application and the repository a user installs from are different deliverables. I want each step to be inspectable, with its own evidence and its own failure conditions.

## The release boundary

The service remains at tf.rs9.knowledge-forge.ai with its public signing certificate. Other Theme Forge products retain their versions. Nix and Homebrew have their own channel records; the custom pacman repository does not imply an AUR submission.
