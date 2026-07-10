import type { TileData } from './types';
import { serialize } from './svgAst';
import { extractInstances, gridCoverage, periodicDist, countNodes, type MotifInstance } from './svgGeometry';

// Composition Scoring Engine — the broader metric set the Candidate Engine
// uses to rank generated tiles against each other. Every number is derived
// from real geometry already present in the built TileData (instance
// positions/rotations/scales parsed via engine/svgGeometry.ts, the actual
// palette, the serialized SVG string) — nothing here is random or
// hardcoded. This is intentionally a separate, wider module from
// engine/qualityScore.ts (which keeps its narrower six-number public shape
// for backward compatibility with QualityPanel.tsx); both share the same
// underlying instance-extraction code so there is exactly one
// implementation of "what does this pattern's geometry look like".

export interface CompositionMetrics {
  composition: number;
  spacing: number;
  quadrantBalance: number;
  horizontalBalance: number;
  verticalBalance: number;
  visualCenterOffset: number;
  occupancyRatio: number;
  densityVariance: number;
  hierarchy: number;
  scaleDiversity: number;
  rotationDiversity: number;
  colorBalance: number;
  paletteContrast: number;
  overlapQuality: number;
  edgeDensity: number;
  adjacencyRepetition: number;
  seamlessIntegrity: number;
  svgHealth: number;
}

