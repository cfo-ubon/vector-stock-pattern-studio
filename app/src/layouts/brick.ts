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
    const rows = Math.max(2, Math.round(params.tileSize / spacing));
    const cellW = params.tileSize / cols;
    const cellH = params.tileSize / rows;
    const placements: Placement[] = [];
    let i = 0;
    for (let r = 0; r < rows; r++) {
      const offset = r % 2 === 1 ? cellW / 2 : 0;
      for (let c = 0; c < cols; c++) {
        const x = (c + 0.5) * cellW + offset;
        const y = (r + 0.5) * cellH;
        placements.push(applyCellJitter(x % params.tileSize, y, i++, params, rng));
      }
    }
    return placements;
  },
};
