import type { Rng } from '../engine/types';
import { h, round } from '../engine/svgAst';
import { rngRange, rngBool, rngPick } from '../engine/rng';
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

// Build 007, Section 5 (Petal Variation Library): `organicPetalPath`'s own
// `curvature` already covers 2 of the brief's named variants (pointed at
// curvature~0.15, rounded at curvature~0.85) via one continuous parameter.
// The remaining 4 (folded, curled, damaged, immature) are genuinely
// different *silhouettes* a curvature slider can't reach -- a folded
// petal's far edge tucks back toward its own centerline, a curled petal's
// tip rolls inward instead of reaching its full length, a damaged petal has
// a real inward notch along one edge, an immature petal is a small, barely-
// open, narrow shape (the "bloom stage" a bud sits at just before opening).
// Each builds its own real point set through the same `smoothPathD`
// Catmull-Rom curve every other petal in this app already uses, so they
// stay visually consistent with `organicPetalPath`'s own family of shapes
// rather than introducing a different rendering technique.
export type PetalVariant = 'rounded' | 'pointed' | 'folded' | 'curled' | 'damaged' | 'immature';

export const PETAL_VARIANTS: PetalVariant[] = ['rounded', 'pointed', 'folded', 'curled', 'damaged', 'immature'];

function foldedPetalPath(len: number, width: number, rng?: Rng): string {
  const w = width / 2;
  const foldSide: 1 | -1 = rng && rngBool(rng) ? -1 : 1;
  const points: Pt[] = [
    { x: 0, y: 0 },
    { x: foldSide * w * 0.58, y: -len * 0.32 },
    { x: foldSide * w * 0.48, y: -len * 0.97 },
    // The far edge tucks back toward the centerline instead of reaching its
    // own full width -- a real petal fold, not a symmetric taper.
    { x: -foldSide * w * 0.1, y: -len * 0.8 },
    { x: -foldSide * w * 0.5, y: -len * 0.28 },
  ];
  return smoothPathD(points, { closed: true, tension: 5 });
}

function curledPetalPath(len: number, width: number, rng?: Rng): string {
  const w = width / 2;
  const curl = rng ? rngRange(rng, 0.18, 0.3) : 0.24;
  const points: Pt[] = [
    { x: 0, y: 0 },
    { x: w * 0.62, y: -len * 0.35 },
    { x: w * 0.32, y: -len * (0.98 - curl) },
    // The tip rolls inward and back down rather than reaching full length.
    { x: 0, y: -len * (0.98 - curl * 1.6) },
    { x: -w * 0.32, y: -len * (0.98 - curl) },
    { x: -w * 0.62, y: -len * 0.35 },
  ];
  return smoothPathD(points, { closed: true, tension: 5 });
}

function damagedPetalPath(len: number, width: number, rng?: Rng): string {
  const w = width / 2;
  const notchSide: 1 | -1 = rng && rngBool(rng) ? -1 : 1;
  const notchT = rng ? rngRange(rng, 0.42, 0.68) : 0.55;
  const notchDepth = rng ? rngRange(rng, 0.35, 0.55) : 0.45;
  const points: Pt[] = [
    { x: 0, y: 0 },
    { x: w * 0.56, y: -len * 0.3 },
    { x: w * 0.5, y: -len * 0.97 },
    { x: -w * 0.5, y: -len * 0.97 },
    { x: -w * 0.56, y: -len * 0.3 },
    // A single inward notch along one edge -- a real torn/weathered petal,
    // not a perfectly clean boundary.
    { x: notchSide * w * (1 - notchDepth) * 0.56, y: -len * notchT },
  ];
  return smoothPathD(points, { closed: true, tension: 5 });
}

/** Renders one petal silhouette for a named variant, falling back to
 * `organicPetalPath` at its own default curvature for `'rounded'`/
 * `'pointed'` (no separate geometry needed -- curvature already covers
 * those two) and a real distinct point set for the other 4. `'immature'`
 * reuses `organicPetalPath` at a shrunk scale and narrow curvature -- a
 * genuinely smaller, barely-open petal reads as "not yet fully grown"
 * through scale/proportion rather than needing its own curve family. */
