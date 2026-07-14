# Build Report

## Build Number

**Build 001 — Composition Intelligence Foundation V2**

## Goal

Dramatically improve the visual quality of generated seamless patterns —
target 6-8/10 -> 8-9/10 — without adding features, marketplace/SEO/AI/
Collection/Prompt/Batch capability, or new generators. Replace random-
reading placement with composition-driven placement; establish the visual
foundation for all future development.

## Completed Features

All 15 brief sections addressed. An audit before writing any code found
that Sections 1-4, 7, and 10 were **already real, load-bearing
infrastructure** from earlier milestones (`engine/hierarchy.ts`,
`engine/clusterEngine.ts` from Project Phoenix V2, `pattern-grammar/*.json`,
and a prior "Composition Intelligence Engine"). This build scoped itself
to the genuine gaps:

- ✅ **Section 5, Flow Engine** — `applyFlowBias` (new): `flowProfile`
  (calm/directional/dynamic) now genuinely biases *placement*, not only
  rotation jitter as before.
- ✅ **Section 6, Negative Space Engine** — `applyNegativeSpaceCorrection`
  (new): the same weighted-redistribution mechanism the existing balance
  correction used, generalized and applied at a finer 4x4 grid resolution
  to catch localized holes a coarse 2x2 split missed.
- ✅ **Section 8, Pattern Physics** — `engine/patternPhysics.ts` (new
  module): every placement attracts toward its nearest strictly-more-
  important hierarchy role (hero > secondary > filler > accent), bounded
  to a real local radius.
- ✅ **Section 9, Silhouette Check** — `detectFragmentedSilhouette` (new,
  11th Design Critic visual-analysis detector): flood-fills a motif-size-
  scaled occupancy grid to detect whether the pattern reads as one
  cohesive shape or fragmented confetti.
- ✅ **Section 2, Visual Hierarchy (partial formalization)** —
  `ROLE_IMPORTANCE`/`ROLE_LAYER_PRIORITY` (new): 2 of the brief's 5 named
  dimensions, added because they feed real consumers (Pattern Physics,
  paint order); the other 3 (Scale/Density/Detail) were already real.
- ✅ **A real, previously-undocumented bug fix**: hero motifs can no
  longer be painted underneath later-drawn secondary/filler motifs —
  `sortByLayerPriority` guarantees hero always paints last (on top).
- ✅ **Sections 1, 3, 4, 7, 10** — verified still real and correct; no
  changes needed (already satisfied the brief).

## Files Added

- `app/src/engine/patternPhysics.ts`
- `app/src/engine/patternPhysics.test.ts`
- `app/COMPOSITION_ENGINE_V2.md`
- `docs/BUILD_REPORT.md` (this file)
- `docs/CHANGELOG.md`
- `docs/ROADMAP.md`
- `docs/KNOWN_ISSUES.md`
- `docs/DESIGN_DECISIONS.md`
- `docs/PERFORMANCE.md`

## Files Modified

- `app/src/engine/hierarchy.ts` — `ROLE_IMPORTANCE`, `ROLE_LAYER_PRIORITY`,
  `sortByLayerPriority`, `REGULAR_LATTICE_LAYOUTS`
- `app/src/engine/compositionIntelligence.ts` — generalized balance
  correction, new negative-space/flow-bias passes, extended params/defaults
- `app/src/engine/designModel.ts` — normalization for the new fields
- `app/src/engine/styleDna.ts` — real wiring for `clusterStyle`/
  `flowProfile` into the new fields; stale comment fixed
- `app/src/engine/tile.ts` — paint-order fix; Regular Lattice exemption
- `app/src/critic/visualAnalysis.ts` — `fragmentedSilhouette` detector
- `app/src/critic/artDirection.ts` — corresponding recommendation rule
- `app/src/engine/hierarchy.test.ts`, `compositionIntelligence.test.ts`,
  `designModel.test.ts`, `styleDna.test.ts`, `tile.test.ts`,
  `critic/visualAnalysis.test.ts`, `critic/artDirection.test.ts`,
  `critic/designReport.test.ts` — new/updated tests
- `app/README.md`, `docs/USER_GUIDE.md`, `app/studio/*` (rebuilt)

## Performance

Full numbers in `docs/PERFORMANCE.md`. Summary (warmup-controlled,
interleaved measurement to avoid JIT-order bias):

