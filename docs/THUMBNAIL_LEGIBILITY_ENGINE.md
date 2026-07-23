# Thumbnail Legibility Engine (Build 024, Phase 7-8)

## What existed before this build

`engine/patternReadability.ts` (Build 001.1, Section 6) already computes real,
deterministic readability at 2 named scales — `thumbnail200`, `thumbnail400`
— plus a `zoom800` seam/mechanical-artifact score reusing existing
`cornerContinuity`/`gridAppearanceScore`/`svgHealth` metrics. Real, but
coarse: each scale collapses to one number (visible-instance-fraction + a
hero-legibility boolean), no 128px tier, and no per-failure-reason
breakdown.

## What this build adds

`engine/thumbnailLegibility.ts` scores the SAME kind of real geometry at the
brief's 4 named scales — 1024/512/256/128px — with finer, named diagnostics
per scale:

- `focalPointVisible` — does the hero clear a real on-screen legibility
  floor (6px) at this display size?
- `heroRecognizablePx` — the hero's actual on-screen diameter.
- `motifMergingRisk` — fraction of instance pairs whose real vector-space
  gap becomes imperceptible (<1.25px) at this display size — computed once
  per tile (not once per scale) for performance, then evaluated per scale.
- `darkBlobRisk` — 6+ instances crowded within 1.5 motif-radii of the focal
  point, which reads as one dense mass rather than distinct shapes at small
  scale.
- `washoutRisk` — the hero barely exceeds filler/accent's own on-screen
  size, risking disappearing into surrounding texture.
- `clutterScore` — fraction of instances that are visible but too small
  (2-4px) to read as a distinct shape — "detail" that's actually noise.
- `failureReasons` — a human-readable list, not just a score.

This does NOT replace `patternReadability.ts` (still feeds the commercial
score) — it's an additive, finer-grained companion for these 4 specific
scales, the same "V1 stays, V2 is additive" precedent Build 023's
`fragmentedSilhouetteV2` established.

## Performance note (a real bug found and fixed during this build)

The naive implementation recomputed the pairwise nearest-neighbor gap
(motif-merging risk) from scratch for EACH of the 4 scales, and
`thumbnailRepair.ts`'s up-to-3-iteration loop called the whole legibility
computation once per iteration — an O(n²) pass run up to 12 times per tile.
For a premiumHero style's raw (pre-thinning) placement list, this measurably
caused an 8-item batch-generation test to time out. Fixed by computing the
vector-space nearest-gap ONCE per tile (`computeNearestGaps`, scale-
independent — only its on-screen-px interpretation changes per scale) and
capping the pairwise check entirely above 200 placements
(`MERGE_CHECK_MAX_PLACEMENTS`) as a defensive ceiling.

## Thumbnail-Aware Repair

`engine/thumbnailRepair.ts` runs up to 3 bounded, deterministic repair
passes when a tile's 128px legibility score falls below the floor (55):
enlarging the hero (bounded to +18% total). An earlier version also nudged
crowding neighbors away from the hero ("increase hero-background
separation") — removed after it was found to change WHICH placements
survive Section 10's node-budget thinning (since it repositions instances
BEFORE the thinning pass runs), measurably regressing
`botanicalBeautyMetrics.ts`'s `botanicalComplexity` score for premiumHero
tiles. Enlarging the hero alone has no such risk: the hero is
unconditionally protected from thinning, so changing only its scale can't
ripple into which other instances survive. Count-reducing repair actions
(the brief's "reduce filler count", "reduce dark mass") are intentionally
NOT implemented for the same reason.

Gated on `artDirectionModel.thumbnailIntent === 'heroMustDominate'` AND the
live `params.premiumHero` — see `docs/DEPTH_LAYERING_ENGINE.md` for why both
gates matter. Recorded in `TileData.thumbnailRepairHistory` for audit.

## Tests

`engine/thumbnailLegibility.test.ts` (7 tests) and
`engine/thumbnailRepair.test.ts` (5 tests) cover: all 4 scales scored, empty-
tile edge case, hero-illegible detection, merging-risk detection, repair
recommendations, no-op when already legible, determinism, and the bounded
enlargement cap.
