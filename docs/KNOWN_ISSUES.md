# Known Issues

Tracked, honestly-measured limitations. New builds append; resolved items
move to the relevant build's entry in `docs/CHANGELOG.md` rather than
being deleted from here silently — mark them `RESOLVED (Build NNN)` and
leave the original entry for history.

---

## Build 001 — Composition Intelligence Foundation V2

### 1. Negative Space Correction and Pattern Physics can partially offset each other — RESOLVED (Build 001.1)

Measured via the empirical before/after comparison (see
`docs/PERFORMANCE.md`/`BUILD_REPORT.md`): across 30 real generated
scenarios, `largestEmptyRegion` moved slightly negative on average (97.6 ->
94.0) and the `deadSpace` critic detector fired on 1 additional scenario
out of 30 (1/30 -> 2/30). Root cause: Composition Intelligence's pipeline
runs Negative Space Correction (spreads placements out to fill a detected
hole) *before* Pattern Physics (pulls lower-importance placements toward
their nearest hero) — Attraction can re-concentrate exactly the placements
Negative Space Correction just spread apart, at a grid resolution neither
pass shares (Negative Space Correction operates on a 4x4 grid; Attraction
has no grid concept at all, just nearest-neighbor distance). **Impact**:
small — the affected metric stays well above its "problem" threshold in
all but the 1 additional flagged scenario, and no other detector (weakHero,
weakFlow) regressed. **Not fixed in this build** — see
`docs/ROADMAP.md`'s Recommended Next Build for the proposed fix (reorder
the pipeline so Attraction runs before Negative Space Correction, or align
both passes to the same grid resolution).

**Resolution (Build 001.1)**: the actual root cause was a grid-resolution
mismatch, not pass ordering — see this file's Build 001.1 section, item 1.

### 2. Pattern Physics' O(n²) cost dominates generation time for very high-instance-count layouts

`engine/patternPhysics.ts`'s `applyAttraction` computes, for every
placement, its nearest strictly-more-important neighbor via a brute-force
O(n²) scan (mirroring the same complexity `applyRhythmSmoothing` already
had in V1). For most layouts this is negligible (a few hundred
placements). For `radial` (which can place 7,000+ instances at default
density — many small ring-motifs per medallion), median generation time
increased from ~416ms to ~1039ms (measured, warmup-controlled — see
`docs/PERFORMANCE.md`). **Impact**: still well within acceptable bounds
for an interactive design tool (~1 second, not real-time), but is the
single largest per-layout slowdown this build introduced. **Not fixed in
this build** — a spatial-hash or grid-bucketed nearest-neighbor search
(the same idea `engine/scoring.ts`'s coarse occupancy grid already uses
for a different purpose) would bring this down to roughly O(n) for dense
layouts; flagged as a Recommended Next Build item.

### 3. Cluster Engine coverage is still only 3 of 14 layouts

`engine/clusterEngine.ts` (semantic clusters, natural overlap, focal
point) is only wired into `scatter`, `bouquet`, and `toss`. The other 11
layouts use their own real (non-random), but not cluster-aware, placement
math. This was a deliberate scoping decision for Build 001 (see
`docs/DESIGN_DECISIONS.md` — "audit before writing code"), not an
oversight: several of those 11 layouts (`radial`'s mandala rings,
`airy`'s deliberately sparse breathing room, the now-`REGULAR_LATTICE`
group) have a genuinely different, intentional visual identity that a
full cluster-engine rewrite would risk flattening rather than improving.
Left as a scoping decision for a future build to revisit layout-by-layout,
not a blanket "extend everywhere" task.

### 4. Style Coach / Art Direction's `fragmentedSilhouette` recommendation is advisory-only

No `DesignSpecification` field controls cluster attraction/connectivity
strength directly (Style DNA's `clusterStyle`/`clusterDensity` exist at
the raw `GenerateParams` level, not the higher-level Design Specification
schema `critic/artDirection.ts` patches). The new `increaseConnectivity`
recommendation is therefore honestly advisory-only (`specPatch: undefined`),
consistent with `weakClusters`/`lowDetail`/`repeatedScale`'s existing
convention of not fabricating a spec-level lever that doesn't exist.

---

## Build 001.1 -- Composition Quality Refinement

### 1. Section 4's fix — recorded here in full for traceability

Root-caused, not just patched: `applyNegativeSpaceCorrection` operated on
a 4x4 grid while `engine/scoring.ts`'s `largestEmptyRegion` (and the
`deadSpace` detector built on it) measures on an 8x8 grid
(`gridCoverage(instances, tileSize, 8)`) -- the correction pass was
structurally unable to see the same holes the detector penalizes. Two
reordering variants (Attraction before Negative Space Correction, in
either position) were tried first and empirically rejected -- both left
`deadSpace` unchanged and made `fragmentedSilhouette` measurably worse
(6/30 -> 8/30). A targeted "protect Negative-Space-moved indices from
Attraction" variant was also tried and measured to have zero effect once
isolated. The actual fix -- matching the grid resolution (`gridN` 4 -> 8)
-- moved `largestEmptyRegion` 94.0 -> 94.5 and `overallScore` 78.6 ->
79.6 in the same 30-scenario suite, with no regression on
`fragmentedSilhouette`, `clusterCohesion`, or `hierarchy`. Marked
**RESOLVED** — see Build 001's item 1 above for the original entry.

### 2. Section 3 (Flow Optimization) has a low ceiling with the current mechanism

7 distinct strengthenings of `applyFlowBias` were tried and measured
(higher pull strength, a pure-shear field, running the pass twice,
several diagonal/shear blends). Every variant that raised `flowCoherence`
by more than ~0.2 traded away `fragmentedSilhouette` or
`largestEmptyRegion`/overall score in the opposite direction. **Impact**:
small -- the Section 4 grid-resolution fix already recovered
`flowCoherence` as a side effect (69.3 -> 69.4-69.6). **Not fixed further
this build** -- a materially higher `flowCoherence` would need a
genuinely different mechanism (e.g. per-layout flow paths informed by
each layout's own generation), not further tuning of the existing
post-hoc global field.

### 3. `commercialScore` structurally favors hero-centric Style DNA presets

The 100-pattern Visual Portfolio Review (Section 8) found every top-20
pattern used a hero-centric layout + the `heroFocus` hierarchy preset;
minimal/airy-leaning presets never appeared in the top 20.
`commercialScore`'s weighting (Overall Score + Commercial Readiness + Hero
Visibility Score) has no style-aware adjustment for presets that are
intentionally not hero-dominant. **Impact**: a minimal-style pattern's
real commercial merit (which isn't about hero dominance) is currently
under-scored by this specific composite. **Not fixed this build** --
flagged as a Recommended Next Build item.

### 4. `densePremium`'s per-hero filler clusters trade a small isolation cost for a real hierarchy gain

Section 2's per-hero `bouquet` cluster wired into `densePremium`'s filler
tier raised `hierarchy` +7.8 (6-scenario cluster-focused suite) at a small
`isolationScore` cost (-5.6). **Impact**: small, measured, accepted --
`overallScore` for `densePremium` moved from 81.8 to 81.5 (within noise),
essentially unchanged net. Not tuned further this build.
