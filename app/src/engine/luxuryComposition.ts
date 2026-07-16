import type { MotifInstance } from './svgGeometry';
import type { CompositionMetrics } from './scoring';
import { computeVisualHierarchyScore } from './hierarchy';
import type { Placement } from './types';

// Build 009, Section 7 (Luxury Composition Rules). The brief names 7
// premium composition principles (golden visual balance, visual breathing
// room, cluster rhythm, large-medium-small hierarchy, hero isolation,
// elegant overlap, controlled complexity). Following this whole build's
// own "measure first" discipline (patternBeautyScore.ts,
// commercialStyleAnalysis.ts, portfolioQuality.ts): 6 of the 7 already have
// a real, already-computed field somewhere in this codebase -- this module
// aggregates them under their real luxury-design names rather than
// reinventing new measurements for things already measured. Only "golden
// visual balance" (how close the hero's own anchor sits to a real
// golden-ratio point of the tile) has no existing check anywhere, so it's
// the one genuinely new geometric computation here.
//
//  - Golden Visual Balance: NEW (see `computeGoldenBalance`).
//  - Visual Breathing Room: `CompositionMetrics.largestEmptyRegion`.
//  - Cluster Rhythm: `CompositionMetrics.clusterCohesion`.
//  - Large-Medium-Small Hierarchy: Build 009 Section 1's own
//    `computeVisualHierarchyScore` (`engine/hierarchy.ts`) -- how cleanly
//    the rendered hero/secondary/filler/accent tiers separate in scale,
//    reused here on the tile's own rendered `MotifInstance[]` via a small
//    field-name adapter (`role`/`scale` map straight across; `rotationDeg`/
//    `colorSeed` are filled with harmless placeholders since that function
//    never reads them).
//  - Hero Isolation: averages `heroSeparation` and `isolationScore` --
//    two already-real, genuinely distinct facets of "does the hero read as
//    deliberately set apart" (distance-based vs. crowding-based).
//  - Elegant Overlap: `CompositionMetrics.overlapQuality`.
//  - Controlled Complexity: averages `motifShapeDiversity` and
//    `heroDetailRatio` -- real detail-richness without descending into
//    visual noise is "enough shape variety, and detail concentrated where
//    it belongs (the hero)", not one single existing field alone.

/** The 4 real, well-known golden-ratio points of a unit square
 * (0.382 ~= 1 - 1/phi, 0.618 ~= 1/phi). */
const GOLDEN_LO = 0.382;
const GOLDEN_HI = 0.618;
const GOLDEN_POINTS: Array<[number, number]> = [
  [GOLDEN_LO, GOLDEN_LO],
  [GOLDEN_LO, GOLDEN_HI],
  [GOLDEN_HI, GOLDEN_LO],
  [GOLDEN_HI, GOLDEN_HI],
];

/** How close the tile's own hero instance(s) sit to a real golden-ratio
 * point (0.382/0.618 of the tile), the one genuinely new geometric check
 * this module adds. A tile with no hero-role instance returns 100 (nothing
 * to check, not a fabricated penalty) -- the same convention
 * `computeVisualHierarchyScore` already established for "too few roles to
 * meaningfully measure". Multiple heroes (some layouts place several) are
 * averaged, each scored against its own single nearest golden point. */
export function computeGoldenBalance(instances: MotifInstance[], tileSize: number): number {
  const heroes = instances.filter((i) => i.role === 'hero');
  if (heroes.length === 0) return 100;
  const scores = heroes.map((hero) => {
    const nx = (((hero.x % tileSize) + tileSize) % tileSize) / tileSize;
    const ny = (((hero.y % tileSize) + tileSize) % tileSize) / tileSize;
    const dist = Math.min(...GOLDEN_POINTS.map(([gx, gy]) => Math.hypot(nx - gx, ny - gy)));
    // A dead-center hero (0.5, 0.5) sits ~0.167 from its nearest golden
    // point; a tile corner sits ~0.382-0.618 away depending on which corner.
    // 0.35 keeps the falloff meaningful across that real range rather than
    // saturating every hero to either extreme.
    return Math.max(0, Math.min(100, Math.round(100 * (1 - dist / 0.35))));
  });
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function toPlacementLike(instance: MotifInstance): Placement {
  return { x: instance.x, y: instance.y, rotationDeg: instance.rot, scale: instance.scale, colorSeed: instance.index, role: instance.role };
}

export interface LuxuryCompositionScore {
  goldenBalance: number;
  breathingRoom: number;
  clusterRhythm: number;
  hierarchyClarity: number;
  heroIsolation: number;
  elegantOverlap: number;
  controlledComplexity: number;
  /** Unweighted mean of the 7 dimensions above -- a single "how luxury
   * does this tile's composition read" number, matching the plain-average
   * composite convention `computeIllustrationQuality`/`computeVisualRichness`
   * (portfolioQuality.ts) already established for combining several real
   * sub-scores into one headline number. */
  overall: number;
}

/** Real aggregation of the 7 named luxury composition principles -- see
 * this module's own header comment for which existing field backs each
 * one. `instances`/`tileSize` are only needed for the one genuinely new
 * check (`computeGoldenBalance`); every other dimension reads straight off
 * the already-computed `metrics`. */
export function computeLuxuryCompositionScore(instances: MotifInstance[], tileSize: number, metrics: CompositionMetrics): LuxuryCompositionScore {
  const goldenBalance = computeGoldenBalance(instances, tileSize);
  const breathingRoom = metrics.largestEmptyRegion;
  const clusterRhythm = metrics.clusterCohesion;
  const hierarchyClarity = computeVisualHierarchyScore(instances.map(toPlacementLike));
  const heroIsolation = Math.round((metrics.heroSeparation + metrics.isolationScore) / 2);
  const elegantOverlap = metrics.overlapQuality;
  const controlledComplexity = Math.round((metrics.motifShapeDiversity + metrics.heroDetailRatio) / 2);
  const overall = Math.round(
    (goldenBalance + breathingRoom + clusterRhythm + hierarchyClarity + heroIsolation + elegantOverlap + controlledComplexity) / 7,
  );
  return { goldenBalance, breathingRoom, clusterRhythm, hierarchyClarity, heroIsolation, elegantOverlap, controlledComplexity, overall };
}
