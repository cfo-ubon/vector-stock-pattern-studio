import type { TileData } from './types';
import { serialize } from './svgAst';
import { extractInstances, extractMotifShapeSignatures, gridCoverage, periodicDist, periodicOffset, countNodes, type MotifInstance } from './svgGeometry';

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
  largestEmptyRegion: number;
  hierarchy: number;
  scaleDiversity: number;
  rotationDiversity: number;
  colorBalance: number;
  paletteContrast: number;
  overlapQuality: number;
  heroSeparation: number;
  edgeDensity: number;
  adjacencyRepetition: number;
  seamlessIntegrity: number;
  svgHealth: number;
  /** SVG Intelligence Engine Phase 3 (Section 10 — "never fake scores"):
   * a genuine directional-coherence measurement (does the placement
   * sequence read as a deliberate flow — S-curve, diagonal, radial sweep —
   * or as scattered zigzag), not a proxy averaged from unrelated metrics.
   * See `computeFlowCoherence`. */
  flowCoherence: number;
  /** Real periodicity-strength measurement: how tightly nearest-neighbor
   * spacings cluster around a small number of dominant "beat" intervals,
   * via histogram entropy — a genuinely different statistic from
   * `spacing`'s plain coefficient-of-variation. See
   * `computeRhythmRegularity`. */
  rhythmRegularity: number;
  /** Real shape-topology diversity (Shannon entropy over each motif's
   * rotation/scale/position-invariant path-command signature — see
   * `svgGeometry.ts`'s `extractMotifShapeSignatures`), distinct from
   * `scaleDiversity`/`rotationDiversity` (which only see *how* a shape was
   * placed, never *which* shape it was). */
  motifShapeDiversity: number;
  /** Real corner-junction density-balance measurement: when a tile repeats,
   * its 4 corners meet at one point — a real, well-known seamless-pattern
   * defect is a "dead cross" at every one of those junctions even when the
   * tile's overall density looks fine. Distinct from `edgeDensity` (which
   * averages *all* border cells, diluting this specific hot spot). See
   * `computeCornerContinuity`. */
  cornerContinuity: number;
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

/** Nearest-neighbor distance *and* which instance was nearest, for every
 * instance — the shared O(n^2) computation `computeSpacing`,
 * `computeOverlapQuality`, `computeAdjacencyRepetition` and
 * `computeHeroSeparation` all need, factored out so it's computed once per
 * `computeMetrics` call instead of four times. */
function findNearest(instances: MotifInstance[], tileSize: number): Array<{ distance: number; other: MotifInstance | null }> {
  return instances.map((c, i) => {
    let best = Infinity;
    let nearest: MotifInstance | null = null;
    instances.forEach((o, j) => {
      if (i === j) return;
      const d = periodicDist(c, o, tileSize);
      if (d < best) {
        best = d;
        nearest = o;
      }
    });
    return { distance: best, other: nearest };
  });
}

