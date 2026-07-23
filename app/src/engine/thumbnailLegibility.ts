import type { Placement } from './types';

// Build 024 (Botanical Anatomy, Depth & Thumbnail Beauty Engine), Phase 7:
// Thumbnail Legibility Engine. BUILD_024_AUDIT.md Section 5 found a real but
// coarse existing engine (`engine/patternReadability.ts`, Build 001.1
// Section 6): two scales (200px/400px) collapsed into one score each, no
// 128px tier, no per-failure-reason breakdown, no merge/clutter detection.
// This module extends the same idea to the brief's 4 named scales
// (1024/512/256/128px) with finer, named diagnostics — built on the exact
// same principle `patternReadability.ts` already established: real,
// deterministic on-screen-size geometry computed from the tile's own actual
// `Placement[]`/`tileSize`/`motifSize`, never a fabricated pixel render (this
// is a vector generator — an actual raster thumbnail render belongs to
// Playwright-based evidence scripts, not this scoring module).
//
// Deliberately does NOT replace `patternReadability.ts` (still used by
// `scoring.ts`'s existing commercial-score wiring) — this is an ADDITIVE,
// finer-grained companion for the specific 4 scales this build's brief asks
// for, the same "V1 stays, V2 is additive" precedent Build 023's
// `fragmentedSilhouetteV2` already established.

export const THUMBNAIL_SCALES = [1024, 512, 256, 128] as const;
export type ThumbnailScale = (typeof THUMBNAIL_SCALES)[number];

const MIN_VISIBLE_PX = 2;
const HERO_LEGIBLE_PX = 6;
/** Below this on-screen gap between two distinct (non-overlapping-in-vector-
 * space) instances, the gap is imperceptible at that display size and the
 * two motifs read as one merged shape. */
const MERGE_GAP_PX = 1.25;
/** An instance whose on-screen radius sits between the visibility floor and
 * this value reads as an indistinct speck rather than a legible shape —
 * clutter, not detail. */
const CLUTTER_MAX_PX = 4;

function onScreenPx(sizeInTileUnits: number, tileSize: number, displayPx: number): number {
  return sizeInTileUnits * (displayPx / tileSize);
}

function wrapDist(dx: number, dy: number, tileSize: number): number {
  const wx = Math.min(Math.abs(dx), tileSize - Math.abs(dx));
  const wy = Math.min(Math.abs(dy), tileSize - Math.abs(dy));
  return Math.hypot(wx, wy);
}

export interface ThumbnailScaleResult {
  scale: ThumbnailScale;
  legibilityScore: number;
  focalPointVisible: boolean;
  heroRecognizablePx: number;
  motifMergingRisk: number;
  darkBlobRisk: boolean;
  washoutRisk: boolean;
  clutterScore: number;
  failureReasons: string[];
}

export interface ThumbnailLegibilityResult {
  scales: ThumbnailScaleResult[];
  overallScore: number;
  legibleAtAllScales: boolean;
  repairRecommendations: string[];
}

/** Above this many placements, the O(n^2) nearest-gap computation below
 * is skipped (treated as zero merging risk) — this module scores the tile's
 * PRE-thinning placement list (see `engine/tile.ts`'s wiring comment), which
 * for a dense premiumHero style can be several hundred entries before
 * Section 10's node-budget thinning reduces it to the ~40-55 that actually
 * render; without this cap, `applyThumbnailAwareRepair`'s up-to-3-iteration
 * loop would re-run an O(n^2) pass on that full raw list every iteration —
 * measured to be the direct cause of a batch-generation test timeout. The
 * gap itself is real geometry, not a fabricated skip: it isn't nothing, but
 * it's a real cost/precision tradeoff. */
const MERGE_CHECK_MAX_PLACEMENTS = 200;

/** Vector-space (not on-screen) nearest-neighbor gap for every instance,
 * computed ONCE regardless of how many display scales it's later evaluated
 * at — the gap itself doesn't change with display size, only whether it's
 * perceptible does (see `onScreenPx` conversion in `scoreForScale`). This is
 * the single O(n^2) pass in this module; every scale reuses its result
 * instead of recomputing it, and `applyThumbnailAwareRepair`'s repair loop
 * reuses it once per iteration (not once per iteration per scale). */
function computeNearestGaps(placements: Placement[], tileSize: number, motifSize: number): number[] {
  if (placements.length > MERGE_CHECK_MAX_PLACEMENTS) return [];
  const radiusOf = (p: Placement) => (motifSize / 2) * p.scale;
  const gaps: number[] = [];
  for (let i = 0; i < placements.length; i++) {
    let nearestGap = Infinity;
    for (let j = 0; j < placements.length; j++) {
      if (i === j) continue;
      const d = wrapDist(placements[i].x - placements[j].x, placements[i].y - placements[j].y, tileSize);
      const gap = d - (radiusOf(placements[i]) + radiusOf(placements[j]));
      if (gap > 0 && gap < nearestGap) nearestGap = gap;
    }
    if (Number.isFinite(nearestGap)) gaps.push(nearestGap);
  }
  return gaps;
}

