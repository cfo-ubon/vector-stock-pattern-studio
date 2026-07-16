import type { LayoutParams, PatternLayout, Placement, Rng } from '../engine/types';
import { jitter } from '../engine/rng';
import { spacingForDensity, wrapCoord } from './shared';
import { generateCluster } from '../engine/clusterEngine';

/** Radial / Mandala — Build 002, Section 5 (Semantic Cluster Engine
 * coverage): each medallion is now a real Cluster Engine `radial` archetype
 * (previously dormant — no layout used it) instead of a hand-rolled ring/
 * fold loop, so every medallion gets real hero/secondary/filler/accent
 * tiering and the archetype's own controlled-overlap band, rather than every
 * ring member competing at the same visual weight. `radialSymmetry` (fold)
 * still drives the member count directly, so the kaleidoscope identity —
 * N roughly-evenly-spaced members per medallion, jittered rather than
 * perfectly regular — is unchanged; only rotation is overridden per member
 * (facing outward from its own medallion center) since a mandala's members
 * must face out to read as petals/rays, unlike a generic cluster's own
 * free rotation. Medallions are still tiled across a sparse grid so
 * multiple mandalas repeat across the surface, distinct from `bouquet`
 * (one dominant cluster) or `heroScatter` (many independent hero clusters
 * with no rotational-symmetry constraint). */
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
    const medallionRadius = Math.min(cellW, cellH) * 0.42;
    const placements: Placement[] = [];
    let colorSeed = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = (c + 0.5) * cellW;
        const cy = (r + 0.5) * cellH;
        const members = generateCluster('radial', rng, {
          baseRadius: medallionRadius,
          rotationJitter: params.rotationJitter * 0.3,
          scaleJitter: params.scaleJitter,
          memberCount: fold,
        });
        for (const m of members) {
          const outwardDeg = m.role === 'hero' ? m.rotationDeg : (Math.atan2(m.dy, m.dx) * 180) / Math.PI + 90;
          placements.push({
            x: wrapCoord(cx + m.dx, params.tileSize),
            y: wrapCoord(cy + m.dy, params.tileSize),
            rotationDeg: jitter(rng, outwardDeg, params.rotationJitter * 0.3),
            scale: Math.max(0.2, m.scaleMul),
            colorSeed: colorSeed++,
            role: m.role,
          });
        }
      }
    }
    return placements;
  },
};
