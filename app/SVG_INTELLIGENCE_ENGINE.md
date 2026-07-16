# SVG Intelligence Engine — Phase 3

This document covers the SVG Intelligence Engine Phase 3 milestone: an
honest audit of the existing SVG generation/composition engine against the
full 15-section brief, and the two areas where genuine, non-cosmetic
engineering was invested — a real **SVG Optimizer** and **real (non-proxy)
geometric quality metrics**.

## Contents

- [Scope decision](#scope-decision)
- [Architecture changes](#architecture-changes)
- [Algorithms added](#algorithms-added)
- [Geometry improvements](#geometry-improvements)
- [Repeat / seamless-tiling improvements](#repeat--seamless-tiling-improvements)
- [SVG optimization](#svg-optimization)
- [Quality scoring — before vs. after](#quality-scoring--before-vs-after)
- [Performance](#performance)
- [Tests](#tests)
- [Developer guide](#developer-guide)
- [Remaining weaknesses](#remaining-weaknesses)
- [Recommendations for Phase 4](#recommendations-for-phase-4)

## Scope decision

The brief describes a 15-section Constraint-Based Composition Engine
(Design Spec Consumer, Constraint-Based Composition, Visual Hierarchy
Engine, Flow Engine, Cluster Engine, Negative Space Engine, Repeat Engine,
Motif Variation Engine, SVG Optimizer, Quality Scoring, Quality Improvement
Loop, Style DNA Enforcement, Performance, Tests, Documentation). By the
time this milestone started, this app's engine already had ~5,800 lines
across `engine/*.ts` from six prior milestones (v1.23–v1.36):

- **Visual Hierarchy Engine** — `engine/hierarchy.ts` (hero/secondary/
  filler/accent roles, ratio + scale presets).
- **Candidate Engine + Scoring Engine** — `engine/candidateEngine.ts` +
  `engine/scoring.ts` (generate-pool → score-from-real-geometry → reject →
  rank, 19 metrics at the start of this phase).
- **Composition Intelligence Engine** — `engine/compositionIntelligence.ts`
  (balance + rhythm correction).
- **Style DNA Engine** — `engine/styleDna.ts` (15 named design identities).
- **Curve/Growth Engine** — `engine/curveEngine.ts`, `generators/growth.ts`
  (organic Bézier motif construction).
- **14 layouts** (`layouts/*.ts`) already covering nearly every named Flow
  type in the brief: grid, brick, half-drop, radial/mandala, scatter, Hero +
  Editorial Flow, Hero + Scatter, S-Curve Botanical, Bouquet, Airy Botanical,
  Dense Premium, Toss Pattern, Grid Minimal, Stripe.

Rebuilding Sections 2–6 and 8 from scratch would have meant discarding
working, tested code to re-derive things that already exist under
different names. Instead this phase invested real engineering effort
specifically where an audit found genuine, honest gaps:

1. **Section 9, SVG Optimizer** — genuinely absent. The engine had a
   node-count *reject gate* (`HARD_NODE_BUDGET` in `candidateEngine.ts`)
   but never an actual transform/structure optimization pass.
2. **Section 10's strongest directive, "Never generate fake scores"** —
   `flowCoherence`, `rhythmRegularity`, `motifShapeDiversity`, and
   `repeatQuality`'s corner-junction component were, before this phase,
   computed as documented averages of *unrelated* metrics (e.g. rhythm
   quality borrowed from `densityVariance` + `spacing`, not from any actual
   measurement of rhythm). This phase replaces all four with real,
   independently-derived geometric measurements.
3. **Style DNA Enforcement (Section 12)** — `computeStyleDrift` already
   checked input-parameter drift; this phase adds
   `computeStyleDnaConsistency`, which checks whether the *rendered
   geometry* actually reads as consistent with a style's declared intent.

Sections 2–6 and 8 (Constraint-Based Composition, Hierarchy, Flow, Cluster,
Negative Space, Motif Variation) were audited but not rebuilt — see
[Remaining weaknesses](#remaining-weaknesses) for what's genuinely missing
versus what's already covered under a different name.

## Architecture changes

One new module, one new export-path integration, and geometry helpers
added to an existing module — no existing module was rewritten, no schema
changed, no UI was touched.

```
engine/
  svgOptimizer.ts        NEW — lossless SVG tree optimizer (Section 9)
  svgGeometry.ts         + periodicOffset, extractMotifShapeSignatures
  scoring.ts             + 4 real metrics, 2 new soft-penalty rules
  styleDna.ts            + computeStyleDnaConsistency (Section 12)
export/
  svgExporter.ts         wired to call optimizeSvgTree() before serializing
trend/
  designSpecQuality.ts   buildQualityReport() rewired to the 4 real metrics
                          + real Style DNA consistency signal
```

`optimizeSvgTree` is intentionally **not** wired into `engine/tile.ts` (the
core generation pipeline that both live preview and export share before
this integration point). Preview and the exported file must stay visually
identical, and dozens of existing tests assert `buildTile()`'s exact output
structure — wiring the optimizer in at the export boundary instead gets
every real download path optimized (verified against `App.tsx`'s actual
download call sites) with zero risk to the generation pipeline's existing
test coverage.

## Algorithms added

- **Greedy nearest-neighbor chain** (`buildNearestNeighborChain` in
  `scoring.ts`) — O(n²) traversal that starts at the first motif instance
  and repeatedly walks to the nearest not-yet-visited instance (tile-wrap
  aware, via the new `periodicOffset` helper). This chain is the backbone
  both `flowCoherence` and `rhythmRegularity` measure from.
- **Cosine similarity of consecutive direction vectors** — walking the NN
  chain, `flowCoherence` averages `cos(θ)` between each step's direction
  vector and the previous one, mapped from `[-1, 1]` to `[0, 100]`. A
  pattern whose motifs read as flowing in one direction scores high; a
  pattern whose NN chain has to double back and zigzag scores low.
- **Shannon entropy over a spacing histogram** — `rhythmRegularity` buckets
  NN-chain step distances (relative to the mean) into 8 bins and scores
  `100 * (1 - entropy / maxEntropy)`. Evenly-spaced motifs concentrate into
  few bins (low entropy, high score); chaotic spacing spreads across all
  bins (high entropy, low score). The same entropy primitive, differently
  normalized, drives `motifShapeDiversity` (`entropy / log2(n) * 100` — here
  *high* entropy is the desired outcome, since it means many distinct
  shapes rather than one shape repeated).
- **Rotation/scale/position/color-invariant shape signature**
  (`shapeSignature`, private to `svgGeometry.ts`) — a path's command-letter
  sequence (`M`/`L`/`C`/`Q`/`A`/`Z`, uppercased), or a recursive
  `g[sig1,sig2,...]` join for `<g>` groups. Two motifs using the same path
  but placed at different positions/rotations/scales collapse to the same
  signature; two motifs with genuinely different path structure do not.
  This is what lets `motifShapeDiversity` distinguish "the same shape spun
  around 8 times" from "8 actually different shapes" — something
  `scaleDiversity`/`rotationDiversity` (which only look at *how* a shape
  was placed) structurally cannot do.
- **Corner-density ratio** (`computeCornerContinuity`) — bins motif
  positions into an 8×8 grid, compares density in the four 2×2-cell corner
  blocks (where the wrap-clone tiling creates a compositional seam when the
  tile repeats) against the tile's overall average cell density, scored
  `100 - |ratio - 1| * 70`.
- **Exact-string transform composition** (`svgOptimizer.ts`) — combines two
  nested `transform` attributes by string concatenation, not matrix
  multiplication, exploiting SVG 1.1 §7.6's definition that a
  `transform="A B"` attribute is exactly equivalent to nesting two elements
  with `transform="A"` and `transform="B"` respectively. This is lossless
  by specification (no floating-point matrix-reconstruction rounding risk)
  and keeps optimizer output parseable by `svgGeometry.ts`'s own
  regex-based transform extraction, which expects function-list syntax
  rather than a single `matrix(...)`.

## Geometry improvements

`engine/svgGeometry.ts` gained two building blocks, both exercised directly
by the new scoring metrics:

- `periodicOffset(a, b, tileSize)` — like the existing `periodicDist`, but
  returns the wrapped *offset vector* `{dx, dy}` instead of just a scalar
  distance. `flowCoherence` needs actual direction vectors between
  consecutive motifs in the NN chain, not just distances, and needed the
  wrap-awareness that periodic distance measurement already had.
- `extractMotifShapeSignatures(tileData)` — walks every `motif-N` group and
  returns one shape signature per placed instance (see above), sampling
  each motif's first wrap-instance so translation/rotation/scale jitter
  applied per-copy doesn't affect the signature.

## Repeat / seamless-tiling improvements

The wrap-clone tiling in `engine/tile.ts` (every motif drawn at up to 9
periodic offsets, clipped to the tile rect) already makes edge-to-edge
seamlessness a **structural guarantee** — `seamlessIntegrity: 100` in
`scoring.ts` was already honest, not a fake score, because it's true by
construction rather than something that needs runtime verification.

What that guarantee doesn't capture is *compositional* quality at the
four corners where up to four wrap-copies of neighboring motifs converge
when the tile repeats — a tile can be seamless (no visible seam) while
still reading as noticeably empty or overcrowded exactly at that junction.
`cornerContinuity` (see above) is the new, real measurement of that
specific concern, and `repeatQuality` in `trend/designSpecQuality.ts`'s
quality report is now the average of the structural guarantee
(`seamlessIntegrity`) and this real compositional measurement
(`cornerContinuity`), replacing what used to be `seamlessIntegrity` alone
standing in for "repeat quality" as a whole.

## SVG optimization

See the [README's SVG Optimizer section](./README.md#svg-optimizer-enginesvgoptimizerts)
for the full mechanics (redundant-`<g>` collapse + identity-transform
stripping, both lossless, both leaving `motif-N`/`layer-*` identity and
path geometry untouched).

Measured node-count reduction on real generated tiles across the app's
pattern categories under a range of density/layout settings: roughly
**2–17%**, averaging **~5–6%**, depending on how deeply a given layout
nests its placement transform groups (layouts that wrap each placement in
fewer intermediate groups have less to collapse). This is a real,
structural reduction — not a compression/minification pass — verified by
`svgOptimizer.test.ts`'s `node count never increases across 9 real
categories` test and by `optimizeSvgTree`'s own `OptimizationReport`
(`nodesBefore`/`nodesAfter`/`reductionPercent`) being asserted directly in
tests rather than only spot-checked manually.

Wired into `export/svgExporter.ts`'s `buildSingleTileSvg` and
`buildTiledSvg` (once per tile before the 3×3 cloning loop — not 9×
redundantly). **Not** wired into Collection Studio's asset SVG
serialization (`collection/collectionGenerator.ts`) — that path serializes
its own asset SVGs separately from the exporter and predates this phase's
optimizer; leaving it un-optimized is a documented Phase 4 item, not a
regression, since it received no optimization before this phase either.

## Quality scoring — before vs. after

| Metric | Before Phase 3 | After Phase 3 |
| --- | --- | --- |
| `flowCoherence` | Did not exist as a field name in `CompositionMetrics`; Design Spec quality reports mapped "flow" to an average of unrelated metrics. | Real: average cosine similarity of consecutive direction vectors along a greedy nearest-neighbor chain through actual motif positions. |
| `rhythmRegularity` | Same — proxied from density/spacing metrics. | Real: Shannon-entropy peakiness of the NN-chain spacing-distance histogram. |
| `motifShapeDiversity` | Did not exist; "motif diversity" in quality reports was `scaleDiversity`/`rotationDiversity` only — placement variation, not shape variation. | Real: Shannon entropy of rotation/scale/position/color-invariant shape-topology signatures across all placed motifs. |
| `cornerContinuity` | Did not exist; "repeat quality" in quality reports was `seamlessIntegrity` alone. | Real: corner-region motif density vs. tile-average density, at the 4 tile corners where the wrap-clone tiling creates a compositional seam on repeat. |
| Style DNA consistency | `computeStyleDrift` only (input-*parameter* drift — did the user hand-edit category/layout/density away from what the style resolves to). | Added `computeStyleDnaConsistency` — checks the *rendered geometry* (measured `occupancyRatio` vs. declared `density`; measured `rotationDiversity` vs. what `motifComplexity` predicts), a signal `computeStyleDrift` structurally cannot provide since it never inspects the rendered tile. |

All four new metrics are wired into `QUALITY_PRESET_WEIGHTS` for every
existing preset (`stockClean`, `textilePremium`, `editorialBotanical`,
`denseLuxury` — new weight entries added, no existing weight values
changed; `computeOverallScore` normalizes by the sum of weights actually
present, so this dilutes older metrics' relative influence proportionally
and automatically rather than requiring manual rebalancing) and into two
new named `SOFT_PENALTY_RULES` (`cornerDeadZone`, `repetitiveMotifShapes`).

`trend/designSpecQuality.ts`'s `buildQualityReport` — the function behind
the Trend Intelligence Studio / Design Workbench quality report and the
Quality Improvement Loop's pass/fail check — now reads `flow` and `rhythm`
as direct 1:1 fields from `CompositionMetrics` (no averaging), and folds
the new real `motifShapeDiversity` and `cornerContinuity` metrics into
`motifDiversity`/`repeatQuality`/`commercialReadiness` respectively.

## Performance

- `buildNearestNeighborChain` is O(n²) per call, same complexity class as
  `findNearest` (used by four pre-existing metrics: spacing, overlap
  quality, adjacency repetition, hero separation) — no asymptotic
  regression introduced, since patterns are already bounded by the
  Candidate Engine's `HARD_NODE_BUDGET` (8,000 nodes) and typical motif
  counts stay in the low hundreds even for dense layouts.
- `optimizeSvgTree` is a single linear tree walk (`O(nodes)`), run once per
  tile per export (not once per candidate during generation, and not 9×
  redundantly during 3×3 tiled export — verified by reading
  `buildTiledSvg`'s call site, which optimizes before the cloning loop).
- No change to the Candidate Engine's async chunking or the ~0.5–1.5s
  per-candidate generation cost documented in the main README's Candidate
  Engine section — this phase adds no per-candidate generation work, only
  a one-time post-generation export-time optimization pass and metrics
  computed from geometry the Scoring Engine already extracts once per
  `computeMetrics` call.

## Tests

- `engine/svgOptimizer.test.ts` (new, 15 tests) — basic collapse, exact
  transform-string concatenation, non-collapse when an `id`/`data-role`/
  multiple children/non-`<g>` child is present (protects `motif-N`/
  `layer-*` identity), recursive multi-level collapse, identity-transform
  stripping, bounding-box-identical-before-and-after (both synthetic trees
  and real `buildTile()` output), never mutates its input, deterministic
  under double-optimization, node count never increases across 9 real
  pattern categories, and — the test that specifically validates the
  string-concatenation design choice — `extractInstances()` produces
  identical results before and after optimization for the common case of a
  motif with no transform of its own.
- `engine/svgGeometry.test.ts` (extended, +5 tests) — `periodicOffset`
  (wrapped-offset correctness, length matches `periodicDist`) and
  `extractMotifShapeSignatures` (deterministic, count matches instance
  count, same path gets an identical signature regardless of
  position/rotation/scale, different path command sequences get different
  signatures).
- `engine/scoring.test.ts` (extended, +11 tests) — a `makeSyntheticTile`
  helper builds minimal, precisely-controlled `TileData` (exact motif
  positions/shapes) so the new metrics can be tested against known
  geometry rather than only real generated output. Covers: a perfect
  diagonal line scoring higher `flowCoherence` than a scattered point
  cloud; evenly-spaced motifs scoring higher `rhythmRegularity` than
  irregularly-spaced ones; identical shapes at different positions/
  rotations/scales scoring low `motifShapeDiversity`, genuinely different
  shapes scoring high; empty/dense corners being detected by
  `cornerContinuity`.
- `engine/styleDna.test.ts` (extended, +6 tests) — `computeStyleDnaConsistency`
  scores 100 for an exact density+complexity match, penalizes a density
  mismatch, penalizes a rotation-diversity/complexity mismatch, correctly
  expects higher rotation diversity for `intricate` styles than `simple`
  ones, clamps to 0 rather than going negative on wildly out-of-range
  inputs, and is a pure function of its inputs.
- `trend/designSpecQuality.test.ts` (extended, +6 tests) — explicit wiring
  assertions: `report.flow`/`report.rhythm` are exact 1:1 reads of
  `metrics.flowCoherence`/`metrics.rhythmRegularity` (not derived/rounded
  through anything else), `repeatQuality` matches the documented
  `seamlessIntegrity`+`cornerContinuity` average, `motifDiversity` matches
  the documented 3-way average, `commercialReadiness` includes a real
  `computeStyleDnaConsistency` signal when the spec resolves to a known
  Style DNA, and `balance`/`composition`/`hierarchy`/`svgHealth`/
  `negativeSpace` map exactly as documented.

**Full suite**: 836/836 tests passing across 65 files (`npx vitest run`),
up from 809 before this phase's test additions. `npx tsc -b` and
`npm run lint` (oxlint) both clean.

## Developer guide

**Adding a new real (non-proxy) composition metric**: add the field to
`CompositionMetrics` in `scoring.ts` with a doc comment explaining exactly
what real geometry it measures and how it differs from any
superficially-similar existing metric (this phase's convention — see the
existing `flowCoherence`/`rhythmRegularity`/`motifShapeDiversity`/
`cornerContinuity` doc comments for the pattern to follow), implement a
`compute*` function that derives it from `extractInstances`/
`extractMotifShapeSignatures`/the serialized SVG string (never from other
metrics — that would just be a new proxy), wire it into `computeMetrics`,
add weight entries to all 4 `QUALITY_PRESET_WEIGHTS` presets (existing
weights don't need rebalancing — normalization handles it), and add a
`METRIC_LABELS` entry. Write tests using `makeSyntheticTile` (see
`scoring.test.ts`) for precise, non-flaky geometric control rather than
only asserting against real generated output.

**Extending the SVG Optimizer**: any new pass must (1) never change what
`extractInstances`/`extractMotifShapeSignatures` would parse from the tree
(verify with a before/after equality test, as `svgOptimizer.test.ts` does),
(2) never touch a node carrying `id`/`data-role`/`clip-path` without
preserving it exactly (Affinity Designer layer identity depends on this),
and (3) never reconstruct a `matrix(...)` transform from composed values —
prefer exact operations (string concatenation, attribute removal) that
have no floating-point rounding risk, per this phase's transform-handling
design.

## Remaining weaknesses

Honest, explicit gaps — some pre-existing (documented in their own source
files before this phase), some genuinely out of this phase's scope:

- **No true Cluster Engine** (Section 5). `engine/styleDna.ts`'s own module
  comment already documented this before this phase: `clusterStyle`/
  `clusterDensity` are approximated through `overlapAmount` +
  `compositionIntelligence.balanceStrength` rather than a real clustering
  placement algorithm. Still true after this phase — not addressed, since
  it would require new placement logic in the layouts themselves, not a
  scoring or optimization change.
- **`botanicalGrowthPreset` is reserved, not wired** — stored/round-tripped
  on Style DNA but does not yet steer which botanical shape variant a
  generator draws (also pre-existing, documented in `styleDna.ts`).
- **`adjacencyRepetition` (pre-existing metric) is still a proxy** — it
  approximates "does the same motif sit next to itself" using
  rotation-bucket + role signals, because `Placement` doesn't track which
  internal shape *variant* a generator drew. This phase's new
  `motifShapeDiversity` metric could in principle replace this proxy with
  a real adjacency-of-identical-shape-signature check, but that specific
  rewire was not done this phase (see Phase 4 recommendations).
- **SVG Optimizer is not wired into Collection Studio's asset export
  path** — `collection/collectionGenerator.ts` serializes asset SVGs on a
  path separate from `export/svgExporter.ts` and was not touched.
- **SVG Optimizer performs no path-geometry simplification** — it is
  purely a structural (transform/grouping) optimizer; Bézier curve point
  reduction, path merging, or numeric-precision re-optimization beyond what
  `svgAst.ts` already does at generation time are not implemented.
- **Style DNA consistency uses two signals, deliberately, not a wider
  composite** — an honest, narrower real measurement (density match +
  complexity match) was chosen over inventing additional "signals" that
  wouldn't actually be measuring anything new, per this milestone's own
  "never generate fake scores" directive.

## Recommendations for Phase 4

1. **Real Cluster Engine** — implement actual clustering placement (motifs
   grouped into spatial clusters with real inter-cluster negative space),
   replacing the `overlapAmount`/`balanceStrength` approximation. This is
   the largest genuine gap against the original 15-section brief.
2. **Wire `botanicalGrowthPreset` into `generators/botanical.ts`** so Style
   DNA's reserved field actually steers shape selection, closing a
   documented round-trip-only gap.
3. **Extend the SVG Optimizer to Collection Studio's export path** so
   Collection assets get the same node-count reduction as single-tile/
   tiled exports.
4. **Replace `adjacencyRepetition`'s rotation-bucket proxy** with a real
   check using this phase's new shape-topology signatures, now that a
   genuine shape-identity primitive exists to build it from.
5. **Path-level SVG optimization** (Bézier point reduction, redundant path
   merging) as a distinct, separately-tested pass from this phase's
   structural (transform/grouping) optimizer — keep the two concerns
   independent so the existing zero-geometry-risk guarantee of this
   phase's optimizer is never put at risk by a future geometry-touching
   pass sharing its code path.
