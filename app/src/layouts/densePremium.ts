import type { LayoutParams, PatternLayout, Placement, Rng } from '../engine/types';
import { jitter, rngRange, rngInt } from '../engine/rng';
import { spacingForDensity, poissonDiscPoints, wrapCoord } from './shared';
import { generateCluster, clusterBaseRadius } from '../engine/clusterEngine';

/** Dense Premium: three overlapping scale tiers (large, medium, small)
 * layered on top of each other at high overall density — the "maximalist,
 * carefully composed" look of a richly layered fabric where the surface
 * never reads as empty at any zoom level. Ignores the low end of the
 * density slider (floored at 55%) since a sparse "dense" layout would
 * defeat the point.
 *
 * Build 001.1, Section 2 (Semantic Cluster V2): the hero and secondary
 * tiers stay independent Poisson-disc layers — that independence *is* this
 * layout's identity (three overlapping densities, not one hero-centric
 * composition). What changes is the smallest tier: instead of scattering
 * every filler motif fully independently of the tiers above it, each hero
 * anchor also gets a small, tight `bouquet` cluster of filler/accent
 * members orbiting it, so at least some of the filler layer visibly
 * belongs to a specific hero rather than reading as an unrelated third
 * density laid on top. The standalone filler tier's own target count is
 * reduced accordingly, since the clusters already contribute part of it. */
export const densePremiumLayout: PatternLayout = {
  id: 'densePremium',
  label: 'Dense Premium',
  generate(params: LayoutParams, rng: Rng): Placement[] {
    const { tileSize } = params;
    const density = Math.max(params.density, 0.55);
    const baseSpacing = spacingForDensity(params.motifSize, density);
    const placements: Placement[] = [];
    let colorSeed = 0;

    const heroMinDist = baseSpacing * 1.7;
    const heroTarget = Math.max(4, Math.round((tileSize * tileSize) / (heroMinDist * heroMinDist)));
    const heroPoints = poissonDiscPoints(tileSize, heroMinDist, heroTarget, rng);
    const clusterRadius = clusterBaseRadius(params.motifSize, density) * 0.5;
    for (const [x, y] of heroPoints) {
      placements.push({
        x,
        y,
        rotationDeg: jitter(rng, rngRange(rng, 0, 360), params.rotationJitter),
        scale: Math.max(0.25, 1.15 * (1 + rngRange(rng, -params.scaleJitter, params.scaleJitter))),
        colorSeed: colorSeed++,
        role: 'hero',
      });

      const members = generateCluster('bouquet', rng, {
        baseRadius: clusterRadius,
        rotationJitter: params.rotationJitter,
        scaleJitter: params.scaleJitter,
        memberCount: rngInt(rng, 2, 3),
      });
      for (const m of members) {
        if (m.role === 'hero') continue; // the real hero is placed above
        placements.push({
          x: wrapCoord(x + m.dx, tileSize),
          y: wrapCoord(y + m.dy, tileSize),
          rotationDeg: m.rotationDeg,
          scale: Math.max(0.2, m.scaleMul * 0.7),
          colorSeed: colorSeed++,
          role: m.role === 'secondary' ? 'filler' : m.role,
        });
      }
    }

    const secondaryMinDist = baseSpacing * 1.05;
    const secondaryTarget = Math.max(4, Math.round((tileSize * tileSize) / (secondaryMinDist * secondaryMinDist)));
    const secondaryPoints = poissonDiscPoints(tileSize, secondaryMinDist, secondaryTarget, rng);
    for (const [x, y] of secondaryPoints) {
      placements.push({
        x,
        y,
        rotationDeg: jitter(rng, rngRange(rng, 0, 360), params.rotationJitter),
        scale: Math.max(0.25, 0.72 * (1 + rngRange(rng, -params.scaleJitter, params.scaleJitter))),
        colorSeed: colorSeed++,
        role: 'secondary',
      });
    }

    const fillerMinDist = baseSpacing * 0.65;
    const fillerTarget = Math.max(4, Math.round((tileSize * tileSize) / (fillerMinDist * fillerMinDist) / 1.15));
    const fillerPoints = poissonDiscPoints(tileSize, fillerMinDist, fillerTarget, rng);
    for (const [x, y] of fillerPoints) {
      placements.push({
        x,
        y,
        rotationDeg: jitter(rng, rngRange(rng, 0, 360), params.rotationJitter),
        scale: Math.max(0.25, 0.4 * (1 + rngRange(rng, -params.scaleJitter, params.scaleJitter))),
        colorSeed: colorSeed++,
        role: 'filler',
      });
    }
    return placements;
  },
};
