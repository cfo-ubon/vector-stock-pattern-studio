import type { LayoutParams, Placement, Rng } from '../engine/types';
import { jitter, rngRange } from '../engine/rng';

/** Spacing between motif centers for a given density (0..1). Higher density
 * packs motifs closer together (down to ~0.85x motif size, i.e. slight
 * overlap for a busy look); lower density spreads them out (up to ~2.2x). */
export function spacingForDensity(motifSize: number, density: number): number {
  const d = Math.max(0, Math.min(1, density));
  return motifSize * (2.2 - d * 1.35);
}

export function applyCellJitter(
  x: number,
  y: number,
  cellIndex: number,
  params: LayoutParams,
  rng: Rng,
): Placement {
  const rotationDeg = jitter(rng, 0, params.rotationJitter);
  const scale = 1 + rngRange(rng, -params.scaleJitter, params.scaleJitter);
  const mirrored = params.mirror && cellIndex % 2 === 1;
  return {
    x,
    y,
    rotationDeg: mirrored ? rotationDeg + 180 : rotationDeg,
    scale: Math.max(0.35, scale),
    colorSeed: cellIndex,
  };
}

/** Wrap a coordinate into [0, tileSize) — placements are generated on a
 * conceptually infinite periodic plane, so any layout math that drifts
 * outside the tile just wraps back in; the engine's wrap-cloning then
 * handles edge overflow for seamlessness. */
export function wrapCoord(v: number, tileSize: number): number {
  return ((v % tileSize) + tileSize) % tileSize;
}

/** Poisson-disc-ish point scatter via periodic rejection sampling: checks
 * candidate distance against all 8 neighbour copies of every existing
 * point (not just the raw coordinates), so density looks uniform right up
 * to the tile seam instead of clumping or gapping there. Shared by every
 * layout that needs "N points, no two closer than minDist" — plain
 * scatter, hero tiers, bouquet centers, airy/dense composition layers.
 *
 * `spacingMultiplier`, when given, scales `minDist` per-candidate by its
 * position (Build 003, Part 5 — Rhythm Density Bands, see
 * `engine/rhythmBands.ts`): below 1 packs a candidate's neighbourhood
 * tighter, above 1 spreads it looser, so the result reads as alternating
 * dense/loose bands instead of one flat spacing everywhere. Omitted, the
 * function behaves exactly as before. */
export function poissonDiscPoints(
  tileSize: number,
  minDist: number,
  targetCount: number,
  rng: Rng,
  spacingMultiplier?: (x: number, y: number) => number,
): Array<[number, number]> {
  const maxAttempts = Math.max(50, targetCount * 40);
  const points: Array<[number, number]> = [];

  const periodicDist = (ax: number, ay: number, bx: number, by: number) => {
    let best = Infinity;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const ddx = ax - (bx + dx * tileSize);
        const ddy = ay - (by + dy * tileSize);
        const d = Math.sqrt(ddx * ddx + ddy * ddy);
        if (d < best) best = d;
      }
    }
    return best;
  };

  let attempts = 0;
  while (points.length < targetCount && attempts < maxAttempts) {
    attempts++;
    const candidate: [number, number] = [rngRange(rng, 0, tileSize), rngRange(rng, 0, tileSize)];
    const localMinDist = spacingMultiplier ? minDist * spacingMultiplier(candidate[0], candidate[1]) : minDist;
    const ok = points.every(([px, py]) => periodicDist(candidate[0], candidate[1], px, py) >= localMinDist);
    if (ok) points.push(candidate);
  }
  return points;
}
