# Luxury Floral Fragmentation Benchmark — Build 023

Dedicated deep-dive on `luxuryFloral`, the preset the brief itself names as
carrying the primary unresolved `fragmentedSilhouette` defect (100% failure
rate in Build 022's own 450-pattern diagnostic matrix).

## Sample A: 30-seed diagnostic matrix (`m22-1`..`m22-30`, same methodology as Build 022's own baseline)

Source: `reports/build_022/STYLE_DNA_DIAGNOSTIC_MATRIX.json` (before) vs.
`reports/build_023/STYLE_DNA_DIAGNOSTIC_MATRIX.json` (after, this build).

| Metric | Before (Build 022) | After (Build 023) | Delta |
|---|---|---|---|
| `fragmentedSilhouette` rate | 100% | 70% | -30pp |
| `deadSpace` rate | not separately reported (top failure was fragmentedSilhouette) | 36.7% | new tradeoff, see below |
| Absolute Commercial Quality (V1) | 63.27 | 82.43 | +19.16 |
| Absolute Commercial Quality (V2) | 63.27 | 82.43 | +19.16 |

## Sample B: 20-seed before/after visual evidence set (`m22-1`..`m22-20`, `reports/build_023/before_after/`)

| Metric | Before | After |
|---|---|---|
| `fragmentedSilhouette` rate | 100% | 65% |
| Absolute Commercial Quality (V1/V2) | 61.10 | 82.00 |
| Pairs showing measurable improvement (commercial score +0.5 or fragmentation resolved, no regression) | — | 16/20 (80.0%) |

Both independent samples agree: a large, real reduction in fragmentation
rate, paired with a substantial, real commercial-score improvement — not a
threshold-gaming artifact (the diagnostic that flags fragmentation was never
modified, per the build's own non-negotiable rule).

## Root cause and mechanism (see `BUILD_023_AUDIT.md` for full derivation)

1. `engine/tile.ts`'s Section-10 node-budget thinning discards the large
   majority of raw cluster placements (empirically ~500-560 raw placements
   down to ~40-55 survivors for a typical `luxuryFloral` tile), frequently
   leaving a hero with zero surviving companions.
2. `layouts/heroScatter.ts` (used by roughly half of `luxuryFloral`'s
   samples) never tagged cluster identity at all before this build, so none
   of the cluster-aware fixes could reach it.
3. Even with a guaranteed 1 surviving companion per cluster
   (`reserveClusterCompanions`), the raw cluster geometry's own
   member-to-hero distance (`clusterBaseRadius`) is numerically close to the
   silhouette detector's own grid cell size, so a companion frequently still
   lands in a different cell than its hero.

Fix: `anchorSpacingMultiplier` (2.0x for `premiumHero` styles) widens
spacing between cluster *anchors* (fewer, larger, better-separated
clusters) without widening intra-cluster member spread — combined with
`reserveClusterCompanions` (guarantee a companion) and
`applyBouquetRepairPass` (pull stray members toward their anchor before
thinning).

## Honest residual gap: not fully resolved

`luxuryFloral`'s fragmentation rate is reduced by 30-35 percentage points,
not eliminated. 65-70% of samples still trigger the diagnostic. The
anchor-spacing fix was tuned (1.6x / 2.0x / 2.5x tested) to the point of
diminishing returns — 2.5x pushed `deadSpace` rate too high and commercial
scores began declining, so 2.0x was kept as the best real tradeoff found.
Further reduction would need the composition-level work (Steps 2-3 of the
Visual Beauty brief: an explicit bouquet composition engine with a
guaranteed dominant focal mass) that this build did not implement — see
`BUILD_023_REPORT.md`'s verdict section.

## Tradeoff: deadSpace rose alongside the fragmentation fix

Widening anchor spacing necessarily increases visible empty area between
clusters. `deadSpace` rate rose from a value not separately broken out in
Build 022's matrix (fragmentedSilhouette was the dominant/reported failure
mode) to 36.7% in this build's own matrix. Net effect on commercial score
is still strongly positive (+19 points), but this tradeoff is real and
should be weighed, not hidden, in the final PASS/FAIL decision.
