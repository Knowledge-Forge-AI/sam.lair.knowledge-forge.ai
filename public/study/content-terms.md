# Study-component content terms: Lehman Chapter 3 Problem 4

This note records the exact source split and treatment for the selected
adaptation; it is not legal advice.

## Selected source and attribution

The source repository is
[`lair001/lehman-math-cs`](https://github.com/lair001/lehman-math-cs) at pinned
revision
[`23ac35dd77d923f45137fa3ccce7599890056c70`](https://github.com/lair001/lehman-math-cs/tree/23ac35dd77d923f45137fa3ccce7599890056c70).
The selected authored source files are:

* [`solutions/book/p1/ch3_p4.py`](https://github.com/lair001/lehman-math-cs/blob/23ac35dd77d923f45137fa3ccce7599890056c70/solutions/book/p1/ch3_p4.py),
  whose recorded GitHub blob is
  `99b83a9bc7c9ca3d4fac8bd2928453c1c15b86c3`;
* [`solutions/book/p1/ch3-sol.tex`](https://github.com/lair001/lehman-math-cs/blob/23ac35dd77d923f45137fa3ccce7599890056c70/solutions/book/p1/ch3-sol.tex),
  where the source-authored Chapter 3 Problem 4 section records the `n = 4`
  sample output.

The repository README identifies the source as solutions for the **June 6,
2018 edition** of *Mathematics for Computer Science* by Lehman, Leighton and
Meyer. The TeX source is authored by **Samuel Lair** and dated **August 2022**;
the Python file's independent source date is not stated. The conversion date
for this study slice is **2026-11-13**. Unknown dates remain unknown rather
than being inferred from the commit date.

## GPL/CC split

The pinned repository [README license section](https://raw.githubusercontent.com/lair001/lehman-math-cs/23ac35dd77d923f45137fa3ccce7599890056c70/README.md#L6-L18)
states that software such as `.tex` and `.py` files is licensed under GPLv3,
while separate repository content is licensed under CC BY-NC-SA 4.0. The
repository retains the corresponding [GPL text](https://raw.githubusercontent.com/lair001/lehman-math-cs/23ac35dd77d923f45137fa3ccce7599890056c70/LICENSE_GNU)
and [CC text](https://raw.githubusercontent.com/lair001/lehman-math-cs/23ac35dd77d923f45137fa3ccce7599890056c70/LICENSE_CC).

The published study terms include the full standard GNU GPL-3.0-only body at
[`/study/licenses/lehman-GPL-3.0.txt`](/study/licenses/lehman-GPL-3.0.txt).
That notice is provided for the selected source-derived Python/TeX material;
the source-specific attribution and pinned source links above remain the
authority for this adaptation. The study page also links the exact admitted
KaTeX MIT notice at
[`/study/licenses/katex-LICENSE.txt`](/study/licenses/katex-LICENSE.txt).

The selected adaptation is based on the authored Python and TeX source
coordinates above. The repository’s separate CC BY-NC-SA content basis is not
the license basis for these source-derived files. The source README says GPLv3
but does not say “or later”; the code is recorded as **GPL-3.0**, not
GPL-3.0-or-later. Do not broaden that license label without an actual source
notice that permits it.

## Treatment classification

| Material | Treatment | Terms/provenance boundary |
| --- | --- | --- |
| `src/study/lehman-ch3-p4.py` recursive functions | Copied source algorithm with a separately marked adapted entry guard; the optional maximum is itself restricted to a strict non-bool integer in `0..MAX_N` before `n` validation | Preserve Samuel Lair attribution and the source GPLv3 basis; the new helper does not turn the file into an independent algorithm or authorize a broader license. |
| `src/study/lehman-ch3-p4.mdx` explanation and notation | Adapted project-authored MDX | It explains the selected source algorithm, its `n=0` meaning, induction reasoning, and bounded resource counts. Keep source attribution and the GPL-3.0 source basis visible in the provenance manifest. |
| `src/study/lehman-ch3-p4.provenance.json` | New provenance/manifest data | Records immutable source coordinates, treatment, attribution, conversion date, verified source hashes, and source-linked code entry. |
| `public/study/content-terms.md` | New terms record | Records the source split and does not relicense source-derived content. |

The MDX uses semantic `Exercise`, `Solution`, `Proof`, `Subproof`, `Equation`,
and `EquationRef` boundaries where they describe the actual problem,
solution, and proof structure. It does not invent a textbook exercise number.

## Framework boundary

The study-component framework remains under the package’s existing
AGPL-3.0-or-later/commercial terms. This site candidate also has approved
build-time dependencies on the vendored `@knowledge-forge-ai/study-components`
package, `@mdx-js/mdx`, `katex`, `rehype-katex`, and `remark-math`, with the
recorded KaTeX override. Those framework/build terms are separate from the
GPL-3.0 source-derived Python/TeX adaptation. The dependency additions do not
relabel source-derived study material as AGPL.

No Goodrich material is included, and no Goodrich GPL/MIT question is resolved
by this file. Future study slices must make their own source-specific
attribution and redistribution decision.

## Verification boundary

An earlier private study performed a bounded, standard-library-only Python
readback for `n = 0..8`, invalid guarded entries, and invalid optional maximum
values. That historical readback is not part of this repository's build or
source-verifier checks, and its interpreter is not a public qualification
record. The maximum guard is intended to run before the value guard and cannot
widen the fixed `MAX_N = 8` bound. Native behavior remains unverified here;
the historical observation does not substitute for a mathematical proof or
qualify a browser, native runner, package installation, or publication.
