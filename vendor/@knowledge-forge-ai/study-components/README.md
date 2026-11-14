# Study-components build-time package

This vendored package supplies the static study document build for
`@knowledge-forge-ai/study-components@0.0.0-private.0`. It is a private
application dependency in this site candidate, not a separately published
package or a promise of release availability.

The site build uses the document-registry, `./mdx`, and `./semantic` subpaths.
The package also carries the reviewed editor and runtime source closure for
future consumer-owned qualification, but this static lesson does not activate
those runtime paths.

The candidate is an explicit frozen twelve-module source closure. It contains
static document/MDX/semantic components, the legacy browser runner, the
CodeMirror editor, and the accepted typed separate-origin runtime adapter.
Runtime imports are explicit subpaths; there is no eager barrel that imports
React, CodeMirror, MDX, or a runtime host.

The package has no runtime dependencies and declares the admitted React,
CodeMirror, MDX, math, and KaTeX capabilities as optional consumer-supplied
peers. The private consumer fixture pins the already admitted versions and
uses `skipLibCheck: false`. It does not install from the network or modify the
root/Studio workspace.

The package contains no lessons, examples, provenance records, Pyodide files,
Python runtime assets, frame deployment, or runtime server. Serving a runtime
frame and supplying Python assets remain consumer-owned boundaries. The
package does not claim a browser matrix, hard resource sandbox, Python runtime
qualification, release availability, or mathematical correctness.

The package's selected declaration environment does not constitute a generic
consumer compatibility promise. A consumer that activates the editor or
runtime subpaths must qualify its own React, CodeMirror, and declaration
environment separately.

`LICENSE`, `NOTICE`, and `COMMERCIAL-LICENSE.md` are carried for the actual
AGPL/commercial package source. Lesson-specific GPL terms are not redistributed
because lesson content is excluded.