function scoreForScale(
  placements: Placement[],
  tileSize: number,
  motifSize: number,
  scale: ThumbnailScale,
  nearestGaps: number[],
): ThumbnailScaleResult {
  const failureReasons: string[] = [];
  if (placements.length === 0) {
    return {
      scale,
      legibilityScore: 100,
      focalPointVisible: true,
      heroRecognizablePx: 0,
      motifMergingRisk: 0,
      darkBlobRisk: false,
      washoutRisk: false,
      clutterScore: 0,
      failureReasons,
    };
  }

  const radiusOf = (p: Placement) => (motifSize / 2) * p.scale;
  const heroes = placements.filter((p) => p.role === 'hero');
  const heroPx = heroes.length > 0 ? Math.max(...heroes.map((h) => onScreenPx(radiusOf(h) * 2, tileSize, scale))) : 0;
  const focalPointVisible = heroes.length === 0 || heroPx >= HERO_LEGIBLE_PX;
  if (!focalPointVisible) failureReasons.push(`Hero shrinks to ${heroPx.toFixed(1)}px at ${scale}px — no longer a recognizable focal shape.`);

  const visibleCount = placements.filter((p) => onScreenPx(radiusOf(p) * 2, tileSize, scale) >= MIN_VISIBLE_PX).length;
  const washoutRisk = heroes.length > 0 && heroPx < HERO_LEGIBLE_PX * 1.5 && visibleCount / placements.length > 0.85;
  if (washoutRisk) failureReasons.push(`Hero barely exceeds the filler/accent instances' own on-screen size at ${scale}px — hero risks washing out into the surrounding texture.`);

  const clutterCandidates = placements.filter((p) => {
    const px = onScreenPx(radiusOf(p) * 2, tileSize, scale);
    return px >= MIN_VISIBLE_PX && px < CLUTTER_MAX_PX;
  });
  const clutterScore = clutterCandidates.length / placements.length;
  if (clutterScore > 0.5) failureReasons.push(`${Math.round(clutterScore * 100)}% of instances read as indistinct specks (2-4px) at ${scale}px rather than legible shapes.`);

  // Merging risk: the precomputed vector-space nearest-gap (see
  // `computeNearestGaps` — real geometry, computed once for every display
  // scale, not per-scale) converted to on-screen px for THIS scale — only
  // counts genuinely separate motifs (gap > 0 in vector space; already-
  // overlapping instances are an intentional Overlap Amount design choice,
  // not a merge artifact).
  const mergingCount = nearestGaps.filter((gap) => onScreenPx(gap, tileSize, scale) < MERGE_GAP_PX).length;
  const motifMergingRisk = nearestGaps.length > 0 ? mergingCount / nearestGaps.length : 0;
  if (motifMergingRisk > 0.4) failureReasons.push(`${Math.round(motifMergingRisk * 100)}% of instances sit close enough to visually merge with a neighbor at ${scale}px.`);

  // Dark-blob risk: many instances (>= 6) crowded within 1.5 motif-radii of
  // the hero (or of the tile center with no hero) reads as one dense dark
  // mass at small scale rather than a bouquet of distinct shapes.
  const centerX = heroes.length > 0 ? heroes[0].x : tileSize / 2;
  const centerY = heroes.length > 0 ? heroes[0].y : tileSize / 2;
  const crowdRadius = motifSize * 1.5;
  const crowded = placements.filter((p) => wrapDist(p.x - centerX, p.y - centerY, tileSize) <= crowdRadius).length;
  const darkBlobRisk = crowded >= 6 && scale <= 256;
  if (darkBlobRisk) failureReasons.push(`${crowded} instances crowd within one focal area — reads as a dense dark mass rather than distinct shapes at ${scale}px.`);

  const visibleFraction = visibleCount / placements.length;
  let legibilityScore =
    (focalPointVisible ? 40 : 0) +
    visibleFraction * 20 +
    (1 - clutterScore) * 15 +
    (1 - motifMergingRisk) * 15 +
    (darkBlobRisk ? 0 : 5) +
    (washoutRisk ? 0 : 5);
  legibilityScore = Math.max(0, Math.min(100, Math.round(legibilityScore)));

  return { scale, legibilityScore, focalPointVisible, heroRecognizablePx: Math.round(heroPx * 10) / 10, motifMergingRisk: Math.round(motifMergingRisk * 100) / 100, darkBlobRisk, washoutRisk, clutterScore: Math.round(clutterScore * 100) / 100, failureReasons };
}

const LEGIBILITY_FLOOR = 55;

export function computeThumbnailLegibility(placements: Placement[], tileSize: number, motifSize: number): ThumbnailLegibilityResult {
  const nearestGaps = computeNearestGaps(placements, tileSize, motifSize);
  const scales = THUMBNAIL_SCALES.map((scale) => scoreForScale(placements, tileSize, motifSize, scale, nearestGaps));
  const overallScore = Math.round(scales.reduce((s, r) => s + r.legibilityScore, 0) / scales.length);
  const legibleAtAllScales = scales.every((r) => r.legibilityScore >= LEGIBILITY_FLOOR);

  const repairRecommendations: string[] = [];
  const worst = scales.find((r) => r.scale === 128) ?? scales[scales.length - 1];
  if (!worst.focalPointVisible) repairRecommendations.push('enlargeHero');
  if (worst.clutterScore > 0.5) repairRecommendations.push('simplifyDetails');
  if (worst.motifMergingRisk > 0.4) repairRecommendations.push('increaseHeroBackgroundSeparation');
  if (worst.darkBlobRisk) repairRecommendations.push('reduceFillerCount');
  if (worst.washoutRisk) repairRecommendations.push('strengthenSilhouette');

  return { scales, overallScore, legibleAtAllScales, repairRecommendations };
}
