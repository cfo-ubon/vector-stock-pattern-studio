import type { LayoutParams, PatternLayout, Placement, Rng } from '../engine/types';

/** Grid Minimal: a plain grid of just a handful of generously-spaced
 * motifs with zero rotation/scale jitter — every motif identical in size
 * and upright. The restrained, orderly look ("minimal") that reads as
 * deliberate rather than random, popular for branding-adjacent and
 * Scandi-style stock patterns. This deliberately ignores both the density
 * slider and the shared `spacingForDensity` formula: at this app's tile
 * size (sized for a detailed 10000x10000px single-image sale — see
 * defaults.ts), a "few large icons" grid needs a fixed, small column
 * count regardless of density — a density-scaled repeat count would still
 * be dozens of small icons and never actually read as minimal. */
export const gridMinimalLayout: PatternLayout = {
  id: 'gridMinimal',
  label: 'Grid Minimal',
  generate(params: LayoutParams, rng: Rng): Placement[] {
    void rng;
    const cols = 5; // a genuinely sparse repeat count, independent of tile size
    const rows = 5;
    const cellW = params.tileSize / cols;
    const cellH = params.tileSize / rows;
    const placements: Placement[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        placements.push({
          x: (c + 0.5) * cellW,
          y: (r + 0.5) * cellH,
          rotationDeg: 0,
          scale: 1,
          colorSeed: r + c,
        });
      }
    }
    return placements;
  },
};
