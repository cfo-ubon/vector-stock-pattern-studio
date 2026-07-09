import type { LayoutParams, PatternLayout, Placement, Rng } from '../engine/types';
import { spacingForDensity, applyCellJitter } from './shared';

/** Brick / offset layout: every other row is shifted by half a cell width,
 * like a running-bond brick wall. Rows must evenly divide the tile height
 * and the half-shift must be an exact half-cell so the pattern still tiles
 * seamlessly (the shifted row on one edge continues correctly into the next
 * tile copy). */
export const brickLayout: PatternLayout = {
  id: 'brick',
  label: 'Brick / Offset',
  generate(params: LayoutParams, rng: Rng): Placement[] {
    const spacing = spacingForDensity(params.motifSize, params.density);
    const cols = Math.max(2, Math.round(params.tileSize / spacing));
    // Even row count so the alternate-row size rhythm below stays periodic
    // across tile boundaries.
    const rows = Math.max(2, 2 * Math.round(params.tileSize / spacing / 2));
    const cellW = params.tileSize / cols;
    const cellH = params.tileSize / rows;
    const placements: Placement[] = [];
    for (let r = 0; r < rows; r++) {
      const offset = r % 2 === 1 ? cellW / 2 : 0;
      for (let c = 0; c < cols; c++) {
        const x = (c + 0.5) * cellW + offset;
        const y = (r + 0.5) * cellH;
        const placement = applyCellJitter(x % params.tileSize, y, r + c, params, rng);
        // Offset rows read better slightly smaller — adds a woven rhythm.
        if (!params.disableGridRhythm && r % 2 === 1) placement.scale *= 0.8;
        placements.push(placement);
      }
    }
    return placements;
  },
};
