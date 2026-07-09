import type { LayoutParams, PatternLayout, Placement, Rng } from '../engine/types';
import { jitter, rngRange, rngBool } from '../engine/rng';
import { spacingForDensity } from './shared';

/** Stripe: motifs organized into horizontal bands separated by visible
 * gaps — a repeating row of motifs, empty space, another row — rather
 * than filling the whole tile evenly like Grid. Alternating bands offset
 * horizontally by half a step and can optionally point the opposite
 * direction (rotated 180°), the classic "marching band" stripe-of-icons
 * look used a lot in ribbon/border-adjacent stock patterns. */
export const stripeLayout: PatternLayout = {
  id: 'stripe',
  label: 'Stripe',
  generate(params: LayoutParams, rng: Rng): Placement[] {
    const spacing = spacingForDensity(params.motifSize, params.density);
    const cols = Math.max(2, Math.round(params.tileSize / spacing));
    // Bands are spaced further apart than a plain grid row so the gap
    // between stripes reads clearly; even count keeps the alternating
    // offset periodic across the tile seam.
    const bands = Math.max(2, 2 * Math.round(params.tileSize / (spacing * 1.8) / 2));
    const cellW = params.tileSize / cols;
    const bandH = params.tileSize / bands;
    const placements: Placement[] = [];
    const flipAlternate = rngBool(rng);
    for (let b = 0; b < bands; b++) {
      const offset = b % 2 === 1 ? cellW / 2 : 0;
      const y = (b + 0.5) * bandH;
      const baseRotation = flipAlternate && b % 2 === 1 ? 180 : 0;
      for (let c = 0; c < cols; c++) {
        const x = ((c + 0.5) * cellW + offset) % params.tileSize;
        placements.push({
          x,
          y,
          rotationDeg: jitter(rng, baseRotation, params.rotationJitter),
          scale: Math.max(0.35, 1 + rngRange(rng, -params.scaleJitter, params.scaleJitter)),
          colorSeed: b,
        });
      }
    }
    return placements;
  },
};