function computeSpacing(nearest: Array<{ distance: number }>): number {
  if (nearest.length <= 1) return 100;
  const nn = nearest.map((n) => n.distance);
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

function computeOverlapQuality(instances: MotifInstance[], nearest: Array<{ distance: number }>, motifSize: number): number {
  if (instances.length <= 1) return 100;
  const meanScale = instances.reduce((a, c) => a + c.scale, 0) / instances.length;
  const footprint = motifSize * meanScale;
  const nn = nearest.map((n) => n.distance);
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
function computeAdjacencyRepetition(instances: MotifInstance[], nearest: Array<{ other: MotifInstance | null }>): number {
  if (instances.length <= 1) return 100;
  let repeats = 0;
  instances.forEach((c, i) => {
    const n = nearest[i].other;
    if (n) {
      const bucketA = Math.floor((((c.rot % 360) + 360) % 360) / 30);
      const bucketB = Math.floor((((n.rot % 360) + 360) % 360) / 30);
      if (bucketA === bucketB && c.role === n.role) repeats++;
    }
  });
  const repetitionFraction = repeats / instances.length;
  return clamp01to100(100 - repetitionFraction * 100);
}

/** Largest contiguous empty region on the coarse occupancy grid, found via
 * a periodic (edge-wrapping, matching the tile's own seamless wrap) flood
 * fill. Some negative space is desirable — this only penalizes once a
 * *single* empty region gets large relative to the whole tile (an
 * accidental hole), not "any empty space at all". */
function computeLargestEmptyRegion(instances: MotifInstance[], tileSize: number): number {
  const { gridN, counts } = gridCoverage(instances, tileSize, 8);
  const totalCells = gridN * gridN;
  const visited = new Array(totalCells).fill(false);
  let maxRegion = 0;
  for (let start = 0; start < totalCells; start++) {
    if (visited[start] || counts[start] > 0) continue;
    let size = 0;
    const queue = [start];
    visited[start] = true;
    while (queue.length > 0) {
      const idx = queue.pop()!;
      size++;
      const gx = idx % gridN;
      const gy = Math.floor(idx / gridN);
      const neighbors = [
        gy * gridN + ((gx + 1) % gridN),
        gy * gridN + ((gx - 1 + gridN) % gridN),
        ((gy + 1) % gridN) * gridN + gx,
        ((gy - 1 + gridN) % gridN) * gridN + gx,
      ];
      for (const n of neighbors) {
        if (!visited[n] && counts[n] === 0) {
          visited[n] = true;
          queue.push(n);
        }
      }
    }
    maxRegion = Math.max(maxRegion, size);
  }
  const fraction = maxRegion / totalCells;
  const idealMax = 0.35;
  return clamp01to100(fraction <= idealMax ? 100 : 100 - (fraction - idealMax) * 220);
}

/** How well-separated the hero-role motifs are from each other, relative
 * to the pattern's own typical spacing — heroes clumped much closer
 * together than everything else reads as an accidental pileup rather than
 * deliberate emphasis. Neutral (100) when there are 0-1 hero instances
 * (nothing to separate) — most layouts/hierarchy configs never assign a
 * hero role at all, so this doesn't penalize patterns that don't use one. */
function computeHeroSeparation(instances: MotifInstance[], tileSize: number, overallNearest: Array<{ distance: number }>): number {
  const heroes = instances.filter((i) => i.role === 'hero');
  if (heroes.length <= 1) return 100;
  const heroNn = findNearest(heroes, tileSize).map((n) => n.distance);
  const meanHeroNn = heroNn.reduce((a, b) => a + b, 0) / heroNn.length;
  const finiteOverall = overallNearest.map((n) => n.distance).filter((d) => Number.isFinite(d));
  const overallMeanNn = finiteOverall.length > 0 ? finiteOverall.reduce((a, b) => a + b, 0) / finiteOverall.length : meanHeroNn;
  if (overallMeanNn <= 0) return 100;
  const ratio = meanHeroNn / overallMeanNn;
  return ratio >= 1 ? 100 : clamp01to100(ratio * 100);
}

/** Greedy nearest-neighbor visiting order over `instances` (a cheap TSP
 * heuristic — good enough for a "does the eye's path through this pattern
 * flow smoothly" measurement, not meant to be an optimal tour). O(n^2),
 * same complexity class `findNearest` above already accepts for this
 * instance-count range. */
function buildNearestNeighborChain(instances: MotifInstance[], tileSize: number): number[] {
  const n = instances.length;
  const visited = new Array(n).fill(false);
  const order = [0];
  visited[0] = true;
  for (let step = 1; step < n; step++) {
    const last = instances[order[order.length - 1]];
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;
      const d = periodicDist(last, instances[i], tileSize);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) break;
    order.push(bestIdx);
    visited[bestIdx] = true;
  }
  return order;
}

/** Flow Score: walks a nearest-neighbor chain through every motif instance
 * and measures how smoothly the *direction* changes step to step (average
 * cosine similarity between consecutive direction vectors, mapped from
 * [-1, 1] to [0, 100]). A composition with a real, deliberate flow (an
 * S-curve, a diagonal sweep, a radial spiral) has motifs whose nearest-
 * neighbor chain consistently points in a slowly-turning direction — high
 * score. Pure random scatter produces an erratic, sign-flipping direction
 * sequence — low score. This is a genuine geometric measurement of
 * "flow", not a proxy borrowed from unrelated metrics. */
function computeFlowCoherence(instances: MotifInstance[], tileSize: number): number {
  if (instances.length < 3) return 100;
  const order = buildNearestNeighborChain(instances, tileSize);
  const dirs: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < order.length - 1; i++) {
    const { dx, dy } = periodicOffset(instances[order[i]], instances[order[i + 1]], tileSize);
    const len = Math.hypot(dx, dy);
    if (len > 1e-6) dirs.push({ x: dx / len, y: dy / len });
  }
  if (dirs.length < 2) return 100;
  let sumCos = 0;
  for (let i = 0; i < dirs.length - 1; i++) {
    sumCos += dirs[i].x * dirs[i + 1].x + dirs[i].y * dirs[i + 1].y;
  }
  const avgCos = sumCos / (dirs.length - 1);
  return clamp01to100((avgCos + 1) * 50);
}

