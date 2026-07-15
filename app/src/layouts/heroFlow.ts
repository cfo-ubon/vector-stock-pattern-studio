import type { LayoutParams, PatternLayout, Placement, Rng } from '../engine/types';
import { jitter, rngRange, rngInt } from '../engine/rng';
import { spacingForDensity, wrapCoord, poissonDiscPoints } from './shared';
import { generateCluster, clusterBaseRadius } from '../engine/clusterEngine';

/** Hero + Editorial Flow: a few large "hero" motifs strung along a single
 * smooth diagonal-ish flow path (an editorial magazine-spread rhythm), each
 * anchoring its own small `editorial`-archetype cluster of secondary/
 * filler/accent members (Build 001.1, Section 2 — Semantic Cluster V2),
 * rotated to the path's own local tangent so the cluster's directional
 * spread reads as "belonging to this hero, on this stretch of the path"
 * rather than a flat scatter of secondary motifs at unrelated points along
 * the whole path (what Build 001 shipped). A lighter ambient filler layer
 * still covers the remaining negative space so the path stays the visual
 * focus. Like S-Curve, the flow path uses a whole-number wave frequency so
 * it continues smoothly across the tile seam. */
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

    // Hero tier: a handful of large motifs directly on the path, each
    // anchoring its own small editorial cluster of supporting members.
    const heroCount = rngInt(rng, 3, 5);
    const clusterRadius = clusterBaseRadius(params.motifSize, params.density) * 0.55;
    for (let i = 0; i < heroCount; i++) {
      const t = (i + 0.5) / heroCount;
      const heroX = t * tileSize;
      const heroY = flowY(t);
      const slopeDeg = flowSlopeDeg(t);
      placements.push({
        x: wrapCoord(heroX, tileSize),
        y: wrapCoord(heroY, tileSize),
        rotationDeg: jitter(rng, slopeDeg, params.rotationJitter * 0.4 + 5),
        scale: Math.max(0.6, 1.6 * (1 + rngRange(rng, -params.scaleJitter, params.scaleJitter))),
        colorSeed: colorSeed++,
        role: 'hero',
      });

      const members = generateCluster('editorial', rng, {
        baseRadius: clusterRadius,
        rotationJitter: params.rotationJitter,
        scaleJitter: params.scaleJitter,
        memberCount: rngInt(rng, 2, 3),
      });
      const theta = (slopeDeg * Math.PI) / 180;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      for (const m of members) {
        if (m.role === 'hero') continue; // the real hero is placed above, at the path point itself
        const rx = m.dx * cos - m.dy * sin;
        const ry = m.dx * sin + m.dy * cos;
        placements.push({
          x: wrapCoord(heroX + rx, tileSize),
          y: wrapCoord(heroY + ry, tileSize),
          rotationDeg: m.rotationDeg,
          scale: Math.max(0.2, m.scaleMul),
          colorSeed: colorSeed++,
          role: m.role,
        });
      }
    }

    // Ambient filler: small motifs scattered through the remaining negative
    // space, at low density — the per-hero clusters above already
    // contribute their own filler/accent members near the path, so this
    // layer only needs to cover what's left over.
    const fillerMinDist = spacing * 1.3;
    const fillerTarget = Math.max(6, Math.round((tileSize * tileSize) / (fillerMinDist * fillerMinDist) / 1.6));
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