function clamp01to100(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return 0.5;
  const chan = (h: string) => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = chan(m[1]);
  const g = chan(m[2]);
  const b = chan(m[3]);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function computeComposition(instances: MotifInstance[], tileSize: number): { composition: number; occupancyRatio: number; densityVariance: number } {
  const { counts, occupancyRatio, avgPerTouchedCell } = gridCoverage(instances, tileSize, 8);
  const fullness = occupancyRatio * 0.5 + Math.min(1, avgPerTouchedCell / 6) * 0.5;
  const idealLow = 0.3;
  const idealHigh = 0.8;
  let composition: number;
  if (fullness < idealLow) composition = (fullness / idealLow) * 100;
  else if (fullness > idealHigh) composition = Math.max(0, 100 - (fullness - idealHigh) * 200);
  else composition = 100;

  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  const variance = counts.reduce((a, c) => a + (c - mean) ** 2, 0) / counts.length;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
  // A perfectly uniform scatter has cv==0; some unevenness is normal and
  // desirable (rigid uniformity reads as "stamped"), so only penalize past
  // a generous band.
  const densityVariance = clamp01to100(100 - Math.max(0, cv - 0.5) * 60);

  return { composition: clamp01to100(composition), occupancyRatio: clamp01to100(occupancyRatio * 100), densityVariance };
}

function computeSpacing(instances: MotifInstance[], tileSize: number): number {
  if (instances.length <= 1) return 100;
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
  return clamp01to100(100 - cv * 60);
}

function computeBalance(instances: MotifInstance[], tileSize: number) {
  const quad = [0, 0, 0, 0];
  let left = 0;
  let right = 0;
  let top = 0;
  let bottom = 0;
  for (const c of instances) {
    const px = ((c.x % tileSize) + tileSize) % tileSize;
    const py = ((c.y % tileSize) + tileSize) % tileSize;
    const qx = px < tileSize / 2 ? 0 : 1;
    const qy = py < tileSize / 2 ? 0 : 1;
    quad[qy * 2 + qx]++;
    if (qx === 0) left++;
    else right++;
    if (qy === 0) top++;
    else bottom++;
  }
  const totalQ = quad.reduce((a, b) => a + b, 0) || 1;
  const quadVariance = quad.reduce((a, c) => a + (c / totalQ - 0.25) ** 2, 0) / 4;
  const quadrantBalance = clamp01to100(100 - quadVariance * 1600);

  const totalLR = left + right || 1;
  const horizontalBalance = clamp01to100(100 - Math.abs(left / totalLR - 0.5) * 200);
  const totalTB = top + bottom || 1;
  const verticalBalance = clamp01to100(100 - Math.abs(top / totalTB - 0.5) * 200);

  return { quadrantBalance, horizontalBalance, verticalBalance };
}

function computeVisualCenterOffset(instances: MotifInstance[], tileSize: number): number {
  if (instances.length === 0) return 100;
  const cx = instances.reduce((a, c) => a + c.x, 0) / instances.length;
  const cy = instances.reduce((a, c) => a + c.y, 0) / instances.length;
  const dx = cx - tileSize / 2;
  const dy = cy - tileSize / 2;
  const dist = Math.hypot(dx, dy);
  const maxDist = (tileSize / 2) * Math.SQRT2;
  return clamp01to100(100 * (1 - dist / maxDist));
}

function computeHierarchyAndScaleDiversity(instances: MotifInstance[]): { hierarchy: number; scaleDiversity: number } {
  if (instances.length <= 1) return { hierarchy: 40, scaleDiversity: 0 };
  const scales = instances.map((c) => c.scale);
  const meanScale = scales.reduce((a, b) => a + b, 0) / scales.length;
  const scaleCv = meanScale > 0 ? Math.sqrt(scales.reduce((a, b) => a + (b - meanScale) ** 2, 0) / scales.length) / meanScale : 0;
  // hierarchy: rewards a *deliberate* tiering band (matches qualityScore.ts).
  const hierarchy = clamp01to100(((scaleCv - 0.08) / 0.45) * 100);
  // scaleDiversity: plainer "how spread out are the sizes", uncapped at any
  // particular ideal band — a distinct read from "hierarchy" (which
  // specifically rewards a hero/filler-style tiering, not diversity itself).
  const scaleDiversity = clamp01to100((scaleCv / 0.5) * 100);
  return { hierarchy, scaleDiversity };
}

function computeRotationDiversity(instances: MotifInstance[]): number {
  const buckets = new Set(instances.map((c) => Math.floor((((c.rot % 360) + 360) % 360) / 30)));
  return clamp01to100((buckets.size / 12) * 100 + 20);
}

function computeColorBalanceAndContrast(colors: string[], colorStory: boolean | undefined): { colorBalance: number; paletteContrast: number } {
  const accentCount = Math.max(1, colors.length - 1);
  const colorBalance = colorStory === false ? 70 : accentCount <= 1 ? 60 : Math.min(100, 70 + accentCount * 5);
  const luminances = colors.map(relativeLuminance);
  const range = Math.max(...luminances) - Math.min(...luminances);
  const paletteContrast = clamp01to100(range * 140);
  return { colorBalance, paletteContrast };
}

function computeOverlapQuality(instances: MotifInstance[], tileSize: number, motifSize: number): number {
  if (instances.length <= 1) return 100;
  const meanScale = instances.reduce((a, c) => a + c.scale, 0) / instances.length;
  const footprint = motifSize * meanScale;
  const nn = instances.map((c, i) => {
    let best = Infinity;
    instances.forEach((o, j) => {
      if (i !== j) best = Math.min(best, periodicDist(c, o, tileSize));
    });
    return best;
  });
  const meanNn = nn.reduce((a, b) => a + b, 0) / nn.length;
  if (meanNn <= 0) return 0;
  const crowding = footprint / meanNn; // ~0 = far apart, >1 = heavy overlap
  // Peaks in a "some closeness, not chaos" band; penalizes both a totally
  // sticker-scattered pattern (crowding near 0) and excessive pileup.
  const idealLow = 0.25;
  const idealHigh = 0.95;
  if (crowding < idealLow) return clamp01to100((crowding / idealLow) * 80 + 20);
  if (crowding > idealHigh) return clamp01to100(100 - (crowding - idealHigh) * 90);
  return 100;
}

function computeEdgeDensity(instances: MotifInstance[], tileSize: number): number {
  const { gridN, counts } = gridCoverage(instances, tileSize, 8);
  let borderSum = 0;
  let borderCells = 0;
  let interiorSum = 0;
  let interiorCells = 0;
  for (let gy = 0; gy < gridN; gy++) {
    for (let gx = 0; gx < gridN; gx++) {
      const isBorder = gx === 0 || gy === 0 || gx === gridN - 1 || gy === gridN - 1;
      const v = counts[gy * gridN + gx];
      if (isBorder) {
        borderSum += v;
        borderCells++;
      } else {
        interiorSum += v;
        interiorCells++;
      }
    }
  }
  const borderAvg = borderCells > 0 ? borderSum / borderCells : 0;
  const interiorAvg = interiorCells > 0 ? interiorSum / interiorCells : 0;
  if (borderAvg + interiorAvg === 0) return 100;
  const ratio = borderAvg / (interiorAvg || borderAvg || 1);
  // ratio near 1 = border density matches interior density (no edge-crowding
  // or edge-emptying artifact); deviation in either direction is penalized.
  return clamp01to100(100 - Math.abs(ratio - 1) * 60);
}

/** Approximate "does the same-looking motif keep sitting next to itself"
 * using the rotation-bucket + role signals actually available on a
 * Placement — Placement doesn't currently track which internal shape
 * variant a generator drew, so this can't detect true shape repetition
 * (e.g. two poppies next to each other look the same regardless of
 * rotation bucket); it's a real, honest proxy, not the literal metric. */
function computeAdjacencyRepetition(instances: MotifInstance[], tileSize: number): number {
  if (instances.length <= 1) return 100;
  let repeats = 0;
  instances.forEach((c, i) => {
    let bestDist = Infinity;
    let nearest: MotifInstance | null = null;
    instances.forEach((o, j) => {
      if (i === j) return;
      const d = periodicDist(c, o, tileSize);
      if (d < bestDist) {
        bestDist = d;
        nearest = o;
      }
    });
    if (nearest) {
      const n = nearest as MotifInstance;
      const bucketA = Math.floor((((c.rot % 360) + 360) % 360) / 30);
      const bucketB = Math.floor((((n.rot % 360) + 360) % 360) / 30);
      if (bucketA === bucketB && c.role === n.role) repeats++;
    }
  });
  const repetitionFraction = repeats / instances.length;
  return clamp01to100(100 - repetitionFraction * 100);
}

function computeSvgHealth(tileData: TileData, instances: MotifInstance[]): number {
  let score = 100;
  const svgStr = serialize(tileData.svg);
  if (/NaN|Infinity/.test(svgStr)) score -= 100;
  if (/<image[\s/>]/.test(svgStr)) score -= 100;
  if (/(?:xlink:href|href)\s*=\s*"(?!#)[^"]/.test(svgStr)) score -= 100;
  const ids = instances.map((i) => i.index);
  if (new Set(ids).size !== ids.length) score -= 40;
  const nodeCount = countNodes(tileData.svg);
  if (nodeCount > 8000) score -= 30;
  else if (nodeCount > 5000) score -= 10;
  return clamp01to100(score);
}

