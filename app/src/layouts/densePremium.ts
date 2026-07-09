import type { LayoutParams, PatternLayout, Placement, Rng } from '../engine/types';
import { jitter, rngRange } from '../engine/rng';
import { spacingForDensity, poissonDiscPoints } from './shared';

/** Dense Premium: three overlapping scale tiers (large, medium, small)
 * layered on top of each other at high overall density — the "maximalist,
 * carefully composed" look of a richly layered fabric where the surface
 * never reads as empty at any zoom level. Ignores the low end of the
 * density slider (floored at 55%) since a sparse "dense" layout would
 * defeat the point. */
export const densePremiumLayout: PatternLayout = {
  id: 'densePremium',
  label: 'Dense Premium',
  generate(params: LayoutParams, rng: Rng): Placement[] {
    const { tileSize } = params;
    const density = Math.max(params.density, 0.55);
    const baseSpacing = spacingForDensity(params.motifSize, density);
    const placements: Placement[] = [];
    let colorSeed = 0;

    const tiers = [
      { spacingMul: 1.7, scale: 1.15, opacityScale: 1 },
      { spacingMul: 1.05, scale: 0.72, opacityScale: 1 },
      { spacingMul: 0.65, scale: 0.4, opacityScale: 1 },
    ];

    for (const tier of tiers) {
      const minDist = baseSpacing * tier.spacingMul;
      const target = Math.max(4, Math.round((tileSize * tileSize) / (minDist * minDist)));
      const points = poissonDiscPoints(tileSize, minDist, target, rng);
      for (const [x, y] of points) {
        placements.push({
          x,
          y,
          rotationDeg: jitter(rng, rngRange(rng, 0, 360), params.rotationJitter),
          scale: Math.max(0.25, tier.scale * (1 + rngRange(rng, -params.scaleJitter, params.scaleJitter))),
          colorSeed: colorSeed++,
        });
      }
    }
    return placements;
  },
};
