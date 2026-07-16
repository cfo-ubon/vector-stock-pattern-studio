import type { Rng } from '../engine/types';
import { h, round } from '../engine/svgAst';
import { rngRange } from '../engine/rng';
import { radialAsymmetry, smoothPathD, type Pt } from '../engine/curveEngine';

/** A rounded-tip organic petal built from a handful of Catmull-Rom points
 * instead of an `<ellipse>` — the previous shortcut for several flowers
 * (`flowerBloom`, `layeredBloom`, `ranunculusRosette`, `anemoneFlower`,
 * `daisyFlower`), which meant those families only ever differed by petal
 * *count* and *scale*, not silhouette. `curvature` widens the waist and
 * softens the tip point (0 = narrow/pointed, 1 = full and rounded).
 *
 * Build 005, Section 3 (Premium SVG Illustration Engine, "Petal
 * Variation"): passing `rng` breaks the silhouette's previously-exact
 * left/right mirror symmetry with a small independent jitter per side --
 * a real petal is never a perfect mirror of itself, and every prior
 * caller drew one. Omitting `rng` keeps the exact original symmetric
 * curve (no behavior change for call sites that don't opt in). */
export function organicPetalPath(len: number, width: number, curvature = 0.5, rng?: Rng): string {
  const w = width / 2;
  const jitter = (side: 1 | -1) => (rng ? 1 + side * rngRange(rng, -0.06, 0.06) : 1);
  const points: Pt[] = [
    { x: 0, y: 0 },
    { x: w * (0.5 + curvature * 0.25) * jitter(1), y: -len * 0.3 * (rng ? 1 + rngRange(rng, -0.03, 0.03) : 1) },
    { x: w * curvature * 0.55 * jitter(1), y: -len * 0.98 },
    { x: -w * curvature * 0.55 * jitter(-1), y: -len * 0.98 },
    { x: -w * (0.5 + curvature * 0.25) * jitter(-1), y: -len * 0.3 * (rng ? 1 + rngRange(rng, -0.03, 0.03) : 1) },
  ];
  return smoothPathD(points, { closed: true, tension: 5 });
}

export interface PetalRingOptions {
  count: number;
  distance: number;
  length: number;
  width: number;
  color: string;
  curvature?: number;
  angleJitter?: number;
  scaleJitter?: number;
  rotationOffset?: number;
}

/** A ring of petals around the origin, each with a small independent seeded
 * jitter on angle/length/width — "controlled asymmetry" instead of the
 * perfectly even radial spacing every ring-based flower used to have. */
export function petalRing(rng: Rng, opts: PetalRingOptions): ReturnType<typeof h>[] {
  const { count, distance, length, width, color, curvature = 0.5, angleJitter = 5, scaleJitter = 0.08, rotationOffset = 0 } = opts;
  const petals: ReturnType<typeof h>[] = [];
  for (let i = 0; i < count; i++) {
    const asym = radialAsymmetry(rng, angleJitter, scaleJitter);
    const angle = (360 / count) * i + rotationOffset + asym.angle;
    petals.push(
      h('g', { transform: `rotate(${round(angle)}) translate(0 ${round(-distance)})` }, [
        h('path', { d: organicPetalPath(length * asym.lengthScale, width * asym.widthScale, curvature, rng), fill: color }),
      ]),
    );
  }
  return petals;
}
