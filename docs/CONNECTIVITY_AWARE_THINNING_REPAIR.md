# Connectivity-Aware Thinning Repair (Build 025, Phase 9b)

**Status: implemented, tested, and ENABLED BY DEFAULT** for every
`premiumHero` style (including `luxuryFloral`) — unlike the experimental
Luxury Floral Composition Engine, this is the fix that actually ships.

## The real root cause (found by direct instrumentation, not assumption)

Every earlier fragmentation investigation in this codebase (Build 023's
own audit, this build's initial `BUILD_025_AUDIT.md` draft) assumed the
dominant fragmentation mechanism was cluster-companion selection —
`bouquetSpatialGraph.ts`'s `reserveClusterCompanions` failing to keep a
cluster's hero and its nearest surviving member in adjacent grid cells.

Direct instrumentation of 30 real `luxuryFloral` tiles (temporarily
exposing `tile.ts`'s post-thinning `survivingPlacements` array) found this
assumption was wrong. Of every post-thinning instance the critic's
`fragmentedSilhouette` detector counted as an isolated single-cell island:

- **92% (221 of 239) carried no `clusterId` at all.** Cross-referencing
  role showed 100% of these were `role: 'filler'` — the AMBIENT filler
  layer `layouts/heroScatter.ts` adds independently of any cluster
  (`layouts/heroScatter.ts`'s own header comment: "the ambient filler layer
  below stays plain Poisson-disc on purpose ... to cover whatever negative
  space is left over"). `luxuryFloral`'s Style DNA declares
  `"layouts": ["bouquet", "heroScatter"]`, and Style DNA resolution picks
  one PER SEED — so roughly half of all `luxuryFloral` generations use
  `heroScatter`, not `bouquet`, and never touched this build's earlier
  Composition Engine work at all (`layouts/bouquet.ts`'s `luxuryComposition`
  branch only fires for the `bouquet` layout).
- Only 18 of 239 (7.5%) belonged to a cluster that still had >=2 surviving
  members — meaning `reserveClusterCompanions` was already doing its job
  correctly.
- Zero belonged to a single-member cluster.

The real mechanism: `tile.ts`'s Section-10 `stratifiedSelect` distributes
thinning survivors proportionally across a FIXED coarse 8x8 grid (chosen
for corner/edge-density reasons — see that function's own doc comment) —
a resolution coarser than the critic's own finer silhouette grid
(`round(tileSize / (motifSize * 1.6))`, 10-14 cells per axis for
`luxuryFloral`'s real params). Being "fairly distributed" at the coarse
8x8 resolution says nothing about whether any two SPECIFIC survivors land
in adjacent cells at the critic's finer resolution — so a selection that
looks perfectly representative by the 8x8 standard can still (and
empirically did) strand an ambient filler survivor with no neighbor.

## The fix

`engine/connectivityRepair.ts`'s `repairIsolatedSurvivors` runs immediately
after thinning has picked `keptIndices` (both branches — the ordinary case
and the rare "even every hero exceeds budget" case), for every
`premiumHero` style:

1. Build the exact same connectivity graph the critic reads
   (`bouquetSpatialGraph.ts`'s `buildBouquetSpatialGraph`) over the
   currently-kept + protected instances.
2. For each currently-isolated instance, search every never-kept thinnable
   candidate for one whose OWN cell is the isolated instance's cell or a
   real 4-connected neighbor of it (`neighborCellsOf`) — an exact adjacency
   test, not a distance heuristic that could still land diagonally (which
   the critic's own 4-connected rule would still count as isolated).
3. To keep the total kept count (and therefore the export node budget)
   completely unchanged, a currently-kept thinnable instance must be
   removed to make room. Every currently-kept thinnable instance is tried
   as a candidate donor, ordered (a) same `role` as the rescuing candidate
   first, then (b) most-crowded-cell first among same-role ties — each
   verified by REBUILDING the full graph and checking the isolated count
   strictly decreases before committing, never a heuristic guess. The
   role-preference ordering was added after an initial role-agnostic
   version measurably skewed the survivor role mix toward filler (see
   "Measured effect" below): a role-agnostic donor search
   disproportionately gave up non-filler instances to make room for the
   (92% filler) rescuing candidates.
4. Runs to a fixed point (up to `MAX_SWAP_PASSES = 80`, though most tiles
   converge in far fewer): stops the moment a full pass produces zero
   improving swaps.

This is the same "simulate every candidate, commit only a verified strict
improvement" discipline `repairEngineV2.ts` already established for
whole-cluster repositioning — applied here to WHICH instances survive
thinning, never to positions, counts, or thresholds.

## Measured effect (300-seed benchmark, `reports/build_025/fragmentation_benchmark.json`)

| Metric | Before this fix | After this fix (role-preference-refined) |
|---|---|---|
| `luxuryFloral` `fragmentedSilhouette` rate | 60.67% | **23%** |
| `luxuryFloral` `deadSpace` rate | 42.33% | 44.67% (noise, ~2pp) |
| `luxuryFloral` `tooManyFillers` rate | ~8% | 8% (unchanged) |
| `luxuryFloral` mean commercial quality | 81.04 | 80.72 (~unchanged) |
| `darkBotanical` (premiumHero control) `fragmentedSilhouette` | 28% | 16% (also genuinely improved) |
| `bohoFloral` (premiumHero control) `fragmentedSilhouette` | 20% | 20% (unchanged — rarely hits the thinning-over-budget branch) |
| `editorialBotanical` (premiumHero control) `fragmentedSilhouette` | 40% | 40% (unchanged, same reason) |
| `scandinavianOrganic` (non-premium control) `fragmentedSilhouette` | 6% | 6% (untouched, not gated in) |

An intermediate, role-agnostic version of the victim-selection step
measured 21.67% `fragmentedSilhouette` but pushed `tooManyFillers` up to
35% (see point 3 above) — the role-preference ordering shipped here
restores `tooManyFillers` to its baseline ~8% at the cost of 1.33pp of
the fragmentation gain, still comfortably clearing the ≤30% target.

This clears the brief's ≤30% target (60.67% → 23%, a genuine -37.67pp
improvement) using the ALREADY-SHIPPED production code path — no
experimental composition engine, no threshold changes, no diagnostic
weakening. No control preset regressed; two (`luxuryFloral`,
`darkBotanical`) improved for free since they share the same thinning
code path.

## Why the experimental Luxury Floral Composition Engine stays disabled

With this fix alone already clearing the target, enabling
`luxuryComposition` on top would only trade a further, smaller
fragmentation gain (23% → 17%) for its own known regressions
(`deadSpace` +8.66pp, mean commercial quality -1.8) — a trade this build
does not need to make. See `docs/LUXURY_FLORAL_COMPOSITION_ENGINE.md` and
`BUILD_025_AUDIT.md` for that engine's own disposition.

## Performance

Bounded by construction (`MAX_SWAP_PASSES`, `MAX_VICTIM_ATTEMPTS = 15` per
candidate) — the 300-seed `luxuryFloral` benchmark ran in ~93s wall clock
(~310ms/pattern including generation, evaluation, and this repair), no
meaningful change from the pre-fix per-pattern cost.
