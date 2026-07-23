# BUILD 025 — Luxury Floral Composition & Stability Audit

Phase 1 of the Luxury Floral Composition & Stability Engine brief. Method:
direct inspection of the actual source (`app/src/engine/{clusterEngine,
bouquetSpatialGraph,tile,repairPass,compositionIntelligence,styleDna}.ts`,
`app/src/layouts/bouquet.ts`, `app/src/critic/visualAnalysis.ts`), the
already-rendered evidence in `reports/build_023/` and `reports/build_024/`,
and a new 300/100/50/50/50-seed empirical benchmark built for this build
(`app/scripts/build025FragmentationBenchmark.ts`,
`reports/build_025/fragmentation_benchmark.json`). All numbers below come
from that script's real, unmodified output — no numbers in this document
are estimated or hand-adjusted.

## 1. Starting point: what Build 023/024 already measured

`luxuryFloral`'s `fragmentedSilhouette` rate was 70.0% at Build 022, reduced
to 60.0% by Build 024's `MAX_ITERATIONS` sweep (`repairPass.ts`). Both prior
builds explicitly disclosed this was well above a healthy target and that
the dominant remaining mechanism was **node-budget thinning economics**, not
raw cluster geometry: `tile.ts`'s Section-10 `stratifiedSelect` thinning
discards roughly 90% of raw placements, and `bouquetSpatialGraph.ts`'s
`reserveClusterCompanions` can only guarantee one surviving companion per
distinct `clusterId` — so however many independent clusters populate a
tile, they compete for a *fixed* thinning survivor budget. More distinct
clusters (holding node budget constant) mechanically means fewer survivors
per cluster, which mechanically means more single-cell "confetti" islands
once `critic/visualAnalysis.ts`'s `computeSilhouetteCohesion` flood-fills
the final rendered instances.

This build re-measured the 60.0% baseline at full scale (300 seeds,
`m25-1`..`m25-300`, `luxuryFloral`, `luxuryComposition` left at its shipped
default) and got **60.67%** — consistent with Build 024's number within
sampling noise, confirming the starting point is accurate and unchanged.

## 2. Failure-seed classification (17 named categories from the brief)

Every one of the 300 baseline seeds was scored through
`critic/visualAnalysis.ts`'s full `VisualIssueId` detector set via
`scripts/qualityReport.ts`'s `visualIssueRates`. Real per-category rates
(n=300, `luxuryFloral`, current production defaults):

| Category (`VisualIssueId`) | Rate |
|---|---|
| `fragmentedSilhouette` | 60.67% |
| `deadSpace` | 42.33% |
| `tooManyFillers` | 8.00% |
| `repeatedScale` | 5.00% |
| `repeatedRotation` | 1.67% |
| `weakHierarchy` | 0.67% |
| `mechanicalSpacing` | 0.33% |
| `weakHero`, `gridAppearance`, `weakClusters`, `lowDetail`, `weakFlow`, `crowdedAreas`, `lowHeroVisibility` | 0.00% |