/** Rhythm Score: histogram-entropy peakiness of the nearest-neighbor
 * spacing distribution — real design "rhythm" is a small number of
 * recurring interval "beats", not just statistically even spacing (which
 * `spacing`, a plain coefficient-of-variation, already measures and can't
 * distinguish from "every gap is a different random size but happens to
 * average out evenly"). Low entropy (spacings cluster into a few peaks) =
 * strong rhythm; high entropy (flat histogram) = no discernible beat. */
function computeRhythmRegularity(nearest: Array<{ distance: number }>): number {
  const distances = nearest.map((n) => n.distance).filter((d) => Number.isFinite(d) && d > 0);
  if (distances.length < 3) return 100;
  const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
  if (mean <= 0) return 100;
  const binCount = 8;
  const bins = new Array(binCount).fill(0);
  for (const d of distances) {
    const ratio = Math.min(1.999, d / mean);
    const bin = Math.min(binCount - 1, Math.floor((ratio / 2) * binCount));
    bins[bin]++;
  }
  const n = distances.length;
  let entropy = 0;
  for (const c of bins) {
    if (c <= 0) continue;
    const p = c / n;
    entropy -= p * Math.log2(p);
  }
  const maxEntropy = Math.log2(binCount);
  return clamp01to100(100 * (1 - entropy / maxEntropy));
}

/** Motif Diversity: Shannon entropy over each motif's shape-topology
 * signature (see `svgGeometry.ts`'s `extractMotifShapeSignatures`),
 * normalized by the maximum possible entropy for this instance count
 * (log2(n), reached only when every single instance has a unique shape) —
 * so this rewards both "how many distinct shapes appear" and "how evenly
 * they're used", not just evenness of an already-fixed category count. */
function computeMotifShapeDiversity(signatures: string[]): number {
  if (signatures.length <= 1) return 0;
  const counts = new Map<string, number>();
  for (const sig of signatures) counts.set(sig, (counts.get(sig) ?? 0) + 1);
  const n = signatures.length;
  let entropy = 0;
  for (const c of counts.values()) {
    const p = c / n;
    entropy -= p * Math.log2(p);
  }
  const maxEntropy = Math.log2(n);
  return maxEntropy > 0 ? clamp01to100((entropy / maxEntropy) * 100) : 0;
}

/** Repeat Score, corner half: when a tile repeats, its 4 corners meet at
 * one shared point — this specifically measures density in the 4 corner-
 * adjacent grid blocks against the tile's own average cell density, so a
 * "dead cross" at every repeat junction (a real, well-known seamless-
 * pattern defect distinct from a raw broken seam, which the wrap-clone
 * technique already makes structurally impossible) is caught even when
 * overall `edgeDensity` looks fine. */
