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
