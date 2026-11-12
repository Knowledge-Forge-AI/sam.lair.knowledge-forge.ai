# Sam Lair

Samuel Leighton Lair’s personal workbench and journal at **https://sam.lair.knowledge-forge.ai/**.

Agent engineering, repository intelligence, visual systems and the infrastructure that connects them. The site uses a Developer-family design informed by the owner’s terminal palette: phosphor green, cyan, purple, amber and a soft sage light appearance. Glass surfaces, an original anime portrait and responsive layouts are implemented as real HTML/CSS.

## Journal and provenance

Release reflections use the original release or milestone date. Newly backfilled entries disclose their retrospective writing date, link public source records and retain independent product/version boundaries. The original July 22 APGR reflection remains at its existing blog route, unchanged. Common Lore Index is the in-progress name for RepoMap; no installed command is renamed by this site. DINAS is identified as the original inspiration.

`src/data/release-records.json` binds covered release identities to their public dates and articles. A website update is not a product release.

## Development

Use the committed lockfile with `npm ci`, then `npm run build`. Do not upgrade dependencies as part of editorial or appearance updates. Start a local server using `npm run dev -- --background`; manage it with the existing Astro background-server commands documented in AGENTS.md. No analytics, remote font fetch, account, form backend or tracking script is added. The theme preference is stored only in local browser storage.

The existing main-branch GitHub Pages workflow builds and deploys this static Astro site. The maintainer reviews source changes before landing them; this is a working practice rather than an enforced branch rule. The Pages environment retains its existing protection rules. Package and product workflows belong to their respective repositories.

## License

Original website software and editorial text are licensed under **AGPL-3.0-or-later**; see [LICENSE](LICENSE). AGPL permits commercial use subject to its terms. [Commercial licenses](COMMERCIAL-LICENSE.md) are available for proprietary arrangements.

Contributors retain copyright and must explicitly acknowledge [CLA.md](CLA.md) in pull requests. See [CONTRIBUTING.md](CONTRIBUTING.md), [NOTICE](NOTICE), and [BRAND-ASSETS.md](BRAND-ASSETS.md). The portrait and personal brand assets are excluded from the software grant. Third-party material retains its original terms. Steward: Samuel Leighton Lair <sam.lair@knowledge-forge.ai>.

This project began with the Astro/Starlight starter. Astro, Starlight, starlight-blog and other locked dependencies retain their upstream licenses and notices.
