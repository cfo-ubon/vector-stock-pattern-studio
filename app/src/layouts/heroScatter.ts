import type { LayoutParams, PatternLayout, Placement, Rng } from '../engine/types';
import { jitter, rngRange } from '../engine/rng';
import { spacingForDensity, poissonDiscPoints } from './shared';

/** Hero + Random Scatter: a handful of large, widely-spaced "hero" motifs
 * plus a much larger number of small "filler" motifs scattered freely
 * between them — a two-tier density that gives the pattern a clear focal
 * hierarchy instead of every motif competing at the same visual weight. */
export const heroScatterLayout: PatternLayout = {
  id: 'heroScatter',
  label: 'Hero + Scatter',
  generate(params: LayoutParams, rng: Rng): Placement[] {
    const { tileSize } = params;
    const heroMinDist = spacingForDensity(params.motifSize, params.density) * 2.4;
    const heroTarget = Math.max(2, Math.round((tileSize * tileSize) / (heroMinDist * heroMinDist)));
    const heroPoints = poissonDiscPoints(tileSize, heroMinDist, heroTarget, rng);

    const fillerMinDist = spacingForDensity(params.motifSize, params.density) * 0.55;
    const fillerTarget = Math.max(8, Math.round((tileSize * tileSize) / (fillerMinDist * fillerMinDist)));
    const fillerPoints = poissonDiscPoints(tileSize, fillerMinDist, fillerTarget, rng);

    const placements: Placement[] = [];
    let colorSeed = 0;

    for (const [x, y] of heroPoints) {
      placements.push({
        x,
        y,
        rotationDeg: jitter(rng, rngRange(rng, 0, 360), params.rotationJitter),
        scale: Math.max(0.5, 1.5 * (1 + rngRange(rng, -params.scaleJitter, params.scaleJitter))),
        colorSeed: colorSeed++,
        role: 'hero',
      });
    }
    for (const [x, y] of fillerPoints) {
      placements.push({
        x,
        y,
        rotationDeg: jitter(rng, rngRange(rng, 0, 360), params.rotationJitter),
        scale: Math.max(0.25, rngRange(rng, 0.35, 0.55) * (1 + rngRange(rng, -params.scaleJitter, params.scaleJitter))),
        colorSeed: colorSeed++,
        role: 'filler',
      });
    }
    return placements;
  },
};
