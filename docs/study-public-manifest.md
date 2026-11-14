# Public source projection manifest

This candidate's public projection is the maintained site source plus the
narrow study source/build/test/vendor additions. The projection is checked by
`tools/test-study-source.mjs` using the explicit path list in
`test/fixtures/study-baseline.v1.json` and a deterministic path/hash
aggregate.

Included paths are:

- the existing root source/config/legal files;
- the existing `src/`, `public/`, and site documentation trees;
- the vendored study-components build-time package under
  `vendor/@knowledge-forge-ai/study-components/`;
- `src/study/lehman-ch3-p4.mdx`, its reviewed Python/provenance/editor inputs,
  the static study page, and the material stylesheet correction;
- `tools/build-study-source.mjs`, `tools/test-study-source.mjs`, and the
  isolated mutation-probe helper;
- `test/fixtures/study-baseline.v1.json`;
- the exact package/lock additions and the existing legal/notice files.

The projection excludes historical comparison tools and private evidence,
including `tools/private/`, research copies, and the old generated binding.
It also excludes generated or installed state: `build/`, `dist/`, `.astro/`,
`node_modules/`, generated study derivatives under `src/study/` and
`public/study/`, and package-manager caches. Those paths are recreated or
installed only by the local build/test procedure and are never part of the
source projection.

The focused test verifies that every listed path is a regular non-symlink file
and that the exact projected path/hash aggregate, file count, and byte count
remain stable. It does not traverse the checkout, read `.git` objects, or
hash unknown ignored/local files such as `.DS_Store`, `.serena/`, `.env*`, or
`.vscode/`. Generated assets, build receipts, and `node_modules` therefore
cannot silently enter the public source packet.
