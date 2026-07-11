import type { LayoutParams, PatternLayout, Placement, Rng } from '../engine/types';
import { jitter, rngRange, rngInt } from '../engine/rng';
import { spacingForDensity, wrapCoord, poissonDiscPoints } from './shared';

/** Hero + Editorial Flow: a few large "hero" motifs strung along a single
 * smooth diagonal-ish flow path (an editorial magazine-spread rhythm),
 * medium "secondary" motifs following just off the path, and small filler
 * motifs scattered through the remaining negative space — three visual
 * tiers instead of one uniform density, which is what makes a composition
 * read as "directed" rather than "random". Like S-Curve, the flow path
 * uses a whole-number wave frequency so it continues smoothly across the
 * tile seam. */
export const heroFlowLayout: PatternLayout = {
  id: 'heroFlow',
  label: 'Hero + Editorial Flow',
  generate(params: LayoutParams, rng: Rng): Placement[] {
    const { tileSize } = params;
    const spacing = spacingForDensity(params.motifSize, params.density);
    const freq = 1;
    const amplitude = tileSize * rngRange(rng, 0.15, 0.25);
    const phase = rngRange(rng, 0, Math.PI * 2);
    const flowY = (t: number) => tileSize * 0.5 + amplitude * Math.sin(2 * Math.PI * freq * t + phase);
    const flowSlopeDeg = (t: number) => {
      const slope = amplitude * (2 * Math.PI * freq) * Math.cos(2 * Math.PI * freq * t + phase);
      return (Math.atan2(slope / tileSize, 1) * 180) / Math.PI;
    };

    const placements: Placement[] = [];
    let colorSeed = 0;

    // Hero tier: a handful of large motifs directly on the path.
    const heroCount = rngInt(rng, 3, 5);
    for (let i = 0; i < heroCount; i++) {
      const t = (i + 0.5) / heroCount;
      placements.push({
        x: wrapCoord(t * tileSize, tileSize),
        y: wrapCoord(flowY(t), tileSize),
        rotationDeg: jitter(rng, flowSlopeDeg(t), params.rotationJitter * 0.4 + 5),
        scale: Math.max(0.6, 1.6 * (1 + rngRange(rng, -params.scaleJitter, params.scaleJitter))),
        colorSeed: colorSeed++,
        role: 'hero',
      });
    }

    // Secondary tier: medium motifs just off the path.
    const secondaryCount = heroCount * rngInt(rng, 2, 3);
    for (let i = 0; i < secondaryCount; i++) {
      const t = rngRange(rng, 0, 1);
      const sideOffset = rngRange(rng, amplitude * 0.4, amplitude * 0.9) * (rngInt(rng, 0, 1) === 0 ? 1 : -1);
      placements.push({
        x: wrapCoord(t * tileSize, tileSize),
        y: wrapCoord(flowY(t) + sideOffset, tileSize),
        rotationDeg: jitter(rng, rngRange(rng, 0, 360), params.rotationJitter),
        scale: Math.max(0.4, rngRange(rng, 0.75, 1.0) * (1 + rngRange(rng, -params.scaleJitter, params.scaleJitter))),
        colorSeed: colorSeed++,
        role: 'secondary',
      });
    }

    // Filler tier: small motifs scattered through the remaining negative
    // space, at low density so the flow stays the visual focus.
    const fillerMinDist = spacing * 1.3;
    const fillerTarget = Math.max(6, Math.round((tileSize * tileSize) / (fillerMinDist * fillerMinDist) / 2));
    const fillerPoints = poissonDiscPoints(tileSize, fillerMinDist, fillerTarget, rng);
    for (const [x, y] of fillerPoints) {
      placements.push({
        x,
        y,
        rotationDeg: jitter(rng, rngRange(rng, 0, 360), params.rotationJitter),
        scale: Math.max(0.25, rngRange(rng, 0.3, 0.5) * (1 + rngRange(rng, -params.scaleJitter, params.scaleJitter))),
        colorSeed: colorSeed++,
        role: 'filler',
      });
    }

    return placements;
  },
};
