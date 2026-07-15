import type { LayoutParams, PatternLayout, Placement, Rng } from '../engine/types';
import { spacingForDensity, poissonDiscPoints, wrapCoord } from './shared';
import { generateCluster, clusterBaseRadius } from '../engine/clusterEngine';
import { createAngleFamily, pickFamilyAngle } from '../engine/rotationFamilies';
import { createRhythmBands, rhythmSpacingMultiplier } from '../engine/rhythmBands';

/** Airy Botanical — Build 002, Section 5 (Semantic Cluster Engine
 * coverage): each sparse anchor point now spawns a small real cluster using
 * the new `airy` archetype (Section 5's one genuinely new archetype — see
 * `engine/clusterEngine.ts`'s own doc comment on why it isn't a renamed
 * `organicScatter`/`bouquet`: 1-2 members reaching far out from the hero,
 * almost all accent-weight, and the one archetype exempted from the
 * Cluster Engine's usual forced controlled-overlap band) instead of one
 * flat, independently-scaled motif per point. This keeps airy's real
 * identity — very sparse, mostly-small motifs, generous negative space,
 * only occasional larger accents — but now the "occasional larger one" is
 * a real hero role with real cluster cohesion, not just an independent
 * per-point size roll. */
export const airyLayout: PatternLayout = {
  id: 'airy',
  label: 'Airy Botanical',
  generate(params: LayoutParams, rng: Rng): Placement[] {
    const airyDensity = params.density * 0.35; // always sparse, whatever the slider says
    const minDist = spacingForDensity(params.motifSize, airyDensity) * 1.15;
    const targetCount = Math.max(3, Math.round((params.tileSize * params.tileSize) / (minDist * minDist)));
    // Build 003, Part 5 (Rhythm Density Bands): this plain scatter was the
    // one anchor tier still using a single flat spacing everywhere — a
    // shared dense/loose wave now varies it across the tile instead,
    // keeping airy's generous-negative-space identity while avoiding a
    // perfectly uniform distribution.
    const rhythm = createRhythmBands(rng);
    const points = poissonDiscPoints(params.tileSize, minDist, targetCount, rng, (x, y) =>
      rhythmSpacingMultiplier(rhythm, x, y, params.tileSize),
    );
    const clusterRadius = clusterBaseRadius(params.motifSize, airyDensity) * 0.7;
    const placements: Placement[] = [];
    let colorSeed = 0;
    // Build 003, Part 9: one shared rotation angle family for every member
    // in this tile (this layout rolls its own rotation per member below
    // instead of using the cluster engine's, so the family is applied here).
    const angleFamily = createAngleFamily(rng);

    for (const [x, y] of points) {
      const members = generateCluster('airy', rng, {
        baseRadius: clusterRadius,
        rotationJitter: params.rotationJitter,
        scaleJitter: params.scaleJitter,
      });
      for (const m of members) {
        placements.push({
          x: wrapCoord(x + m.dx, params.tileSize),
          y: wrapCoord(y + m.dy, params.tileSize),
          rotationDeg: pickFamilyAngle(rng, angleFamily, params.rotationJitter),
          scale: Math.max(0.2, m.scaleMul),
          colorSeed: colorSeed++,
          role: m.role,
        });
      }
    }
    return placements;
  },
};
