import type { LayoutParams, PatternLayout, Placement, Rng } from '../engine/types';
import { rngRange } from '../engine/rng';
import { spacingForDensity } from './shared';

/** Toss Pattern: the classic "tossed all-over" look — motifs scattered at
 * fully random rotation as if thrown onto the fabric, but (unlike Random
 * Scatter's minimum-distance rule) allowed to sit close together or
 * overlap slightly for a busier, more casual feel. Built from a grid of
 * cells with each motif placed anywhere within a widened version of its
 * cell (not just jittered near the center), so positions look free rather
 * than grid-derived despite the underlying regular cell count. */
export const tossLayout: PatternLayout = {
  id: 'toss',
  label: 'Toss Pattern',
  generate(params: LayoutParams, rng: Rng): Placement[] {
    const spacing = spacingForDensity(params.motifSize, params.density) * 0.85;
    const cols = Math.max(2, Math.round(params.tileSize / spacing));
    const rows = Math.max(2, Math.round(params.tileSize / spacing));
    const cellW = params.tileSize / cols;
    const cellH = params.tileSize / rows;
    const placements: Placement[] = [];
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c + 0.5) * cellW + rngRange(rng, -cellW * 0.4, cellW * 0.4);
        const y = (r + 0.5) * cellH + rngRange(rng, -cellH * 0.4, cellH * 0.4);
        placements.push({
          x,
          y,
          rotationDeg: rngRange(rng, 0, 360),
          scale: Math.max(0.35, 1 + rngRange(rng, -params.scaleJitter - 0.1, params.scaleJitter + 0.1)),
          colorSeed: i++,
        });
      }
    }
    return placements;
  },
};