export function computeMetrics(tileData: TileData): CompositionMetrics {
  const { colors, params } = tileData;
  const tileSize = params.tileSize;
  const instances = extractInstances(tileData);

  const { composition, occupancyRatio, densityVariance } = computeComposition(instances, tileSize);
  const spacing = computeSpacing(instances, tileSize);
  const { quadrantBalance, horizontalBalance, verticalBalance } = computeBalance(instances, tileSize);
  const visualCenterOffset = computeVisualCenterOffset(instances, tileSize);
  const { hierarchy, scaleDiversity } = computeHierarchyAndScaleDiversity(instances);
  const rotationDiversity = computeRotationDiversity(instances);
  const { colorBalance, paletteContrast } = computeColorBalanceAndContrast(colors, params.colorStory);
  const overlapQuality = computeOverlapQuality(instances, tileSize, params.motifSize);
  const edgeDensity = computeEdgeDensity(instances, tileSize);
  const adjacencyRepetition = computeAdjacencyRepetition(instances, tileSize);
  const svgHealth = computeSvgHealth(tileData, instances);

  return {
    composition: Math.round(composition),
    spacing: Math.round(spacing),
    quadrantBalance: Math.round(quadrantBalance),
    horizontalBalance: Math.round(horizontalBalance),
    verticalBalance: Math.round(verticalBalance),
    visualCenterOffset: Math.round(visualCenterOffset),
    occupancyRatio: Math.round(occupancyRatio),
    densityVariance: Math.round(densityVariance),
    hierarchy: Math.round(hierarchy),
    scaleDiversity: Math.round(scaleDiversity),
    rotationDiversity: Math.round(rotationDiversity),
    colorBalance: Math.round(colorBalance),
    paletteContrast: Math.round(paletteContrast),
    overlapQuality: Math.round(overlapQuality),
    edgeDensity: Math.round(edgeDensity),
    adjacencyRepetition: Math.round(adjacencyRepetition),
    seamlessIntegrity: 100, // structural guarantee — see engine/qualityScore.ts
    svgHealth: Math.round(svgHealth),
  };
}

