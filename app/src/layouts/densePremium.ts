import type { LayoutParams, PatternLayout, Placement, Rng } from '../engine/types';
import { jitter, rngRange, rngInt } from '../engine/rng';
import { spacingForDensity, poissonDiscPoints, wrapCoord } from './shared';
import { generateCluster, clusterBaseRadius, pickCompositionZone } from '../engine/clusterEngine';
import { placeZoneAnchors } from '../engine/compositionZones';
import { createAngleFamily, pickFamilyAngle } from '../engine/rotationFamilies';
import { createRhythmBands, rhythmSpacingMultiplier } from '../engine/rhythmBands';

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
    // Build 003, Part 1/6: the hero tier (the one tier every other layer
    // orbits/layers around) now follows a real composition zone; the
    // secondary/filler tiers stay independent Poisson-disc on purpose —
    // that independence is this layout's own documented identity (three
    // overlapping densities, not one hero-centric skeleton).
    // Build 003, Part 7 (Style Grammar): a Style DNA preset's own zone
    // preference (if any) wins over a random pick, so its "design
    // language" includes a real compositional identity.
    const zone = params.preferredZone ?? pickCompositionZone(rng);
    const heroPoints = placeZoneAnchors(zone, tileSize, heroMinDist, heroTarget, rng);
    const clusterRadius = clusterBaseRadius(params.motifSize, density) * 0.5;
    // Build 003, Part 9: one shared rotation angle family for every hero and
    // its cluster's supporting members in this tile — the secondary/filler
    // tiers below stay independent full-range rotation on purpose, mirroring
    // their independent-Poisson-disc placement (this layout's own documented
    // identity, see the zone comment above).
    const angleFamily = createAngleFamily(rng);
    for (const [x, y] of heroPoints) {
      placements.push({
        x,
        y,
        rotationDeg: pickFamilyAngle(rng, angleFamily, params.rotationJitter),
        scale: Math.max(0.25, 1.15 * (1 + rngRange(rng, -params.scaleJitter, params.scaleJitter))),
        colorSeed: colorSeed++,
        role: 'hero',
      });

      const members = generateCluster('bouquet', rng, {
        baseRadius: clusterRadius,
        rotationJitter: params.rotationJitter,
        scaleJitter: params.scaleJitter,
        memberCount: rngInt(rng, 2, 3),
        angleFamily,
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

    // Build 002, Section 4: secondary/filler scale widened from a fixed
    // multiplier (0.72 / 0.4) +/- scaleJitter to a real range — these two
    // tiers are independent Poisson-disc layers (not routed through
    // engine/clusterEngine.ts's ROLE_SCALE_RANGE at all), so at the default
    // scaleJitter (0.15) their instances landed in a narrow +/-15% band,
    // reliably packing the majority of the tile's placements into one
    // bucket of the real scale-repeat detector (critic/visualAnalysis.ts).
    // Build 003, Part 5 (Rhythm Density Bands): shared across both
    // independent tiers below, so the whole "background" of the pattern
    // (not just one tier) commits to the same dense/loose wave instead of
    // each tier's flat spacing reading as separately uniform.
    //
    // Build 003, Part 4 (hero-size-aware negative space): deliberately NOT
    // applied here, unlike heroScatter/heroFlow's ambient filler — this
    // layout's whole identity is "richly layered fabric that never reads
    // as empty at any zoom level" (see the module doc comment above), so
    // secondary/filler tiers crowding a hero is the intended maximalist
    // look, not the "leftover negative space" those two other layouts
    // explicitly describe their own ambient layer as covering.
    const rhythm = createRhythmBands(rng);
    const secondaryMinDist = baseSpacing * 1.05;
    const secondaryTarget = Math.max(4, Math.round((tileSize * tileSize) / (secondaryMinDist * secondaryMinDist)));
    const secondaryPoints = poissonDiscPoints(tileSize, secondaryMinDist, secondaryTarget, rng, (x, y) =>
      rhythmSpacingMultiplier(rhythm, x, y, tileSize),
    );
    for (const [x, y] of secondaryPoints) {
      placements.push({
        x,
        y,
        rotationDeg: jitter(rng, rngRange(rng, 0, 360), params.rotationJitter),
        scale: Math.max(0.25, rngRange(rng, 0.63, 0.83) * (1 + rngRange(rng, -params.scaleJitter, params.scaleJitter))),
        colorSeed: colorSeed++,
        role: 'secondary',
      });
    }

    const fillerMinDist = baseSpacing * 0.65;
    const fillerTarget = Math.max(4, Math.round((tileSize * tileSize) / (fillerMinDist * fillerMinDist) / 1.15));
    const fillerPoints = poissonDiscPoints(tileSize, fillerMinDist, fillerTarget, rng, (x, y) =>
      rhythmSpacingMultiplier(rhythm, x, y, tileSize),
    );
    for (const [x, y] of fillerPoints) {
      placements.push({
        x,
        y,
        rotationDeg: jitter(rng, rngRange(rng, 0, 360), params.rotationJitter),
        scale: Math.max(0.25, rngRange(rng, 0.32, 0.48) * (1 + rngRange(rng, -params.scaleJitter, params.scaleJitter))),
        colorSeed: colorSeed++,
        role: 'filler',
      });
    }
    return placements;
  },
};
