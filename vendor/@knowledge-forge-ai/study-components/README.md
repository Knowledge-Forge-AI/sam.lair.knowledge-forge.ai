> Consumer note: this is a dist-only projection. Source build instructions below apply to the maintained source package; its development dependencies and TypeScript configuration are not distributed here.

# Optional study components

This is the private source package
`@knowledge-forge-ai/study-components@0.0.0-private.1`. It is not a root
workspace member, runtime dependency, public release, or publication target.
The package carries source for a document registry, trusted first-party MDX
compilation, static semantic React components, an optional CodeMirror editor,
and bounded JavaScript/runtime adapters.

## Package boundary

The package has zero runtime `dependencies`. React, CodeMirror, MDX,
remark-math, rehype-katex, and KaTeX are optional consumer-supplied peers.
Build tools and the exact peer copies used for the private source build are
package-local `devDependencies`; npm does not ship them in the packed runtime
graph.

The package exports explicit subpaths for the registry, trusted MDX, semantic
React, editor, JavaScript/runtime adapters, runtime frame, and the optional
TypeScript adapter. The root and registry subpaths do not load React,
CodeMirror, MDX, KaTeX, Python, Pyodide, or the TypeScript compiler.

This package does not contain lessons, textbook/PDF prose, provenance bundles,
Python/Pyodide assets, Java support, or third-party compiler bytes. It is a
framework/source boundary, not a content bundle or a proof checker.

## Reproducible source build

From this package directory, with the already admitted exact archives available
to npm, the private source-build recipe is:

```sh
npm ci --offline --ignore-scripts --engine-strict
npm run typecheck
npm run build
npm pack --ignore-scripts --json
```

The package-local lock and scripts select TypeScript 5.9.3; they do not rely on
a private filesystem path or an ambient unpinned compiler. The package remains
`private` and this recipe does not authorize publication. The source-checkout
recipe is named `docs/package-build.md`, but that documentation file is not
included in the packed artifact.

## MDX, math, and declarations

The trusted MDX path uses the admitted MDX/math class and bounded KaTeX
HTML/MathML rendering. The root package override is not inherited by a
consumer: npm overrides are root-only. Therefore every consumer that enables
the MDX/math path must set its own root override (or separately qualify another
pair):

```json
{
  "overrides": {
    "katex": "0.19.1"
  }
}
```

The optional `katex` peer alone does not control the KaTeX version selected
under `rehype-katex` or `micromark-extension-math`; the consumer must bind the
same override and verify the resulting tree. This is a compatibility
requirement, not a mathematical-correctness claim.

The package build uses `skipLibCheck:false` and the non-packed
`build-support/mdx-react-jsx-compat.d.ts` bridge for the admitted
`@types/mdx@2.0.14`/React 19 declaration boundary. The bridge is included by
the base `tsconfig.json`, is not emitted or exported, and is not a consumer
ambient declaration. The private MDX consumer proof explicitly uses
`types: ["react", "react-dom"]` to avoid automatic inclusion of the legacy
global JSX declarations. A consumer using default automatic `@types` inclusion
must independently qualify that declaration environment or provide its own
consumer-owned bridge; the package does not promise arbitrary declaration
compatibility.

## Runtime ownership and safety boundary

The JavaScript frame and host are consumer-owned runtime assets. A consumer
must serve the frame from a separate origin from its parent and provide the
configured origin allowlist and policy. The source package does not host the
frame, configure cookies/CSP, or claim a browser deployment.

Python execution and its Pyodide/stdlib assets are also consumer-owned and
must remain on the separate runtime origin. Static pages and ordinary
JavaScript usage do not load Python assets. The optional TypeScript lane is
syntax-only: its consumer supplies and verifies the compiler asset, and the
adapter hands generated JavaScript to the existing JavaScript boundary. It is
not a type-checker, sandbox, grading-integrity mechanism, or public-host
qualification.

## Legal and qualification status

`LICENSE`, `NOTICE`, and `COMMERCIAL-LICENSE.md` are carried as exact private
package legal files. Any source-derived content must travel in its own
attribution and license-governed bundle; this framework package does not
redistribute textbook or lesson content.

This candidate has private source/build/pack evidence only. It does not claim
browser qualification, hosted deployment, universal npm/Node compatibility,
mathematical correctness, or integrity against learner-forged output.
