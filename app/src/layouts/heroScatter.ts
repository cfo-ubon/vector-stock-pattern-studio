import type { LayoutParams, PatternLayout, Placement, Rng } from '../engine/types';
import { jitter, rngRange, rngInt } from '../engine/rng';
import { spacingForDensity, poissonDiscPoints, wrapCoord } from './shared';
import { generateCluster, clusterBaseRadius, pickCompositionZone } from '../engine/clusterEngine';
import { placeZoneAnchors } from '../engine/compositionZones';
import { createAngleFamily, pickFamilyAngle } from '../engine/rotationFamilies';
import { createRhythmBands, rhythmSpacingMultiplier } from '../engine/rhythmBands';

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
    // Build 003, Part 1/6 (Composition Zone Engine): hero anchors — the
    // placements every supporting cluster grows from — now follow one
    // named composition zone instead of plain uniform scatter, so this
    // layout's overall silhouette reads as "designed to a skeleton", not
    // random hero positions with clusters glued on. The ambient filler
    // layer below stays plain Poisson-disc on purpose — it exists to cover
    // whatever negative space is left over, not to follow the skeleton.
    const zone = pickCompositionZone(rng);
    const heroPoints = placeZoneAnchors(zone, tileSize, heroMinDist, heroTarget, rng);

    // Ambient filler runs at a lower density than Build 001 shipped — each
    // hero's own cluster below now contributes its own filler/accent
    // members nearby, so this layer only needs to cover leftover space.
    const fillerMinDist = spacingForDensity(params.motifSize, params.density) * 0.75;
    const fillerTarget = Math.max(6, Math.round((tileSize * tileSize) / (fillerMinDist * fillerMinDist) / 1.6));
    // Build 003, Part 5 (Rhythm Density Bands): this ambient layer still
    // stays off the zone skeleton (see comment above), but a shared
    // dense/loose wave now varies its spacing across the tile instead of
    // one flat value everywhere, so it reads as rhythm rather than a
    // perfectly uniform scatter.
    const rhythm = createRhythmBands(rng);
    const fillerPoints = poissonDiscPoints(tileSize, fillerMinDist, fillerTarget, rng, (x, y) =>
      rhythmSpacingMultiplier(rhythm, x, y, tileSize),
    );

    const placements: Placement[] = [];
    let colorSeed = 0;
    const clusterRadius = clusterBaseRadius(params.motifSize, params.density) * 0.75;
    // Build 003, Part 9: one shared rotation angle family for every hero and
    // its cluster's supporting members in this tile — the ambient filler
    // layer below stays independent full-range rotation on purpose,
    // mirroring its independent Poisson-disc placement (see the zone
    // comment above).
    const angleFamily = createAngleFamily(rng);

    for (const [x, y] of heroPoints) {
      placements.push({
        x,
        y,
        rotationDeg: pickFamilyAngle(rng, angleFamily, params.rotationJitter),
        scale: Math.max(0.5, 1.5 * (1 + rngRange(rng, -params.scaleJitter, params.scaleJitter))),
        colorSeed: colorSeed++,
        role: 'hero',
      });

      const members = generateCluster('organicScatter', rng, {
        baseRadius: clusterRadius,
        rotationJitter: params.rotationJitter,
        scaleJitter: params.scaleJitter,
        memberCount: rngInt(rng, 2, 4),
        angleFamily,
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
