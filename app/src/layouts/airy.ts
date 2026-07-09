import type { LayoutParams, PatternLayout, Placement, Rng } from '../engine/types';
import { jitter, rngRange } from '../engine/rng';
import { spacingForDensity, poissonDiscPoints } from './shared';

/** Airy Botanical: very sparse scatter with generous negative space and
 * mostly-small, gently-varied motifs — the delicate, breathable look
 * (a few sprigs floating on a big empty ground) that reads as premium
 * rather than "not enough content". Density is compressed toward the low
 * end regardless of the slider, and motifs skew smaller than their base
 * size, with only occasional larger ones for a touch of hierarchy. */
export const airyLayout: PatternLayout = {
  id: 'airy',
  label: 'Airy Botanical',
  generate(params: LayoutParams, rng: Rng): Placement[] {
    const airyDensity = params.density * 0.35; // always sparse, whatever the slider says
    const minDist = spacingForDensity(params.motifSize, airyDensity) * 1.15;
    const targetCount = Math.max(3, Math.round((params.tileSize * params.tileSize) / (minDist * minDist)));
    const points = poissonDiscPoints(params.tileSize, minDist, targetCount, rng);

    return points.map(([x, y], i) => {
      const isAccent = rng() < 0.15;
      const baseScale = isAccent ? rngRange(rng, 0.9, 1.15) : rngRange(rng, 0.45, 0.75);
      return {
        x,
        y,
        rotationDeg: jitter(rng, rngRange(rng, 0, 360), params.rotationJitter),
        scale: Math.max(0.3, baseScale * (1 + rngRange(rng, -params.scaleJitter, params.scaleJitter))),
        colorSeed: i,
      };
    });
  },
};
