import type { SvgNode, TileData } from './types';

/** Shared geometry-extraction utilities: parse motif placement data back out
 * of the actual generated SVG tree. Previously this parsing lived only
 * inside `qualityScore.ts`; the new Composition Scoring Engine
 * (`scoring.ts`) needs the same data, so it's factored out here rather than
 * duplicated a second time. */

export interface MotifInstance {
  x: number;
  y: number;
  rot: number;
  scale: number;
  role?: 'hero' | 'secondary' | 'filler' | 'accent';
  /** Index of this motif's placement within the tile (0-based) — not a
   * shape/variant identity (generators don't expose which internal variant
   * they drew), just "the Nth placement", used for id-uniqueness checks. */
  index: number;
}

export function findPatternLayer(svg: SvgNode): SvgNode | undefined {
  return (svg.children ?? []).find((c) => c.attrs?.id === 'layer-pattern');
}

export function findMotifGroups(svg: SvgNode): SvgNode[] {
  const patternLayer = findPatternLayer(svg);
  return (patternLayer?.children ?? []).filter(
    (c) => typeof c.attrs?.id === 'string' && (c.attrs!.id as string).startsWith('motif-'),
  );
}

/** Each `motif-N` group holds up to 9 wrap-clone instances (see tile.ts);
 * the "primary" one — whose center actually falls inside the tile — is the
 * one that represents this motif's real position for scoring. */
function extractPrimaryInstance(motifGroup: SvgNode, tileSize: number, index: number): MotifInstance | null {
  const candidates: Array<{ x: number; y: number; rot: number; scale: number }> = [];
  for (const inst of motifGroup.children ?? []) {
    const t = String(inst.attrs?.transform ?? '');
    const m = t.match(/translate\(([-\d.]+)\s+([-\d.]+)\)\s*rotate\(([-\d.]+)\)\s*scale\(([-\d.]+)\)/);
    if (m) candidates.push({ x: parseFloat(m[1]), y: parseFloat(m[2]), rot: parseFloat(m[3]), scale: parseFloat(m[4]) });
  }
  if (candidates.length === 0) return null;
  const inRange = candidates.find((c) => c.x >= -0.01 && c.x <= tileSize + 0.01 && c.y >= -0.01 && c.y <= tileSize + 0.01);
  const chosen = inRange ?? candidates[0];
  const role = motifGroup.attrs?.['data-role'] as MotifInstance['role'] | undefined;
  return { ...chosen, role, index };
}

export function extractInstances(tileData: TileData): MotifInstance[] {
  const groups = findMotifGroups(tileData.svg);
  return groups
    .map((g, i) => extractPrimaryInstance(g, tileData.params.tileSize, i))
    .filter((x): x is MotifInstance => x !== null);
}

/** Nearest-neighbor distance accounting for the seamless wrap: a motif near
 * the left edge can be closer to one near the right edge (its wrapped
 * neighbor) than to anything else inside the tile. */
export function periodicDist(a: { x: number; y: number }, b: { x: number; y: number }, tileSize: number): number {
  let best = Infinity;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const ddx = a.x - (b.x + dx * tileSize);
      const ddy = a.y - (b.y + dy * tileSize);
      const d = Math.hypot(ddx, ddy);
      if (d < best) best = d;
    }
  }
  return best;
}

export interface GridCoverage {
  gridN: number;
  cell: number;
  counts: number[]; // length gridN*gridN, 0 for empty cells
  occupancyRatio: number; // touched cells / total cells
  avgPerTouchedCell: number;
}

/** Bucket instance centers into a coarse gridN x gridN grid — the shared
 * basis for occupancy, density-variance, quadrant, and edge-density
 * metrics. */
export function gridCoverage(instances: Array<{ x: number; y: number }>, tileSize: number, gridN = 8): GridCoverage {
  const cell = tileSize / gridN;
  const counts = new Array(gridN * gridN).fill(0);
  for (const c of instances) {
    const gx = Math.min(gridN - 1, Math.floor((((c.x % tileSize) + tileSize) % tileSize) / cell));
    const gy = Math.min(gridN - 1, Math.floor((((c.y % tileSize) + tileSize) % tileSize) / cell));
    counts[gy * gridN + gx]++;
  }
  const touched = counts.filter((c) => c > 0).length;
  const occupancyRatio = touched / (gridN * gridN);
  const avgPerTouchedCell = touched > 0 ? instances.length / touched : 0;
  return { gridN, cell, counts, occupancyRatio, avgPerTouchedCell };
}

export function countNodes(node: SvgNode): number {
  return 1 + (node.children ?? []).reduce((sum, c) => sum + countNodes(c), 0);
}

/** Same wrap-aware "shortest path between a and b" `periodicDist` computes,
 * but returning the offset vector itself (not just its length) — needed
 * anywhere the *direction* between two periodically-wrapped points matters
 * (e.g. Flow Score's direction-coherence walk), not just the distance. */
export function periodicOffset(a: { x: number; y: number }, b: { x: number; y: number }, tileSize: number): { dx: number; dy: number } {
  let bestDx = 0;
  let bestDy = 0;
  let best = Infinity;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const ddx = b.x + dx * tileSize - a.x;
      const ddy = b.y + dy * tileSize - a.y;
      const d = Math.hypot(ddx, ddy);
      if (d < best) {
        best = d;
        bestDx = ddx;
        bestDy = ddy;
      }
    }
  }
  return { dx: bestDx, dy: bestDy };
}

/** A rotation/scale/position/color-invariant fingerprint of one node's
 * *shape topology* — a path's sequence of command letters (M/L/C/Q/A/Z,
 * numbers stripped) and, for a group, the same recursively over its
 * children. Two motifs built from a different number of petals, a
 * different silhouette, or an extra decorative flourish get different
 * signatures; two instances of literally the same shape at different
 * rotation/scale/position get the *same* signature — which is exactly the
 * "is this actually a different motif, or the same one just spun around"
 * distinction `rotationDiversity`/`scaleDiversity` alone can't make. */
function shapeSignature(node: SvgNode): string {
  if (node.tag === 'path') {
    const d = String(node.attrs?.d ?? '');
    const commands = d.match(/[MLCQAZmlcqaz]/g) ?? [];
    return `path:${commands.join('').toUpperCase()}`;
  }
  if (node.tag === 'g') {
    return `g[${(node.children ?? []).map(shapeSignature).join(',')}]`;
  }
  return node.tag;
}

/** One shape signature per motif (its first/primary wrap instance — every
 * wrap-clone of the same motif is geometrically identical content, just
 * translated, so sampling one is sufficient and cheap). Used by
 * `scoring.ts`'s `motifShapeDiversity` metric. */
export function extractMotifShapeSignatures(tileData: TileData): string[] {
  const groups = findMotifGroups(tileData.svg);
  const signatures: string[] = [];
  for (const group of groups) {
    const firstInstance = (group.children ?? [])[0];
    if (!firstInstance) continue;
    const sig = (firstInstance.children ?? []).map(shapeSignature).join('|');
    if (sig) signatures.push(sig);
  }
  return signatures;
}
