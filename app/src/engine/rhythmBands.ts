import type { Rng } from './types';
import { rngInt, rngRange, rngPick } from './rng';

// Rhythm Density Bands — Build 003, Part 5. Before this build, every
// "background" tier (ambient filler, secondary/filler tiers, airy's sparse
// scatter) used one fixed `minDist` everywhere, so it read as evenly,
// mechanically scattered — no dense clusters, no loose breathing room,
// exactly the "uniform distribution" real pattern design avoids. This
// module builds one shared dense/loose wave per tile generation and
// `layouts/shared.ts`'s `poissonDiscPoints` applies it as a per-candidate
// spacing multiplier, so the same tier now alternates between tighter and
// looser bands across the tile instead of a single flat spacing everywhere.
//
// Deliberately NOT applied to the Composition Zone Engine's own anchor
// placement (`engine/compositionZones.ts`) — zones already carry their own
// deliberate density skew (Build 003, Section 1), and this module only
// targets the tiers that were still perfectly uniform after that section:
// ambient/filler layers and airy's plain scatter.

export type RhythmAxis = 'horizontal' | 'vertical' | 'diagonal';

export interface RhythmBands {
  axis: RhythmAxis;
  /** Integer cycles across the tile — keeps the wave periodic across the
   * tile's wrap seam, the same trick `engine/flowArchitecture.ts` uses. */
  frequency: number;
  phase: number;
  /** 0-1: how strongly the dense/loose bands contrast (spacing multiplier
   * ranges [1 - amplitude, 1 + amplitude]). */
  amplitude: number;
}

const RHYTHM_AXES: RhythmAxis[] = ['horizontal', 'vertical', 'diagonal'];

/** Builds one tile-generation's dense/loose rhythm — call once per layout
 * `generate()` and thread the result into every background/filler tier's
 * `poissonDiscPoints` call via `rhythmSpacingMultiplier`, so the whole tier
 * commits to the same wave instead of each call inventing its own. */
export function createRhythmBands(rng: Rng): RhythmBands {
  return {
    axis: rngPick(rng, RHYTHM_AXES),
    frequency: rngInt(rng, 1, 3),
    phase: rngRange(rng, 0, Math.PI * 2),
    amplitude: rngRange(rng, 0.3, 0.5),
  };
}

/** Spacing multiplier at (x, y) — below 1 in "dense" bands (motifs pack
 * tighter), above 1 in "loose" bands (motifs spread further apart). */
export function rhythmSpacingMultiplier(bands: RhythmBands, x: number, y: number, tileSize: number): number {
  let t: number;
  switch (bands.axis) {
    case 'horizontal':
      t = x / tileSize;
      break;
    case 'vertical':
      t = y / tileSize;
      break;
    default:
      t = (x + y) / tileSize;
      break;
  }
  const wave = Math.sin(2 * Math.PI * bands.frequency * t + bands.phase);
  return 1 + bands.amplitude * wave;
}