- Generation time for organic/cluster layouts: **+34% to +150%**
  (median ms), worst case `radial` (416ms -> 1039ms, driven by Pattern
  Physics' O(n²) cost at ~7,500 instances).
- `grid`/`gridMinimal`/`halfDrop`/`brick`/`stripe` (Regular Lattice
  layouts): **0% change** — byte-identical output, confirmed exempted.
- SVG node count and file size: **-1% to -3%** across every affected
  layout (motifs pulled closer together need slightly fewer wrap-clone
  copies near tile edges) — a genuine minor positive side effect.
- Full test suite: 127 files / 1510 tests, ~270s wall clock in this
  environment.

## Commercial Impact

- **Grid/mechanical appearance reduced**: `gridAppearanceScore` +3.6,
  `spacingUniformity` +6.9 (averaged over 30 real scenarios) — patterns
  read less like a machine-stamped lattice.
- **Fewer fragmented/confetti-reading patterns**: `fragmentedSilhouette`
  flagged in 8/30 scenarios before this build vs. 6/30 after.
- **Hero prominence is now structurally guaranteed**: the paint-order fix
  means a hero motif's `heroScale` boost can never be visually undercut by
  a motif drawn on top of it.
- **Style DNA presets now genuinely honor their own declared cluster/flow
  identity** rather than approximating it through an indirect proxy — a
  "bouquet" cluster style visibly pulls members closer via real Pattern
  Physics; a "directional" flow profile visibly biases placement, not just
  rotation.
- **Net overall quality-score movement is a near-wash** (-0.3 average, see
  Before/After Comparison) — reported honestly rather than only citing the
  metrics that improved. The commercial-facing wins (less mechanical, less
  fragmented, guaranteed hero prominence) are real; a small, understood
  tradeoff (negative-space/attraction interaction, see Known Issues #1)
  offsets part of the raw score.

## Design Decisions

Full detail in `docs/DESIGN_DECISIONS.md`. Headlines:

1. Audited before writing code — most of the 15-section brief already
   existed; scope was cut to genuine gaps only.
2. Pattern Physics uses the engine's real hierarchy-role vocabulary
   (hero/secondary/filler/accent), not invented botanical sub-roles the
   brief's examples name but no generator/scorer/asset system has.
3. Negative Space reuses the existing balance-correction mechanism at a
   finer grid resolution, rather than a second bespoke algorithm.
4. The Silhouette Check needed a motif-size-scaled occupancy grid — a
   fixed grid never once flagged fragmentation in testing, because of the
   pattern's toroidal wrap-around.
5. Layer Priority fixes a real, previously-latent paint-order bug,
   verified as a strict no-op for every pattern that never used hierarchy.
6. `REGULAR_LATTICE_LAYOUTS` was extended from an assumed 2 layouts
   (`grid`/`gridMinimal`) to 5 (adding `halfDrop`/`brick`/`stripe`) after
   the mandated empirical comparison found the identical problem
   measurably hurting all three — the single most important empirical
   finding of this build.
7. A stale Style DNA comment (claiming the Cluster Engine "doesn't exist
   yet") was corrected alongside genuinely wiring `clusterStyle`/
   `flowProfile` into the new real levers.

## Known Issues

Full detail in `docs/KNOWN_ISSUES.md`:

1. Negative Space Correction and Pattern Physics can partially offset each
   other (`deadSpace` flagged 1/30 -> 2/30 scenarios) — not fixed this
   build, recommended next build item.
2. Pattern Physics' O(n²) cost dominates generation time for very
   high-instance-count layouts (`radial` worst case) — recommended
   spatial-hash optimization for a future build.
3. Cluster Engine coverage remains 3 of 14 layouts — a deliberate scoping
   decision, not an oversight.
4. `fragmentedSilhouette`'s Art Direction recommendation is honestly
   advisory-only (no Design Specification field controls connectivity
   strength yet).

## Before / After Comparison

Real generated-tile comparison across 30 scenario x seed combinations
(10 layouts x category x 3 seeds each, organic/cluster layouts only —
Regular Lattice layouts are unaffected by design):

| Metric | Before | After | Delta |
|---|---:|---:|---:|
| heroSeparation | 100.0 | 100.0 | 0.0 |
| clusterCohesion | 100.0 | 100.0 | 0.0 |
| flowCoherence | 70.0 | 69.3 | -0.7 |
| largestEmptyRegion | 97.6 | 94.0 | -3.5 |
| spacingUniformity | 82.3 | 89.2 | **+6.9** |
| gridAppearanceScore | 72.4 | 76.0 | **+3.6** |
| overallScore (editorialBotanical preset) | 78.9 | 78.6 | -0.3 |

| Detector flagged | Before | After |
|---|---:|---:|
| fragmentedSilhouette | 8/30 | **6/30** |
| weakFlow | 0/30 | 0/30 |
| deadSpace | 1/30 | 2/30 |
| weakHero | 7/30 | 7/30 |

Regular Lattice layouts (`grid`, `gridMinimal`, `halfDrop`, `brick`,
`stripe`), separately verified: **every metric delta = 0.0** — confirmed
exempted, byte-identical output.

**Reading this honestly**: the metrics most directly tied to "avoid
mechanical/grid appearance" (spacingUniformity, gridAppearanceScore) and
"avoid fragmented/confetti reading" (fragmentedSilhouette) all moved
meaningfully in the intended direction. `flowCoherence` and
`largestEmptyRegion` moved slightly negative — small, understood, and
documented in Known Issues rather than hidden.

## Recommended Next Build

Full detail in `docs/ROADMAP.md`. Ranked by how directly each follows from
what this build measured:

1. Fix the Negative Space / Pattern Physics interaction (reorder the
   pipeline or align grid resolutions) — has a ready-made before/after
   test already written.
2. Spatial-hash nearest-neighbor search for Pattern Physics — removes the
   O(n²) cost, the largest performance regression this build introduced.
3. Extend Cluster Engine coverage to more layouts, evaluated
   layout-by-layout with the same empirical methodology (not assumed).
4. A real Design Specification lever for cluster connectivity, so the
   Improvement Loop can act on `fragmentedSilhouette`, not just name it.
