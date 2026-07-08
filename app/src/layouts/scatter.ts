import type { LayoutParams, PatternLayout, Placement, Rng } from '../engine/types';
import { jitter, rngRange } from '../engine/rng';
import { spacingForDensity } from './shared';

/** Random scatter with density-controlled packing, done as periodic
 * rejection sampling: candidate points are tried on the *infinite* periodic
 * plane (checking distance against all 8 neighbour copies of every already
 * placed point, not just the raw coordinates) so scatter density looks
 * uniform right across the tile seam instead of clumping or gapping there. */
export const scatterLayout: PatternLayout = {
  id: 'scatter',
  label: 'Random Scatter',
  generate(params: LayoutParams, rng: Rng): Placement[] {
    const minDist = spacingForDensity(params.motifSize, params.density) * 0.9;
    const targetCount = Math.max(3, Math.round((params.tileSize * params.tileSize) / (minDist * minDist)));
    const maxAttempts = targetCount * 40;
    const points: Array<[number, number]> = [];
    const { tileSize } = params;

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
      const ok = points.every(([px, py]) => periodicDist(candidate[0], candidate[1], px, py) >= minDist);
      if (ok) points.push(candidate);
    }

    return points.map(([x, y], i) => ({
      x,
      y,
      rotationDeg: jitter(rng, rngRange(rng, 0, 360), params.rotationJitter),
      scale: Math.max(0.35, 1 + rngRange(rng, -params.scaleJitter, params.scaleJitter)),
      colorSeed: i,
    }));
  },
};