export function variantPetalPath(len: number, width: number, variant: PetalVariant, rng?: Rng): string {
  switch (variant) {
    case 'rounded':
      return organicPetalPath(len, width, 0.85, rng);
    case 'pointed':
      return organicPetalPath(len, width, 0.15, rng);
    case 'immature':
      return organicPetalPath(len * 0.55, width * 0.75, 0.3, rng);
    case 'folded':
      return foldedPetalPath(len, width, rng);
    case 'curled':
      return curledPetalPath(len, width, rng);
    case 'damaged':
      return damagedPetalPath(len, width, rng);
    default:
      return organicPetalPath(len, width, 0.5, rng);
  }
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
  /** Build 007, Section 5 (Petal Variation Library): when given, each petal
   * in the ring independently rolls one of these named variants instead of
   * every petal sharing the same `curvature` -- a real ring of "no two
   * petals identical" shapes rather than N copies of one silhouette.
   * Omitted (the default) reproduces the exact original `curvature`-only
   * behavior, so every existing caller is unaffected. */
  variants?: PetalVariant[];
}

/** A ring of petals around the origin, each with a small independent seeded
 * jitter on angle/length/width — "controlled asymmetry" instead of the
 * perfectly even radial spacing every ring-based flower used to have. */
export function petalRing(rng: Rng, opts: PetalRingOptions): ReturnType<typeof h>[] {
  const { count, distance, length, width, color, curvature = 0.5, angleJitter = 5, scaleJitter = 0.08, rotationOffset = 0, variants } = opts;
  const petals: ReturnType<typeof h>[] = [];
  for (let i = 0; i < count; i++) {
    const asym = radialAsymmetry(rng, angleJitter, scaleJitter);
    const angle = (360 / count) * i + rotationOffset + asym.angle;
    const petalLen = length * asym.lengthScale;
    const petalWidth = width * asym.widthScale;
    const d = variants && variants.length > 0
      ? variantPetalPath(petalLen, petalWidth, rngPick(rng, variants), rng)
      : organicPetalPath(petalLen, petalWidth, curvature, rng);
    petals.push(
      h('g', { transform: `rotate(${round(angle)}) translate(0 ${round(-distance)})` }, [
        h('path', { d, fill: color }),
      ]),
    );
  }
  return petals;
}

/** Build 007, Section 1 (Flower Anatomy Engine): a real two-tier petal
 * hierarchy -- fewer, larger outer petals plus more, smaller inner petals
 * rotated to interleave with the gaps between outer petals (the way a real
 * layered bloom's inner whorl sits, not stacked directly behind the outer
 * one). `openness` (0..1, the "bloom stage") controls how far the inner
 * ring's own distance/scale reads as "opening up" -- 0 keeps the inner
 * ring tight and small (a bloom just starting to open), 1 lets it spread
 * out nearly as wide as the outer ring (a fully open bloom). This is the
 * real fix for a flat single-ring bloom reading as a generic star shape --
 * two ring layers is genuinely different geometry, not a re-labeled single
 * ring. */
export interface LayeredPetalRingOptions {
  outerCount: number;
  innerCount: number;
  outerLength: number;
  outerWidth: number;
  innerScale?: number;
  outerColor: string;
  innerColor: string;
  curvature?: number;
  openness?: number;
  variants?: PetalVariant[];
}

export function layeredPetalRing(rng: Rng, opts: LayeredPetalRingOptions): { outer: ReturnType<typeof h>[]; inner: ReturnType<typeof h>[] } {
  const {
    outerCount, innerCount, outerLength, outerWidth, innerScale = 0.6,
    outerColor, innerColor, curvature = 0.5, openness = 0.75, variants,
  } = opts;
  const outer = petalRing(rng, {
    count: outerCount, distance: 0, length: outerLength, width: outerWidth,
    color: outerColor, curvature, angleJitter: 5, scaleJitter: 0.08, variants,
  });
  const innerDistance = outerLength * 0.12 * (1 - openness);
  const inner = petalRing(rng, {
    count: innerCount,
    distance: innerDistance,
    length: outerLength * innerScale * (0.7 + 0.3 * openness),
    width: outerWidth * innerScale,
    color: innerColor,
    curvature: Math.min(1, curvature + 0.15),
    angleJitter: 6,
    scaleJitter: 0.1,
    rotationOffset: 360 / innerCount / 2,
    variants,
  });
  return { outer, inner };
}
