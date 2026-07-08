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
    const cols = Math.max(2, Math.round(params.tileSize / spacing));
    const rows = Math.max(2, Math.round(params.tileSize / spacing));
    const cellW = params.tileSize / cols;
    const cellH = params.tileSize / rows;
    const placements: Placement[] = [];
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c + 0.5) * cellW;
        const y = (r + 0.5) * cellH;
        placements.push(applyCellJitter(x, y, i++, params, rng));
      }
    }
    return placements;
  },
};
