import type { LayoutParams, PatternLayout, Placement, Rng } from '../engine/types';
import { jitter, rngRange } from '../engine/rng';
import { spacingForDensity, poissonDiscPoints } from './shared';

/** Random scatter with density-controlled packing. */
export const scatterLayout: PatternLayout = {
  id: 'scatter',
  label: 'Random Scatter',
  generate(params: LayoutParams, rng: Rng): Placement[] {
    const minDist = spacingForDensity(params.motifSize, params.density) * 0.9;
    const targetCount = Math.max(3, Math.round((params.tileSize * params.tileSize) / (minDist * minDist)));
    const points = poissonDiscPoints(params.tileSize, minDist, targetCount, rng);

    return points.map(([x, y], i) => ({
      x,
      y,
      rotationDeg: jitter(rng, rngRange(rng, 0, 360), params.rotationJitter),
      scale: Math.max(0.35, 1 + rngRange(rng, -params.scaleJitter, params.scaleJitter)),
      colorSeed: i,
    }));
  },
};
