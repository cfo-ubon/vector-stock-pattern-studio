# Repair Engine V2 (Build 025, Phase 6)

**Status: implemented, tested, measured — reachable only via the disabled
`luxuryComposition` flag.** See `BUILD_025_AUDIT.md`.

## What existed before this build

`engine/repairPass.ts`'s existing bounded repair (Build 023/024, preserved
unchanged and still running first — see `tile.ts`) nudges individual
isolated MEMBERS toward their own cluster's anchor; it never moves a whole
cluster's anchor relative to the rest of the tile, so two clusters that are
each internally cohesive but land far from every other cluster still read
as separate islands after it runs.

## What this build adds

`engine/repairEngineV2.ts`'s `applyRepairEngineV2(placements, tileSize,
motifSize)` operates one level up: it treats a whole cluster (anchor + every
one of its own members, moved together, rigidly) as the unit a repair
action can reposition.

### Candidate simulation, not blind application

Every pass:

1. Measures the current isolated-cell count via
   `bouquetSpatialGraph.ts`'s `buildBouquetSpatialGraph` — the SAME grid/
   4-connected-wraparound rule `critic/visualAnalysis.ts`'s
   `fragmentedSilhouette` detector uses, so "isolated" here means exactly
   what the critic will penalize.
2. For every non-primary cluster (auto-detected via `Placement
   .isPrimaryCluster`, set by `luxuryFloralCompositionEngine.ts`), simulates
   pulling the WHOLE cluster (rigidly — every member's own offset from the
   others is preserved) toward its own unit's nearest primary-tagged cluster
   (`findNearestPrimary`, wrap-aware distance — a tile can hold several
   bouquet units, so "the" primary a secondary should move toward is
   whichever one actually governs its own unit, not a single tile-wide id).
3. Also simulates shrinking the largest remaining cluster's non-hero members
   (`shrinkClusterMembers`, floor 0.15, factor 0.88 per pass).
4. Applies ONLY the single candidate with the largest strictly-positive
   improvement in isolated-cell count. A pass where nothing improves stops
   the loop early (a natural fixed point), matching `repairPass.ts`'s own
   convention.

Bounded to `MAX_PASSES = 4`; each cluster-pull step moves at most
`cellSize * 0.55` per pass (`MAX_STEP_FRACTION_OF_CELL`), never the whole
remaining distance in one jump.

### Honest scope note

The brief names 8 repair priorities (restore hero dominance, connect major
masses, reduce empty channel, redirect spine, suppress secondary
competition, fix edge satellite, improve thumbnail silhouette, reduce
repair-introduced clutter). This engine implements 2 concrete, simulated
action FAMILIES (whole-cluster pull-toward-primary, and non-hero member
scale suppression) — every applied action is logged and classified against
whichever of the 8 named priorities it most directly serves
(`RepairV2ActionType`), but this is not 8 separately-coded strategies.

### Rule 8 compliance ("no random filler objects")

Both action families only ever reposition or rescale EXISTING placements —
this engine never invents a new placement, by construction.

## Where this is used

`tile.ts` calls `applyRepairEngineV2` only when `params.luxuryComposition`
is true, on the output of the pre-existing (unchanged) `repairPass.ts` pass,
before paint-order sorting. Disabled by default — see
`docs/LUXURY_FLORAL_COMPOSITION_ENGINE.md`.
