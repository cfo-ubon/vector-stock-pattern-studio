import type { LayoutParams, PatternLayout, Placement, Rng } from '../engine/types';
import { spacingForDensity, applyCellJitter } from './shared';

/** Half-drop layout: every other *column* is shifted down by half a cell
 * height — the classic textile/wallpaper repeat used for florals. Mirror
 * image of brick/offset (which shifts rows horizontally instead). */
export const halfDropLayout: PatternLayout = {
  id: 'halfDrop',
  label: 'Half-Drop',
  generate(params: LayoutParams, rng: Rng): Placement[] {
    const spacing = spacingForDensity(params.motifSize, params.density);
    // Even column count so the alternate-column size rhythm below stays
    // periodic across tile boundaries.
    const cols = Math.max(2, 2 * Math.round(params.tileSize / spacing / 2));
    const rows = Math.max(2, Math.round(params.tileSize / spacing));
    const cellW = params.tileSize / cols;
    const cellH = params.tileSize / rows;
    const placements: Placement[] = [];
    let i = 0;
    for (let c = 0; c < cols; c++) {
      const offset = c % 2 === 1 ? cellH / 2 : 0;
      for (let r = 0; r < rows; r++) {
        const x = (c + 0.5) * cellW;
        const y = (r + 0.5) * cellH + offset;
        const placement = applyCellJitter(x, y % params.tileSize, i++, params, rng);
        // Dropped columns slightly smaller — the classic wallpaper rhythm.
        if (c % 2 === 1) placement.scale *= 0.8;
        placements.push(placement);
      }
    }
    return placements;
  },
};