function computeCornerContinuity(instances: MotifInstance[], tileSize: number): number {
  const { gridN, counts } = gridCoverage(instances, tileSize, 8);
  const blockSize = 2;
  const corners: Array<[number, number]> = [
    [0, 0],
    [gridN - blockSize, 0],
    [0, gridN - blockSize],
    [gridN - blockSize, gridN - blockSize],
  ];
  let cornerSum = 0;
  let cornerCells = 0;
  for (const [cx, cy] of corners) {
    for (let dy = 0; dy < blockSize; dy++) {
      for (let dx = 0; dx < blockSize; dx++) {
        cornerSum += counts[(cy + dy) * gridN + (cx + dx)];
        cornerCells++;
      }
    }
  }
  const cornerAvg = cornerCells > 0 ? cornerSum / cornerCells : 0;
  const overallAvg = counts.reduce((a, b) => a + b, 0) / counts.length;
  if (cornerAvg + overallAvg === 0) return 100;
  const ratio = cornerAvg / (overallAvg || cornerAvg || 1);
  return clamp01to100(100 - Math.abs(ratio - 1) * 70);
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

  const nearest = findNearest(instances, tileSize);

  const { composition, occupancyRatio, densityVariance } = computeComposition(instances, tileSize);
  const spacing = computeSpacing(nearest);
  const { quadrantBalance, horizontalBalance, verticalBalance } = computeBalance(instances, tileSize);
  const visualCenterOffset = computeVisualCenterOffset(instances, tileSize);
  const largestEmptyRegion = computeLargestEmptyRegion(instances, tileSize);
  const { hierarchy, scaleDiversity } = computeHierarchyAndScaleDiversity(instances);
  const rotationDiversity = computeRotationDiversity(instances);
  const { colorBalance, paletteContrast } = computeColorBalanceAndContrast(colors, params.colorStory);
  const overlapQuality = computeOverlapQuality(instances, nearest, params.motifSize);
  const heroSeparation = computeHeroSeparation(instances, tileSize, nearest);
  const edgeDensity = computeEdgeDensity(instances, tileSize);
  const adjacencyRepetition = computeAdjacencyRepetition(instances, nearest);
  const svgHealth = computeSvgHealth(tileData, instances);
  const flowCoherence = computeFlowCoherence(instances, tileSize);
  const rhythmRegularity = computeRhythmRegularity(nearest);
  const motifShapeDiversity = computeMotifShapeDiversity(extractMotifShapeSignatures(tileData));
  const cornerContinuity = computeCornerContinuity(instances, tileSize);

  return {
    composition: Math.round(composition),
    spacing: Math.round(spacing),
    quadrantBalance: Math.round(quadrantBalance),
    horizontalBalance: Math.round(horizontalBalance),
    verticalBalance: Math.round(verticalBalance),
    visualCenterOffset: Math.round(visualCenterOffset),
    occupancyRatio: Math.round(occupancyRatio),
    densityVariance: Math.round(densityVariance),
    largestEmptyRegion: Math.round(largestEmptyRegion),
    hierarchy: Math.round(hierarchy),
    scaleDiversity: Math.round(scaleDiversity),
    rotationDiversity: Math.round(rotationDiversity),
    colorBalance: Math.round(colorBalance),
    paletteContrast: Math.round(paletteContrast),
    overlapQuality: Math.round(overlapQuality),
    heroSeparation: Math.round(heroSeparation),
    edgeDensity: Math.round(edgeDensity),
    adjacencyRepetition: Math.round(adjacencyRepetition),
    seamlessIntegrity: 100, // structural guarantee — see engine/qualityScore.ts
    svgHealth: Math.round(svgHealth),
    flowCoherence: Math.round(flowCoherence),
    rhythmRegularity: Math.round(rhythmRegularity),
    motifShapeDiversity: Math.round(motifShapeDiversity),
    cornerContinuity: Math.round(cornerContinuity),
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
    svgHealth: 0.2,
    composition: 0.13,
    spacing: 0.11,
    quadrantBalance: 0.11,
    colorBalance: 0.1,
    overlapQuality: 0.1,
    hierarchy: 0.08,
    rotationDiversity: 0.06,
    edgeDensity: 0.06,
    largestEmptyRegion: 0.05,
    // SVG Intelligence Engine Phase 3: real geometry, not a proxy — see
    // each metric's own doc comment on CompositionMetrics.
    cornerContinuity: 0.08,
    motifShapeDiversity: 0.06,
    flowCoherence: 0.04,
    rhythmRegularity: 0.04,
  },
  textilePremium: {
    spacing: 0.16,
    seamlessIntegrity: 0.13,
    rotationDiversity: 0.13,
    edgeDensity: 0.11,
    composition: 0.11,
    overlapQuality: 0.09,
    colorBalance: 0.09,
    svgHealth: 0.09,
    largestEmptyRegion: 0.09,
    // A repeating textile print lives or dies on rhythm/repeat quality.
    rhythmRegularity: 0.12,
    cornerContinuity: 0.1,
    motifShapeDiversity: 0.08,
    flowCoherence: 0.05,
  },
  editorialBotanical: {
    hierarchy: 0.14,
    visualCenterOffset: 0.12,
    quadrantBalance: 0.12,
    composition: 0.12,
    overlapQuality: 0.1,
    heroSeparation: 0.1,
    colorBalance: 0.09,
    rotationDiversity: 0.09,
    svgHealth: 0.09,
    largestEmptyRegion: 0.03,
    // Editorial composition is defined by its flow more than any other style.
    flowCoherence: 0.12,
    cornerContinuity: 0.07,
    motifShapeDiversity: 0.06,
    rhythmRegularity: 0.04,
  },
  denseLuxury: {
    overlapQuality: 0.16,
    occupancyRatio: 0.14,
    hierarchy: 0.12,
    composition: 0.12,
    colorBalance: 0.11,
    quadrantBalance: 0.09,
    heroSeparation: 0.09,
    svgHealth: 0.08,
    spacing: 0.07,
    largestEmptyRegion: 0.02,
    cornerContinuity: 0.1,
    motifShapeDiversity: 0.08,
    rhythmRegularity: 0.05,
    flowCoherence: 0.04,
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
  largestEmptyRegion: 'largest empty region',
  hierarchy: 'visual hierarchy clarity',
  scaleDiversity: 'scale diversity',
  rotationDiversity: 'rotation diversity',
  colorBalance: 'color-role balance',
  paletteContrast: 'palette contrast',
  overlapQuality: 'overlap quality',
  heroSeparation: 'hero separation',
  edgeDensity: 'edge density balance',
  adjacencyRepetition: 'adjacent-motif repetition',
  svgHealth: 'SVG technical health',
  flowCoherence: 'directional flow coherence',
  rhythmRegularity: 'spacing rhythm regularity',
  motifShapeDiversity: 'motif shape diversity',
  cornerContinuity: 'tile-corner junction balance',
};

export interface SoftPenaltyRule {
  id: string;
  label: string;
  points: number;
  check: (m: CompositionMetrics) => boolean;
}

/** Named soft-penalty rules (Phase 4's examples): each is a concrete,
 * checkable condition on real metric values that subtracts fixed points
 * from the final score — distinct from the ordinary weighted-average
 * contribution above (a mediocre-but-not-alarming metric already pulls
 * the weighted average down a little; these rules additionally flag and
 * deduct for specific conditions severe enough to name outright). A
 * candidate can trigger any number of these and still not be hard-
 * rejected — soft penalties reduce rank, they never remove a candidate
 * from consideration the way engine/candidateEngine.ts's hard-reject
 * rules do. */
export const SOFT_PENALTY_RULES: SoftPenaltyRule[] = [
  { id: 'quadrantImbalance', label: 'quadrant imbalance is severe', points: 8, check: (m) => m.quadrantBalance < 40 },
  { id: 'largeEmptyHole', label: 'a large empty region breaks up the composition', points: 10, check: (m) => m.largestEmptyRegion < 40 },
  { id: 'heroClustering', label: 'hero motifs sit too close together', points: 8, check: (m) => m.heroSeparation < 40 },
  { id: 'adjacentRepetition', label: 'the same motif repeats in adjacent positions too often', points: 6, check: (m) => m.adjacencyRepetition < 40 },
  { id: 'edgeImbalance', label: 'edge density is noticeably unbalanced against the interior', points: 5, check: (m) => m.edgeDensity < 40 },
  { id: 'lowPaletteContrast', label: 'palette contrast is muddy', points: 5, check: (m) => m.paletteContrast < 25 },
  { id: 'cornerDeadZone', label: 'the tile-corner junction is noticeably empty or crowded when repeated', points: 8, check: (m) => m.cornerContinuity < 40 },
  { id: 'repetitiveMotifShapes', label: 'too few distinct motif shapes for the number of instances placed', points: 6, check: (m) => m.motifShapeDiversity < 25 },
];

export interface SoftPenaltyResult {
  score: number;
  penalties: Array<{ label: string; points: number }>;
}

/** Apply every triggered soft-penalty rule's deduction to `baseScore`.
 * Pure and deterministic — same metrics always trigger the same rules for
 * the same total deduction. */
export function applySoftPenalties(metrics: CompositionMetrics, baseScore: number): SoftPenaltyResult {
  const penalties: Array<{ label: string; points: number }> = [];
  let deduction = 0;
  for (const rule of SOFT_PENALTY_RULES) {
    if (rule.check(metrics)) {
      penalties.push({ label: rule.label, points: rule.points });
      deduction += rule.points;
    }
  }
  return { score: clamp01to100(baseScore - deduction), penalties };
}

/** Weighted overall score for one quality preset. Two layers of feedback
 * feed into the final score: (1) the ordinary weighted average of every
 * metric the preset cares about (a middling metric already pulls the
 * average down somewhat) and (2) named soft-penalty rules (see
 * SOFT_PENALTY_RULES) that subtract additional fixed points for specific,
 * severe conditions. `penaltyReasons` combines both: metrics that scored
 * below 50 in the weighted set (informational), and triggered soft-
 * penalty deductions (with their point cost) — real, geometry-derived
 * findings usable by a future Designer Assistant, not placeholder text. */
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
  const baseScore = weightTotal > 0 ? weightedSum / weightTotal : 0;
  const { score, penalties } = applySoftPenalties(metrics, baseScore);
  for (const p of penalties) penaltyReasons.push(`${p.label} (soft penalty -${p.points})`);
  return { score: Math.round(score), penaltyReasons };
}
