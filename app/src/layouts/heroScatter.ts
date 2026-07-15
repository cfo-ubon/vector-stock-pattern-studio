import type { LayoutParams, PatternLayout, Placement, Rng } from '../engine/types';
import { jitter, rngRange, rngInt } from '../engine/rng';
import { spacingForDensity, poissonDiscPoints, wrapCoord } from './shared';
import { generateCluster, clusterBaseRadius } from '../engine/clusterEngine';

/** Hero + Random Scatter: a handful of large, widely-spaced "hero" motifs,
 * each anchoring its own small `organicScatter`-archetype cluster of
 * secondary/filler/accent members (Build 001.1, Section 2 — Semantic
 * Cluster V2), plus a lighter ambient filler layer scattered through the
 * remaining negative space — a two-tier density that gives the pattern a
 * clear focal hierarchy instead of every motif competing at the same
 * visual weight, now with each hero visibly having its own supporting
 * "burst" rather than every filler motif being equally unrelated to every
 * hero (what Build 001 shipped). */
export const heroScatterLayout: PatternLayout = {
  id: 'heroScatter',
  label: 'Hero + Scatter',
  generate(params: LayoutParams, rng: Rng): Placement[] {
    const { tileSize } = params;
    const heroMinDist = spacingForDensity(params.motifSize, params.density) * 2.4;
    const heroTarget = Math.max(2, Math.round((tileSize * tileSize) / (heroMinDist * heroMinDist)));
    const heroPoints = poissonDiscPoints(tileSize, heroMinDist, heroTarget, rng);

    // Ambient filler runs at a lower density than Build 001 shipped — each
    // hero's own cluster below now contributes its own filler/accent
    // members nearby, so this layer only needs to cover leftover space.
    const fillerMinDist = spacingForDensity(params.motifSize, params.density) * 0.75;
    const fillerTarget = Math.max(6, Math.round((tileSize * tileSize) / (fillerMinDist * fillerMinDist) / 1.6));
    const fillerPoints = poissonDiscPoints(tileSize, fillerMinDist, fillerTarget, rng);

    const placements: Placement[] = [];
    let colorSeed = 0;
    const clusterRadius = clusterBaseRadius(params.motifSize, params.density) * 0.75;

    for (const [x, y] of heroPoints) {
      placements.push({
        x,
        y,
        rotationDeg: jitter(rng, rngRange(rng, 0, 360), params.rotationJitter),
        scale: Math.max(0.5, 1.5 * (1 + rngRange(rng, -params.scaleJitter, params.scaleJitter))),
        colorSeed: colorSeed++,
        role: 'hero',
      });

      const members = generateCluster('organicScatter', rng, {
        baseRadius: clusterRadius,
        rotationJitter: params.rotationJitter,
        scaleJitter: params.scaleJitter,
        memberCount: rngInt(rng, 2, 4),
      });
      for (const m of members) {
        if (m.role === 'hero') continue; // the real hero is placed above
        placements.push({
          x: wrapCoord(x + m.dx, tileSize),
          y: wrapCoord(y + m.dy, tileSize),
          rotationDeg: m.rotationDeg,
          scale: Math.max(0.2, m.scaleMul),
          colorSeed: colorSeed++,
          role: m.role,
        });
      }
    }
    // Build 002, Section 4: widened from [0.35, 0.55] — this ambient filler
    // layer is typically the most numerous tier on the tile (every hero's
    // own cluster contributes its own filler/accent on top), so a narrow
    // fixed range reliably packed a majority of instances into one bucket
    // of the real scale-repeat detector (critic/visualAnalysis.ts).
    for (const [x, y] of fillerPoints) {
      placements.push({
        x,
        y,
        rotationDeg: jitter(rng, rngRange(rng, 0, 360), params.rotationJitter),
        scale: Math.max(0.25, rngRange(rng, 0.32, 0.58) * (1 + rngRange(rng, -params.scaleJitter, params.scaleJitter))),
        colorSeed: colorSeed++,
        role: 'filler',
      });
    }
    return placements;
  },
};
