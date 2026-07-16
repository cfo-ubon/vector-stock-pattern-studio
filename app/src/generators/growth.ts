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
  // Build 004, Section 5 (Leaf Intelligence): 'whorled' and 'radial' are new
  // real arrangement types alongside the original 'alternate'/'opposite' --
  // see `growWhorledLeaves`/`growRadialLeaves` below. Not yet assigned to any
  // shipped family preset (see the module-header note on why), so existing
  // presets/variants are byte-for-byte unchanged.
  arrangement: 'alternate' | 'opposite' | 'whorled' | 'radial';
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
  /** Build 004, Section 5 ("Layered Leaves"): which visual layer this leaf
   * belongs to. Every existing caller paints `leaves.map(...)` in array
   * order, so `growLeaves` returns 'back' leaves before 'front' leaves --
   * real stacking with zero caller changes needed. Always 'front' for
   * 'alternate'/'opposite' (unchanged from Build 003; those arrangements
   * have no layering concept of their own). */
  layer: 'back' | 'front';
}

export function growLeaves(rng: Rng, stem: StemSpline, preset: GrowthPreset): LeafPlacement[] {
  if (preset.arrangement === 'whorled') return growWhorledLeaves(rng, stem, preset);
  if (preset.arrangement === 'radial') return growRadialLeaves(rng, stem, preset);

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
        layer: 'front',
      });
    }
  }
  return placements;
}

/** Build 004, Section 5: real whorled phyllotaxis -- 3-4 leaves radiating
 * from the SAME node in a full ring (not just left/right sides, the way
 * alternate/opposite work), repeated at a handful of nodes up the stem.
 * Bakes in 3 more of the brief's named concepts as this arrangement's own
 * real behavior: "Leaf Rhythm" (each node's position along the stem is
 * jittered, never perfectly evenly spaced), "Leaf Size Hierarchy" (the
 * lowest node sometimes reads as a dominant, larger whorl), and "Layered
 * Leaves" (half of each ring is tagged 'back', painted before the other
 * half, so the ring reads as overlapping foliage instead of a flat fan). */
function growWhorledLeaves(rng: Rng, stem: StemSpline, preset: GrowthPreset): LeafPlacement[] {
  const count = rngInt(rng, preset.leafCount[0], preset.leafCount[1]);
  const perNode = rngBool(rng, 0.5) ? 3 : 4;
  const nodeCount = Math.max(1, Math.round(count / perNode));
  const startT = preset.startT ?? 0.15;
  const endT = preset.endT ?? 0.95;
  const gap = nodeCount > 1 ? (endT - startT) / (nodeCount - 1) : 0;
  const placements: LeafPlacement[] = [];
  for (let n = 0; n < nodeCount; n++) {
    const evenT = nodeCount > 1 ? startT + gap * n : (startT + endT) / 2;
    const t = Math.min(endT, Math.max(startT, evenT + rngRange(rng, -gap * 0.18, gap * 0.18)));
    const sample = stem.sampler.at(t);
    const baseAngle = tangentToUpAngleDeg(sample.tangent) - 180;
    const ringOffset = rngRange(rng, 0, 360);
    const isDominantNode = n === 0 && rngBool(rng, 0.35);
    const taper = Math.max(0.4, 1 - preset.sizeTaper * t);
    for (let k = 0; k < perNode; k++) {
      const angle = baseAngle + ringOffset + (360 / perNode) * k + rngRange(rng, -8, 8);
      const scale = taper * (isDominantNode ? rngRange(rng, 1.15, 1.3) : rngRange(rng, 0.88, 1.05));
      placements.push({
        point: sample.point,
        angle,
        scale,
        side: k % 2 === 0 ? 1 : -1,
        t,
        layer: k < perNode / 2 ? 'back' : 'front',
      });
    }
  }
  return placements;
}

/** Build 004, Section 5: real radial (basal rosette) growth -- every leaf
 * emanates from ONE anchor point near the stem's base across a wide arc,
 * instead of being distributed along the stem's length. "Leaf Rhythm"
 * perturbs each leaf's angular position within the fan; "Leaf Size
 * Hierarchy" makes leaves nearer the anchor larger (newest growth) and
 * outer leaves smaller and further-reaching; "Layered Leaves" paints the
 * outer (older) leaves first so the inner (newer) leaves layer on top, the
 * real growth order of an actual rosette. */
function growRadialLeaves(rng: Rng, stem: StemSpline, preset: GrowthPreset): LeafPlacement[] {
  const count = rngInt(rng, preset.leafCount[0], preset.leafCount[1]);
  const anchorT = preset.startT ?? 0.08;
  const sample = stem.sampler.at(anchorT);
  const baseAngle = tangentToUpAngleDeg(sample.tangent) - 180;
  const arc = rngRange(rng, 210, 330);
  const startAngle = baseAngle - arc / 2;
  const reachBase = stem.length * 0.28;
  const placements: LeafPlacement[] = [];
  for (let i = 0; i < count; i++) {
    const evenFrac = count > 1 ? i / (count - 1) : 0.5;
    const frac = Math.min(1, Math.max(0, evenFrac + rngRange(rng, -0.06, 0.06)));
    const angle = startAngle + arc * frac;
    const reach = reachBase * (0.55 + 0.5 * frac) * rngRange(rng, 0.92, 1.08);
    const scale = Math.max(0.35, (1 - preset.sizeTaper * frac) * rngRange(rng, 0.92, 1.08));
    const rad = (angle * Math.PI) / 180;
    const point: Pt = {
      x: sample.point.x + Math.sin(rad) * reach,
      y: sample.point.y - Math.cos(rad) * reach,
    };
    placements.push({
      point,
      angle,
      scale,
      side: i % 2 === 0 ? 1 : -1,
      t: anchorT,
      layer: frac > 0.5 ? 'front' : 'back',
    });
  }
  // Back leaves first so array order matches paint order at every existing
  // `leaves.map(...)` call site with no caller change required.
  placements.sort((a, b) => (a.layer === b.layer ? 0 : a.layer === 'back' ? -1 : 1));
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
  // Build 004, Section 5: whorled/radial presets for the new arrangement
  // types above. Not yet assigned to any shipped family variant -- doing so
  // would change that variant's geometry for every existing caller (a
  // Variant function can't tell "was I picked via an explicit family hint"
  // from "was I picked by a plain rngPick over the whole pool"), which
  // would ripple into Section 4's just-frozen harness baseline for no
  // benefit this section actually needs. Section 9 (Style DNA botanical
  // grammar) is where per-family leaf-arrangement assignment belongs, once
  // it has real hint-aware call sites to assign it through.
  herbWhorl: { leafCount: [6, 12], arrangement: 'whorled', angleRange: [0, 0], sizeTaper: 0.3, curvature: 0.04, startT: 0.2, endT: 0.9 },
  basalRosette: { leafCount: [5, 9], arrangement: 'radial', angleRange: [0, 0], sizeTaper: 0.45, curvature: 0.02, startT: 0.06 },
};
