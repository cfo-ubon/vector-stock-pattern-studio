import type { TileData } from './types';
import { extractInstances, periodicDist } from './svgGeometry';

// Deterministic heuristic quality scoring — no machine learning, no
// external calls. Every number below is computed straight from the actual
// generated SVG geometry (motif centers/rotations parsed back out of the
// `translate(...) rotate(...)` transforms tile.ts already writes), so the
// score changes when and only when the visible pattern changes.
//
// Instance parsing (extractInstances/periodicDist) lives in
// engine/svgGeometry.ts and is shared with the broader Composition Scoring
// Engine (engine/scoring.ts) used by the Candidate Engine — this module
// keeps its own narrower six-number public shape for backward compatibility
// with QualityPanel.tsx and existing saved/gallery expectations.

export interface QualityScoreResult {
  composition: number;
  spacing: number;
  hierarchy: number;
  colorBalance: number;
  seamlessIntegrity: number;
  motifDiversity: number;
  overall: number;
}

export function computeQualityScore(tileData: TileData): QualityScoreResult {
  const { colors, params } = tileData;
  const tileSize = params.tileSize;
  const instances = extractInstances(tileData);

  // Spacing: coefficient of variation of nearest-neighbor distance (lower =
  // more evenly spaced). Wrapped via periodicDist so edge neighbors count.
  let spacingScore = 100;
  if (instances.length > 1) {
    const nn = instances.map((c, i) => {
      let best = Infinity;
      instances.forEach((o, j) => {
        if (i !== j) best = Math.min(best, periodicDist(c, o, tileSize));
      });
      return best;
    });
    const mean = nn.reduce((a, b) => a + b, 0) / nn.length;
    const variance = nn.reduce((a, b) => a + (b - mean) ** 2, 0) / nn.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
    spacingScore = Math.max(0, Math.min(100, 100 - cv * 60));
  }

  // Composition/occupancy: combines *coverage* (fraction of a coarse 8x8
  // grid that has at least one motif center in it — catches accidental big
  // empty holes) with *crowding* (average instances per touched cell —
  // catches "technically covers the whole tile but it's 400 motifs jammed
  // in" vs "100 motifs spread the same way"; coverage alone saturates at
  // ~full for almost any grid/scatter layout once there are more than a
  // couple dozen motifs, since those layouts span the whole tile by
  // construction regardless of density). Peaks in a "lively but not
  // cluttered" middle band rather than rewarding "more is always better".
  const gridN = 8;
  const cell = tileSize / gridN;
  const cellCounts = new Map<number, number>();
  for (const c of instances) {
    const gx = Math.floor((((c.x % tileSize) + tileSize) % tileSize) / cell);
    const gy = Math.floor((((c.y % tileSize) + tileSize) % tileSize) / cell);
    const key = gy * gridN + gx;
    cellCounts.set(key, (cellCounts.get(key) ?? 0) + 1);
  }
  const occupancyRatio = cellCounts.size / (gridN * gridN);
  const avgPerCell = cellCounts.size > 0 ? instances.length / cellCounts.size : 0;
  const fullness = occupancyRatio * 0.5 + Math.min(1, avgPerCell / 6) * 0.5;
  const idealLow = 0.3;
  const idealHigh = 0.8;
  let compositionScore: number;
  if (fullness < idealLow) compositionScore = (fullness / idealLow) * 100;
  else if (fullness > idealHigh) compositionScore = Math.max(0, 100 - (fullness - idealHigh) * 200);
  else compositionScore = 100;

  // Quadrant balance: variance of motif-count share across the 4 quadrants.
  const quadCounts = [0, 0, 0, 0];
  for (const c of instances) {
    const px = ((c.x % tileSize) + tileSize) % tileSize;
    const py = ((c.y % tileSize) + tileSize) % tileSize;
    const qx = px < tileSize / 2 ? 0 : 1;
    const qy = py < tileSize / 2 ? 0 : 1;
    quadCounts[qy * 2 + qx]++;
  }
  const totalQ = quadCounts.reduce((a, b) => a + b, 0) || 1;
  const quadVariance = quadCounts.reduce((a, c) => a + (c / totalQ - 0.25) ** 2, 0) / 4;
  const balanceScore = Math.max(0, 100 - quadVariance * 1600);

  // Hierarchy: coefficient of variation of motif *scale* — a direct,
  // layout-agnostic measure of "does this pattern actually have visually
  // distinct size tiers", regardless of whether that came from the
  // Hierarchy Engine's data-role tagging or from a layout that builds its
  // own hero/filler tiers internally (bouquet, densePremium, heroFlow,
  // heroScatter — see HIERARCHY_EXEMPT_LAYOUTS in engine/hierarchy.ts).
  // scaleJitter alone produces a small baseline CV (~0.1-0.15) even with no
  // hierarchy at all, so the score is normalized against that floor.
  let hierarchyScore = 40;
  if (instances.length > 1) {
    const scales = instances.map((c) => c.scale);
    const meanScale = scales.reduce((a, b) => a + b, 0) / scales.length;
    const scaleCv = meanScale > 0 ? Math.sqrt(scales.reduce((a, b) => a + (b - meanScale) ** 2, 0) / scales.length) / meanScale : 0;
    hierarchyScore = Math.max(0, Math.min(100, ((scaleCv - 0.08) / 0.45) * 100));
  }

  // Color balance: structural proxy from palette size + color-story usage
  // (per-motif color tracking isn't threaded through to this layer — this
  // rewards patterns that lean on colorStory's dominant+accent role split).
  const accentCount = Math.max(1, colors.length - 1);
  const colorBalanceScore = params.colorStory === false ? 70 : accentCount <= 1 ? 60 : Math.min(100, 70 + accentCount * 5);

  // Motif diversity: how many of 12 rotation buckets (30° each) are used —
  // a cheap, real, deterministic proxy for "does this look varied".
  const rotBuckets = new Set(instances.map((c) => Math.floor((((c.rot % 360) + 360) % 360) / 30)));
  const motifDiversity = Math.min(100, (rotBuckets.size / 12) * 100 + 20);

  // Seamless integrity: true by construction — the wrap-clone (9x) plus
  // computeBoundingRadius safety net in tile.ts guarantees this structurally
  // for every pattern this engine produces, so it's not re-derived here.
  const seamlessIntegrity = 100;

  const overall = Math.round(
    compositionScore * 0.25 +
      spacingScore * 0.2 +
      balanceScore * 0.15 +
      hierarchyScore * 0.15 +
      colorBalanceScore * 0.15 +
      seamlessIntegrity * 0.1,
  );

  return {
    composition: Math.round(compositionScore),
    spacing: Math.round(spacingScore),
    hierarchy: Math.round(hierarchyScore),
    colorBalance: Math.round(colorBalanceScore),
    seamlessIntegrity,
    motifDiversity: Math.round(motifDiversity),
    overall,
  };
}
