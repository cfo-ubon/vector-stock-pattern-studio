# Known Issues

Tracked, honestly-measured limitations. New builds append; resolved items
move to the relevant build's entry in `docs/CHANGELOG.md` rather than
being deleted from here silently — mark them `RESOLVED (Build NNN)` and
leave the original entry for history.

---

## Build 001 — Composition Intelligence Foundation V2

### 1. Negative Space Correction and Pattern Physics can partially offset each other

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
