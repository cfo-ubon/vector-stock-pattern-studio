import type { Rng } from '../engine/types';
import { rngInt, rngRange, rngBool } from '../engine/rng';
import { buildArcSampler, smoothPathD, tangentToUpAngleDeg, type ArcSampler, type Pt } from '../engine/curveEngine';

/** Botanical growth logic: build a continuously-curved stem spline, then
 * place leaves/branches along it using the stem's *local tangent* at each
 * point — instead of the previous approach (a straight or single hand-
 * tuned Q-curve stem with leaves rotated by an angle picked independently
 * of the stem's actual direction). This is what makes a branch's leaves
 * genuinely "grow from" the stem rather than sit near it. */

export interface StemSpline {
  controlPoints: Pt[];
  path: string;
  sampler: ArcSampler;
  length: number;
}

/** Build a gently curved stem from base (t=0) to tip (t=1). `curvature` is
 * the max sideways bend as a fraction of the stem length (~0.03 = nearly
 * straight, ~0.2 = a pronounced sweep). Randomly picks a single-bend ("C")
 * or a reversing ("S") sway so repeated motifs don't all curve identically. */
export function generateStem(rng: Rng, length: number, curvature: number, segments = 4): StemSpline {
  const sShape = rngBool(rng);
  const amplitude = length * curvature;
  const controlPoints: Pt[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const y = -length / 2 + length * t;
    const profile = sShape ? Math.sin(t * Math.PI * 2) : Math.sin(t * Math.PI);
    const x = profile * amplitude + rngRange(rng, -length * 0.015, length * 0.015);
    controlPoints.push({ x, y });
  }
  const path = smoothPathD(controlPoints, { closed: false, tension: 6 });
  const sampler = buildArcSampler(controlPoints, { samplesPerSegment: 16 });
  return { controlPoints, path, sampler, length: sampler.length };
}

export interface GrowthPreset {
  leafCount: [number, number];
  arrangement: 'alternate' | 'opposite';
  /** Angle spread (degrees) each leaf fans outward from the stem's local
   * "backtrack" direction — see `growLeaves` for why that reference frame
   * reproduces the established fan-upward look on a straight stem while
   * still responding to real curvature. */
  angleRange: [number, number];
  /** 0..1: how much smaller leaves get near the tip (t=1). */
  sizeTaper: number;
  startT?: number;
  endT?: number;
}

export interface LeafPlacement {
  point: Pt;
  angle: number;
  scale: number;
  side: 1 | -1;
  t: number;
}

export function growLeaves(rng: Rng, stem: StemSpline, preset: GrowthPreset): LeafPlacement[] {
  const count = rngInt(rng, preset.leafCount[0], preset.leafCount[1]);
  const startT = preset.startT ?? 0.12;
  const endT = preset.endT ?? 0.95;
  const positions = preset.arrangement === 'opposite' ? Math.ceil(count / 2) : count;
  const placements: LeafPlacement[] = [];
  for (let i = 0; i < positions; i++) {
    const t = positions > 1 ? startT + (endT - startT) * (i / (positions - 1)) : (startT + endT) / 2;
    const sample = stem.sampler.at(t);
    // "Backtrack" direction (tangent rotated 180deg) is ~0deg (pointing up)
    // for a straight top-to-bottom stem, matching the original fixed
    // fan-upward convention — and it tilts along with real local curvature
    // near a bent tip instead of staying artificially fixed.
    const baseAngle = tangentToUpAngleDeg(sample.tangent) - 180;
    const taper = Math.max(0.35, 1 - preset.sizeTaper * t);
    const sides: Array<1 | -1> = preset.arrangement === 'opposite' ? [1, -1] : [i % 2 === 0 ? 1 : -1];
    for (const side of sides) {
      if (placements.length >= count) break;
      const spread = rngRange(rng, preset.angleRange[0], preset.angleRange[1]);
      placements.push({
        point: sample.point,
        angle: baseAngle + side * spread,
        scale: taper * rngRange(rng, 0.9, 1.08),
        side,
        t,
      });
    }
  }
  return placements;
}

export function terminalPoint(stem: StemSpline): Pt {
  return stem.sampler.at(1).point;
}

/** Named growth presets per species — bundles the parameters that give
 * each botanical family its characteristic silhouette (leaf density,
 * opposite vs. alternate arrangement, how tightly leaves hug the stem,
 * how aggressively they shrink toward the tip). */
export const GROWTH_PRESETS: Record<string, GrowthPreset & { curvature: number }> = {
  eucalyptus: { leafCount: [3, 5], arrangement: 'alternate', angleRange: [55, 75], sizeTaper: 0.35, curvature: 0.05 },
  olive: { leafCount: [4, 6], arrangement: 'alternate', angleRange: [35, 55], sizeTaper: 0.3, curvature: 0.09 },
  laurel: { leafCount: [6, 8], arrangement: 'opposite', angleRange: [50, 65], sizeTaper: 0.25, curvature: 0.03 },
  sage: { leafCount: [3, 5], arrangement: 'alternate', angleRange: [50, 70], sizeTaper: 0.3, curvature: 0.07 },
  fern: { leafCount: [8, 12], arrangement: 'opposite', angleRange: [68, 82], sizeTaper: 0.55, curvature: 0.04, startT: 0.05, endT: 0.98 },
  leafyBranch: { leafCount: [3, 5], arrangement: 'alternate', angleRange: [45, 70], sizeTaper: 0.2, curvature: 0.12 },
};
