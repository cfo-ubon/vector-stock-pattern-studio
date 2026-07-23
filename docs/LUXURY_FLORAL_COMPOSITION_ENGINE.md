# Luxury Floral Composition Engine (Build 025, Phases 2-3 + 8)

**Status: implemented, tested, measured — NOT enabled in production.** See
`BUILD_025_AUDIT.md` and `BUILD_025_REPORT.md` for the full disposition.

## What existed before this build

`luxuryFloral` (and every other cluster-based Style DNA preset) used
`clusterEngine.ts`'s `placeClusterAnchors` (whole-tile anchor scatter) +
`generateCluster` (per-anchor bouquet-shaped member geometry) +
`connectClusters` (a bare `rng() > 0.35` coin flip for cross-cluster
bridges). There was no named "composition profile" concept, no dedicated
hero-vs-secondary scale contract beyond `generateCluster`'s own
`ROLE_SCALE_RANGE`, and no per-unit secondary-anchor topology — every
supporting flower's position came from `generateCluster`'s own archetype
formula, never a deliberately bounded-reach secondary mass.

## What this build adds

### Composition Profiles (`engine/luxuryCompositionProfiles.ts`)

6 named `LuxuryCompositionProfile` entries — `dominantCentral`,
`offsetEditorial`, `diagonalLuxury`, `crescentPremium`,
`asymmetricCascading`, `dualMassConnected` — each declaring, as plain
numeric/enum fields (never executable logic): `secondaryAnchorCount` range,
`maxSecondaryDistanceMul`/`minSecondaryDistanceMul` (bounded reach off the
primary, as a multiple of `clusterBaseRadius`), `primaryMassRadiusMul`/
`secondaryMassRadiusMul`, `heroCount` (1, or 2 for `dualMassConnected`'s
named secondary hero), `heroScaleFloor`/`secondaryScaleCeiling` (with
`heroScaleFloor` always strictly greater, enforced by a unit test),
`spineShape`, `allowedSatellites`, `edgeParticipation`,
`negativeSpaceCorridor`, `thumbnailSilhouetteTarget`.
`pickLuxuryCompositionProfile(rng, candidates?)` selects one deterministically
from the RNG stream (or a narrowed candidate pool).

### Hero Dominance Engine (`engine/heroDominanceEngine.ts`)

`applyHeroDominance(anchors, profile, rng)` assigns final `sizeMul` per
anchor using a discrete `SCALE_RHYTHM_FRACTIONS` cycle (mirroring
`clusterEngine.ts`'s own `SIZE_RHYTHM` convention — a small recurring set of
scale multipliers reads as an intentional beat to `engine/scoring.ts`'s
`rhythmRegularity` metric; a continuous random draw reads as noise).
Critically, every anchor's final `sizeMul` is the profile-driven fraction
**multiplied by that anchor's own pre-dominance `sizeMul`** (its unit's own
zone-anchor scale from `placeClusterAnchors`), not a flat overwrite — a tile
has multiple bouquet units at varying zone-anchor scale, and a naive
overwrite made every hero across the whole tile an identical absolute size
(see `BUILD_025_AUDIT.md`'s development history for the debug session that
caught this). Returns `HeroDominanceDiagnostics` (`dominantMassRatio`,
`focalCompetitionScore`, `thumbnailFocalClarity`) alongside the sized
anchors.

### Product-Target-Specific adjustment (Phase 8, `luxuryFloralCompositionEngine.ts`)

`applyLuxuryProductAdjustment(profile, productTarget)` tunes a handful of a
chosen profile's own already-declared numeric fields per product target
(e.g. `wallpaper` widens `primaryMassRadiusMul` and thins
`secondaryAnchorCount`; `packaging` raises `heroScaleFloor` and sets
`edgeParticipation: 'none'` for crop resilience) — it never invents a new
profile or a new field, only rescales the selected one's own ranges.
`apparel` has no dedicated `ProductUseId` in this codebase; `textile` doubles
for it, the same honest-proxy convention Build 012 documented for
`greetingCard`.

### Orchestrator (`engine/luxuryFloralCompositionEngine.ts`)

`buildLuxuryCompositionPlacements(opts, rng)` is the drop-in alternative to
`clusterEngine.ts`'s `buildClusterPlacements`, used only when
`params.luxuryComposition` is `true` (wired into `layouts/bouquet.ts` as an
early-return branch). It:

1. Scatters bouquet-UNIT primaries across the whole tile via the SAME
   `placeClusterAnchors` every other cluster layout uses (never
   reimplemented) — this is what makes a repeating tile actually tile
   multiple independent bouquet units, rather than building one composition
   for the whole canvas (an early architecture mistake this build made and
   then fixed — see `BUILD_025_AUDIT.md`).
2. Per unit, builds the profile's topology (Phase 4, see
   `docs/TOPOLOGY_AWARE_PLACEMENT.md`), applies Hero Dominance across ALL
   anchors in the tile at once (diagnostics are computed tile-wide), then
   calls `generateCluster` exactly ONCE per unit at the primary — the
   cluster's own internal members (hero/secondary/filler/accent) keep
   `generateCluster`'s already-tuned geometry untouched; only the hero
   member's final render scale is multiplied by the unit's Hero-Dominance
   `sizeMul` (`generateCluster`'s hero member always renders near 1.0
   regardless of `baseRadius`, which only spreads member distances — this
   multiplication is what makes Hero Dominance's scale actually reach the
   rendered SVG).
3. Adds the topology-guaranteed secondary/satellite anchors as single
   additional motifs tagged with the SAME `clusterId` as their own unit's
   primary (`isPrimaryCluster: true` on the cluster-internal members) —
   never as independent sub-clusters. An earlier version called
   `generateCluster` once per anchor instead, multiplying the tile's
   distinct-cluster count several-fold and diluting
   `bouquetSpatialGraph.ts`'s `reserveClusterCompanions` thinning-survivor
   budget per cluster; measured to push `fragmentedSilhouette` to 100%
   (worse than the 60% baseline). Fixed by this one-`clusterId`-per-unit
   design.
4. Scores every unit-primary pair within plausible bridging reach via
   Connector Quality (`docs/CONNECTOR_QUALITY_ENGINE.md`) and emits accepted
   bridges as accent placements.

## Repair Engine V2 integration

When `params.luxuryComposition` is true, `tile.ts` runs
`applyRepairEngineV2` (`docs/REPAIR_ENGINE_V2.md`) on the repaired placements
before paint-order sorting — a second, cluster-level repair pass on top of
the pre-existing `repairPass.ts` (unchanged, still runs first).

## Why this ships disabled

Full 300-seed measurement (`reports/build_025/fragmentation_benchmark.json`):
`fragmentedSilhouette` 60.67% → 54.67% (a real -6pp improvement, but still
far short of the ≤30% target) alongside 2 measured regressions (`deadSpace`
+8.67pp, mean commercial quality -1.91). `knowledge/registry/data/styles/
luxuryFloral.json` does not set `luxuryComposition` — production behavior is
confirmed byte-identical to Build 024. See `BUILD_025_AUDIT.md` Section 6-7
for the full data and root-cause analysis of the remaining gap.

## Reachability for a future build

`GenerateParams.luxuryComposition: boolean` and `LayoutParams.productTarget`
are real, tested fields — a future build can flip the JSON flag on
`luxuryFloral` (or any style) once the underlying node-budget-economics fix
`BUILD_025_AUDIT.md` recommends is in place, with no further wiring needed.