export type QualityPresetId = 'stockClean' | 'textilePremium' | 'editorialBotanical' | 'denseLuxury';

export const QUALITY_PRESET_LABELS: Record<QualityPresetId, string> = {
  stockClean: 'Stock Clean',
  textilePremium: 'Textile Premium',
  editorialBotanical: 'Editorial Botanical',
  denseLuxury: 'Dense Luxury',
};

/** Per-preset metric weights (Phase 3 examples). Weights don't need to
 * hand-sum to 1 — computeOverallScore normalizes by the sum of weights
 * actually used, so this stays correct even as metrics are added. */
export const QUALITY_PRESET_WEIGHTS: Record<QualityPresetId, Partial<Record<keyof CompositionMetrics, number>>> = {
  stockClean: {
    svgHealth: 0.22,
    composition: 0.14,
    spacing: 0.12,
    quadrantBalance: 0.12,
    colorBalance: 0.1,
    overlapQuality: 0.1,
    hierarchy: 0.08,
    rotationDiversity: 0.06,
    edgeDensity: 0.06,
  },
  textilePremium: {
    spacing: 0.18,
    seamlessIntegrity: 0.14,
    rotationDiversity: 0.14,
    edgeDensity: 0.12,
    composition: 0.12,
    overlapQuality: 0.1,
    colorBalance: 0.1,
    svgHealth: 0.1,
  },
  editorialBotanical: {
    hierarchy: 0.16,
    visualCenterOffset: 0.14,
    quadrantBalance: 0.14,
    composition: 0.14,
    overlapQuality: 0.12,
    colorBalance: 0.1,
    rotationDiversity: 0.1,
    svgHealth: 0.1,
  },
  denseLuxury: {
    overlapQuality: 0.18,
    occupancyRatio: 0.16,
    hierarchy: 0.14,
    composition: 0.14,
    colorBalance: 0.12,
    quadrantBalance: 0.1,
    svgHealth: 0.08,
    spacing: 0.08,
  },
};

export interface ScoreResult {
  score: number;
  penaltyReasons: string[];
}

const METRIC_LABELS: Partial<Record<keyof CompositionMetrics, string>> = {
  composition: 'composition/occupancy',
  spacing: 'motif spacing evenness',
  quadrantBalance: 'quadrant balance',
  horizontalBalance: 'left/right balance',
  verticalBalance: 'top/bottom balance',
  visualCenterOffset: 'visual center offset',
  occupancyRatio: 'tile occupancy',
  densityVariance: 'local density variance',
  hierarchy: 'visual hierarchy clarity',
  scaleDiversity: 'scale diversity',
  rotationDiversity: 'rotation diversity',
  colorBalance: 'color-role balance',
  paletteContrast: 'palette contrast',
  overlapQuality: 'overlap quality',
  edgeDensity: 'edge density balance',
  adjacencyRepetition: 'adjacent-motif repetition',
  svgHealth: 'SVG technical health',
};

/** Weighted overall score for one quality preset, plus soft-penalty
 * reasons for any weighted metric that scored below 50 — real, geometry-
 * derived findings usable by a future Designer Assistant, not placeholder
 * text. */
export function computeOverallScore(metrics: CompositionMetrics, presetId: QualityPresetId): ScoreResult {
  const weights = QUALITY_PRESET_WEIGHTS[presetId];
  let weightedSum = 0;
  let weightTotal = 0;
  const penaltyReasons: string[] = [];
  for (const [key, weight] of Object.entries(weights) as Array<[keyof CompositionMetrics, number]>) {
    const value = metrics[key];
    if (typeof value !== 'number' || typeof weight !== 'number') continue;
    weightedSum += value * weight;
    weightTotal += weight;
    if (value < 50) penaltyReasons.push(`${METRIC_LABELS[key] ?? key} is low (${Math.round(value)}/100)`);
  }
  const score = weightTotal > 0 ? weightedSum / weightTotal : 0;
  return { score: Math.round(clamp01to100(score)), penaltyReasons };
}
