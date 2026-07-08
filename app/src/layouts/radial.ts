import type { LayoutParams, PatternLayout, Placement, Rng } from '../engine/types';
import { spacingForDensity, wrapCoord } from './shared';
import { jitter, rngRange } from '../engine/rng';

/** Radial / mandala layout: places medallion centers on a sparse grid (so
 * multiple mandalas tile across the surface), and around each center scatters
 * motifs in rings using N-fold rotational symmetry (`radialSymmetry`). Each
 * ring's motifs are evenly spaced by angle and rotated to face outward,
 * which is what produces the classic kaleidoscope look. */
export const radialLayout: PatternLayout = {
  id: 'radial',
  label: 'Radial / Mandala',
  generate(params: LayoutParams, rng: Rng): Placement[] {
    // Medallions are larger units, so space their centers ~2.6x further
    // apart than a single motif would need.
    const spacing = spacingForDensity(params.motifSize, params.density) * 1.6;
    const cols = Math.max(1, Math.round(params.tileSize / spacing));
    const rows = Math.max(1, Math.round(params.tileSize / spacing));
    const cellW = params.tileSize / cols;
    const cellH = params.tileSize / rows;
    const fold = Math.max(3, Math.round(params.radialSymmetry) || 6);
    const placements: Placement[] = [];
    let colorSeed = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = (c + 0.5) * cellW;
        const cy = (r + 0.5) * cellH;
        const maxRadius = Math.min(cellW, cellH) * 0.42;
        const ringCount = 2;
        for (let ring = 1; ring <= ringCount; ring++) {
          const radius = (maxRadius * ring) / ringCount;
          const scale = 1 - (ring - 1) * 0.22;
          for (let k = 0; k < fold; k++) {
            const angle = (360 / fold) * k + (ring % 2 === 0 ? 360 / fold / 2 : 0);
            const rad = (angle * Math.PI) / 180;
            const x = wrapCoord(cx + radius * Math.cos(rad), params.tileSize);
            const y = wrapCoord(cy + radius * Math.sin(rad), params.tileSize);
            const scaleJitterAmt = rngRange(rng, -params.scaleJitter, params.scaleJitter);
            placements.push({
              x,
              y,
              rotationDeg: jitter(rng, angle + 90, params.rotationJitter * 0.3),
              scale: Math.max(0.3, scale * (1 + scaleJitterAmt)),
              colorSeed: colorSeed++,
            });
          }
        }
        // Center accent motif.
        placements.push({
          x: cx,
          y: cy,
          rotationDeg: jitter(rng, 0, params.rotationJitter),
          scale: 0.9,
          colorSeed: colorSeed++,
        });
      }
    }
    return placements;
  },
};
