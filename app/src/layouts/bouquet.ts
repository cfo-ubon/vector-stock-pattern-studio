import type { LayoutParams, PatternLayout, Placement, Rng } from '../engine/types';
import { jitter, rngRange, rngInt } from '../engine/rng';
import { spacingForDensity, wrapCoord } from './shared';

/** Bouquet Layout: motifs gathered into small tumbled clusters ("bouquets"
 * of flowers) rather than spread evenly — a large hero motif at each
 * bouquet's center with several smaller motifs clustered tightly around
 * it, then the bouquets themselves repeat across the tile. Reads as
 * "arranged" rather than "scattered", the classic florist's-bunch look. */
export const bouquetLayout: PatternLayout = {
  id: 'bouquet',
  label: 'Bouquet',
  generate(params: LayoutParams, rng: Rng): Placement[] {
    const { tileSize } = params;
    // Bouquets are multi-motif clusters, so space their centers further
    // apart than a single motif would need.
    const spacing = spacingForDensity(params.motifSize, params.density) * 2.2;
    const cols = Math.max(1, Math.round(tileSize / spacing));
    const rows = Math.max(1, Math.round(tileSize / spacing));
    const cellW = tileSize / cols;
    const cellH = tileSize / rows;
    const clusterRadius = Math.min(cellW, cellH) * 0.32;
    const placements: Placement[] = [];
    let colorSeed = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = (c + 0.5) * cellW + jitter(rng, 0, cellW * 0.15);
        const cy = (r + 0.5) * cellH + jitter(rng, 0, cellH * 0.15);

        // Hero at the bouquet's heart.
        placements.push({
          x: wrapCoord(cx, tileSize),
          y: wrapCoord(cy, tileSize),
          rotationDeg: jitter(rng, 0, params.rotationJitter),
          scale: Math.max(0.4, 1.3 * (1 + rngRange(rng, -params.scaleJitter, params.scaleJitter))),
          colorSeed: colorSeed++,
        });

        // Smaller motifs tumbled tightly around it.
        const fillerCount = rngInt(rng, 4, 7);
        for (let i = 0; i < fillerCount; i++) {
          const angle = rngRange(rng, 0, Math.PI * 2);
          const dist = rngRange(rng, clusterRadius * 0.35, clusterRadius);
          placements.push({
            x: wrapCoord(cx + Math.cos(angle) * dist, tileSize),
            y: wrapCoord(cy + Math.sin(angle) * dist, tileSize),
            rotationDeg: jitter(rng, rngRange(rng, 0, 360), params.rotationJitter),
            scale: Math.max(0.3, rngRange(rng, 0.45, 0.75) * (1 + rngRange(rng, -params.scaleJitter, params.scaleJitter))),
            colorSeed: colorSeed++,
          });
        }
      }
    }
    return placements;
  },
};