`critic/visualAnalysis.ts` only defines these `VisualIssueId` detectors —
the brief names additional descriptive categories (e.g. "isolated hero with
no supporting foliage," "disconnected mass," "weak connector," "thumbnail
confetti") that are sub-cases of `fragmentedSilhouette` rather than
separately-detected conditions in this codebase; distinguishing them further
would require building new detectors, which was out of scope for an audit
phase. The dominant, and effectively only structurally significant, failure
category is `fragmentedSilhouette` itself, with `deadSpace` as a distant
second — matching Build 023/024's own findings.

## 3. Root cause, confirmed by direct code inspection (not re-derived from scratch)

1. **`clusterEngine.ts`'s `placeClusterAnchors`** scatters one anchor per
   independent bouquet unit across the whole tile — each anchor gets its own
   `clusterId`. `luxuryFloral`'s `clusterDensity: 0.6` and `density: 0.55`
   (`knowledge/registry/data/styles/luxuryFloral.json`) produce enough
   anchors that, after Section-10 thinning, most clusters keep 0-1 surviving
   companions.
2. **`bouquetSpatialGraph.ts`'s `reserveClusterCompanions`** is a real,
   already-tuned mitigation (Build 023) but is bounded by
   `maxReservations` — it cannot invent more surviving budget than the tile
   has, only redistribute the existing budget more fairly across clusters.
3. **`critic/visualAnalysis.ts`'s `computeSilhouetteCohesion`** measures
   connectivity on a `tileSize / (motifSize * 1.6)` grid over the FINAL,
   post-thinning rendered instances — meaning any fix must survive all the
   way through generation, thinning, and repair to change the measured rate;
   fixing pre-thinning cluster geometry alone (which several `SIZE_RHYTHM`/
   spacing experiments during this build targeted) does not reliably move
   this number, because thinning re-derives the isolated/connected structure
   from whatever survives, largely independent of the raw pre-thinning
   layout's own quality.

## 4. What this build attempted (Phases 2-8) and what it actually measured

A full, real, working Composition Profile / Hero Dominance / Topology-Aware
Placement / Connector Quality / Repair Engine V2 system was built
(`engine/luxuryCompositionProfiles.ts`, `engine/topologyPlacement.ts`,
`engine/heroDominanceEngine.ts`, `engine/connectorQuality.ts`,
`engine/repairEngineV2.ts`, `engine/wrapCohesion.ts`,
`engine/luxuryFloralCompositionEngine.ts`), gated behind
`GenerateParams.luxuryComposition` and wired into `layouts/bouquet.ts` and
`tile.ts`. It was NOT a rewrite of botanical anatomy, species data, or the
`fragmentedSilhouette`/READY-REVIEW-REJECT thresholds — those were left
untouched per the brief's explicit constraints.

Full-scale (300 paired seeds, `m25-1`..`m25-300`, identical seed set for
both arms) measurement of the finished engine, `luxuryComposition: true` vs
the shipped default:

| Metric | Baseline (off) | Experimental (on) | Delta |
|---|---|---|---|
| `fragmentedSilhouette` rate | 60.67% | 54.67% | **-6.00pp (real improvement)** |
| `deadSpace` rate | 42.33% | 51.00% | **+8.67pp (regression)** |
| `absoluteCommercialQuality` mean | 81.04 | 79.13 | **-1.91 (regression)** |
| `repeatedScale` rate | 5.00% | 11.67% | +6.67pp (regression) |
| node count mean | 5997.9 | 5988.4 | ~unchanged (export cost neutral) |

Raw data: `reports/build_025/fragmentation_benchmark.json` (includes the
4-preset control set below).

**This is a genuine, measurable improvement on the brief's primary named
metric** — the new engine's Hero Dominance + Topology-Aware Placement +
Connector Quality mechanisms do reduce fragmentation, confirming the
architectural direction (multiple tiled bouquet UNITS, one `clusterId` per
unit, topology-guaranteed secondary anchors within bounded reach, scored
rather than coin-flip connectors) is sound. **It does not clear the brief's
≤30% target** (54.67% vs a ≤30%, preferably ≤20%, bar — more than 24
percentage points short), and it introduces two real, measured regressions
(`deadSpace` +8.67pp, mean commercial quality -1.91) that the brief's PASS
criteria do not allow to be waived. See Section 6 for the resulting
disposition.

## 5. Control set — confirms zero collateral effect on other presets

`luxuryComposition` is never set `true` for any preset other than
(experimentally, in-memory only) `luxuryFloral` — the JSON preset flag was
added and then removed during this build (Section 6). Measured anyway, at
full scale, to verify this build's wiring changes
(`Placement.isPrimaryCluster`, `LayoutParams.luxuryComposition`/
`productTarget`, `tile.ts`'s conditional Repair Engine V2 call) introduce no
drift on presets that don't opt in:

| Preset | n | `fragmentedSilhouette` | `deadSpace` | commercial mean |
|---|---|---|---|---|
| `scandinavianOrganic` (strong non-premium control, per Build 023 convention) | 100 | 6.00% | 0.00% | 86.49 |
| `bohoFloral` (premiumHero) | 50 | 20.00% | 0.00% | 82.50 |
| `darkBotanical` (premiumHero) | 50 | 28.00% | 12.00% | 83.78 |
| `editorialBotanical` (premiumHero) | 50 | 40.00% | 16.00% | 85.40 |

These numbers are consistent with the pre-existing (Build 023/024) system's
known behavior for these presets — no code path shared with the new engine
executes for them (`params.luxuryComposition` is `undefined`/falsy), so this
is a confirmation measurement, not a new finding.

## 6. Disposition: shipped disabled by default

Because the finished engine does not meet the ≤30% fragmentation bar and
introduces measured regressions on `deadSpace` and mean commercial quality,
`luxuryComposition` is **not** enabled in
`knowledge/registry/data/styles/luxuryFloral.json` — the flag was added
during development, measured, and then explicitly removed so production
`luxuryFloral` generation is confirmed byte-identical to the Build 024
baseline (re-verified: 60.67% fragmentation / 42.33% deadSpace / 81.04
commercial at this build's own 300-seed scale, matching Section 1's
re-measurement of the pre-existing baseline). The new engine modules remain
in the codebase as real, tested, working infrastructure
(`app/src/engine/luxuryCompositionProfiles.test.ts`,
`topologyPlacement.test.ts`, `heroDominanceEngine.test.ts`,
`connectorQuality.test.ts`, `repairEngineV2.test.ts`, `wrapCohesion.test.ts`,
`luxuryFloralCompositionEngine.test.ts`), reachable via
`GenerateParams.luxuryComposition` for any future build that wants to
continue tuning from this point, but they do not affect any currently
shipped output.

## 7. Recommended next steps (not undertaken in this build)

1. The remaining fragmentation gap is a node-budget economics problem, not
   (primarily) a geometry problem — Section 3's root cause. A future build
   should investigate raising `luxuryFloral`'s thinning survivor budget
   specifically (a `richnessBudget.ts`-level change), rather than further
   anchor/topology tuning, which this build's 300-seed data shows has a real
   but bounded effect (-6pp) on its own.
2. The `deadSpace` regression (+8.67pp) traces to the topology-guaranteed
   secondary/satellite anchors' bounded-reach placement pulling members
   systematically closer to their unit's primary than
   `placeClusterAnchors`'s own whole-tile scatter would otherwise leave
   them — worth re-examining `LuxuryCompositionProfile.maxSecondaryDistanceMul`
   per profile against `patternPhysics.ts`'s negative-space targets before
   any further fragmentation tuning.
3. `wrapCohesion.ts` (Phase 7) is implemented and unit-tested but was never
   wired into connector scoring or empirically benchmarked — a real,
   available lever for a follow-up build.
