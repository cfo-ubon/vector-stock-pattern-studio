import type { LayoutParams, PatternLayout, Placement, Rng } from '../engine/types';
import { spacingForDensity, applyCellJitter } from './shared';

/** Regular row/column grid — the simplest periodic layout. Cell count is
 * derived from tile size and motif spacing so the grid always divides the
 * tile evenly, which is what keeps the seamless wrap trivially correct
 * (every column/row lines up with its neighbour tile). */
export const gridLayout: PatternLayout = {
  id: 'grid',
  label: 'Grid',
  generate(params: LayoutParams, rng: Rng): Placement[] {
    const spacing = spacingForDensity(params.motifSize, params.density);
    // Even col/row counts so the checkerboard rhythm below stays periodic
    // across tile boundaries (odd counts would put two same-size cells
    // next to each other at every seam).
    const cols = Math.max(2, 2 * Math.round(params.tileSize / spacing / 2));
    const rows = Math.max(2, 2 * Math.round(params.tileSize / spacing / 2));
    const cellW = params.tileSize / cols;
    const cellH = params.tileSize / rows;
    const placements: Placement[] = [];
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c + 0.5) * cellW;
        const y = (r + 0.5) * cellH;
        const placement = applyCellJitter(x, y, i++, params, rng);
        // Checkerboard large/small rhythm — the classic textile trick that
        // makes a plain grid read as deliberately designed.
        if ((r + c) % 2 === 1) placement.scale *= 0.7;
        placements.push(placement);
      }
    }
    return placements;
  },
};
