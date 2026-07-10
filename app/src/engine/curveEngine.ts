import type { Rng } from './types';
import { rngRange } from './rng';
import { round } from './svgAst';

/** Reusable curve/geometry utilities shared by every motif generator that
 * needs organic curves — flower petals, leaf silhouettes, growth stems.
 * Consolidates logic that used to be hand-duplicated (with subtly
 * different Catmull-Rom coefficients and ad-hoc wobble math) across
 * botanical.ts, mandala.ts, organic.ts and animalprint.ts. This module is
 * additive: `engine/svgAst.ts`'s existing `smoothClosedPath` (used by
 * mandala/organic/animalprint) is untouched, since it already works and
 * those call sites weren't part of this round's scope. New/updated
 * botanical motifs use `smoothPathD` here instead, which also supports
 * *open* paths (needed for stem splines). */

export interface Pt {
  x: number;
  y: number;
}

function getPoint(points: Pt[], i: number, closed: boolean): Pt {
  const n = points.length;
  if (closed) return points[((i % n) + n) % n];
  const c = Math.min(Math.max(i, 0), n - 1);
  return points[c];
}

/** Catmull-Rom -> cubic Bezier path string. Works for open paths (stems,
 * ribbons) as well as closed silhouettes (petals, leaves) — a
 * generalization of `svgAst.smoothClosedPath` (closed-only). Every joint
 * is tangent-continuous by construction (no unintended sharp corners). */
export function smoothPathD(points: Pt[], opts: { closed?: boolean; tension?: number } = {}): string {
  const { closed = false, tension = 6 } = opts;
  const n = points.length;
  if (n < 2) return '';
  if (n === 2) {
    return `M ${round(points[0].x)} ${round(points[0].y)} L ${round(points[1].x)} ${round(points[1].y)}`;
  }
  let d = `M ${round(points[0].x)} ${round(points[0].y)}`;
  const segCount = closed ? n : n - 1;
  for (let i = 0; i < segCount; i++) {
    const p0 = getPoint(points, i - 1, closed);
    const p1 = getPoint(points, i, closed);
    const p2 = getPoint(points, i + 1, closed);
    const p3 = getPoint(points, i + 2, closed);
    const c1x = p1.x + (p2.x - p0.x) / tension;
    const c1y = p1.y + (p2.y - p0.y) / tension;
    const c2x = p2.x - (p3.x - p1.x) / tension;
    const c2y = p2.y - (p3.y - p1.y) / tension;
    d += ` C ${round(c1x)} ${round(c1y)}, ${round(c2x)} ${round(c2y)}, ${round(p2.x)} ${round(p2.y)}`;
  }
  if (closed) d += ' Z';
  return d;
}

function catmullRomPoint(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const t2 = t * t;
  const t3 = t2 * t;
  const v0x = (p2.x - p0.x) / 2;
  const v0y = (p2.y - p0.y) / 2;
  const v1x = (p3.x - p1.x) / 2;
  const v1y = (p3.y - p1.y) / 2;
  const x = (2 * p1.x - 2 * p2.x + v0x + v1x) * t3 + (-3 * p1.x + 3 * p2.x - 2 * v0x - v1x) * t2 + v0x * t + p1.x;
  const y = (2 * p1.y - 2 * p2.y + v0y + v1y) * t3 + (-3 * p1.y + 3 * p2.y - 2 * v0y - v1y) * t2 + v0y * t + p1.y;
  return { x, y };
}

/** Densify a Catmull-Rom spline through sparse control points into a fine
 * polyline — used for arc-length walking (growth placement needs to know
 * "where is 40% of the way along this stem, and which way is it
 * pointing", which sparse control points alone can't answer). */
export function densifySpline(points: Pt[], opts: { closed?: boolean; samplesPerSegment?: number } = {}): Pt[] {
  const { closed = false, samplesPerSegment = 16 } = opts;
  const n = points.length;
  if (n < 2) return points.slice();
  const out: Pt[] = [];
  const segCount = closed ? n : n - 1;
  for (let i = 0; i < segCount; i++) {
    const p0 = getPoint(points, i - 1, closed);
    const p1 = getPoint(points, i, closed);
    const p2 = getPoint(points, i + 1, closed);
    const p3 = getPoint(points, i + 2, closed);
    for (let s = 0; s < samplesPerSegment; s++) {
      out.push(catmullRomPoint(p0, p1, p2, p3, s / samplesPerSegment));
    }
  }
  out.push(closed ? out[0] : points[n - 1]);
  return out;
}

export interface ArcSample {
  point: Pt;
  tangent: Pt;
  normal: Pt;
  t: number;
}

export interface ArcSampler {
  at(t: number): ArcSample;
  length: number;
  dense: Pt[];
}

/** Build a "walk along this curve by arc length" query object from sparse
 * control points. `at(t)` (t in [0,1] of total arc length) returns the
 * position plus a unit tangent/normal — exactly what growth placement
 * needs to orient leaves/branches to the local curve direction instead of
 * an angle picked independently of the stem's actual shape. */
export function buildArcSampler(points: Pt[], opts: { closed?: boolean; samplesPerSegment?: number } = {}): ArcSampler {
  const dense = densifySpline(points, opts);
  const cum: number[] = [0];
  for (let i = 1; i < dense.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y));
  }
  const total = cum[cum.length - 1] || 1;
  function at(t: number): ArcSample {
    const target = Math.min(Math.max(t, 0), 1) * total;
    let lo = 1;
    let hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    const i = lo;
    const segLen = cum[i] - cum[i - 1] || 1;
    const segT = (target - cum[i - 1]) / segLen;
    const a = dense[i - 1];
    const b = dense[i];
    const point = { x: a.x + (b.x - a.x) * segT, y: a.y + (b.y - a.y) * segT };
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const mag = Math.hypot(dx, dy) || 1;
    const tangent = { x: dx / mag, y: dy / mag };
    const normal = { x: -tangent.y, y: tangent.x };
    return { point, tangent, normal, t };
  }
  return { at, length: total, dense };
}

/** SVG `rotate()` uses 0deg = pointing toward -y ("up"), clockwise
 * positive. Convert a unit tangent vector to that same convention so
 * growth placement angles compose directly with `rotate(deg)` transforms. */
export function tangentToUpAngleDeg(tangent: Pt): number {
  return (Math.atan2(tangent.x, -tangent.y) * 180) / Math.PI;
}

/** Sample a smooth "half-width envelope" curve (e.g. a leaf/petal profile)
 * with a small seeded per-sample wobble. The shared implementation behind
 * "papery crinkled" / "softly wobbled" motif edges — previously
 * hand-duplicated with slightly different math in three separate
 * functions across botanical.ts. */
export function wobbleEnvelope(rng: Rng, samples: number, amplitude: number, base: (t: number) => number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    out.push(base(t) * (1 + rngRange(rng, -amplitude, amplitude)));
  }
  return out;
}

export interface AsymmetryJitter {
  angle: number;
  lengthScale: number;
  widthScale: number;
}

/** A small seeded jitter for petal/leaf angle, length and width — breaks
 * perfect radial symmetry in ring layouts ("controlled asymmetry" rather
 * than either perfect symmetry or unreadable noise). */
export function radialAsymmetry(rng: Rng, angleAmount = 6, scaleAmount = 0.08): AsymmetryJitter {
  return {
    angle: rngRange(rng, -angleAmount, angleAmount),
    lengthScale: 1 + rngRange(rng, -scaleAmount, scaleAmount),
    widthScale: 1 + rngRange(rng, -scaleAmount, scaleAmount),
  };
}

/** Curve-quality checks: NaN/Infinity coordinates, zero-length ("degenerate")
 * segments. Returns an empty array when the point set is clean. */
export function validatePoints(points: Pt[], minSegmentLength = 1e-3): string[] {
  const issues: string[] = [];
  points.forEach((p, i) => {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) issues.push(`point ${i} is not finite (${p.x}, ${p.y})`);
  });
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    if (d < minSegmentLength) issues.push(`segment ${i - 1}->${i} is degenerate (length ${d.toFixed(4)})`);
  }
  return issues;
}

/** Drop consecutive points closer than `minSegmentLength` — guarantees no
 * zero-length segments feed into `smoothPathD`/`densifySpline`. */
export function removeDegenerate(points: Pt[], minSegmentLength = 1e-3): Pt[] {
  if (points.length === 0) return points;
  const out: Pt[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = out[out.length - 1];
    const d = Math.hypot(points[i].x - prev.x, points[i].y - prev.y);
    if (d >= minSegmentLength) out.push(points[i]);
  }
  return out;
}

/** Scan a serialized path `d` string for non-finite numbers (a NaN/Infinity
 * anywhere upstream shows up literally as the substring "NaN"/"Infinity"
 * in the output, which is otherwise easy to miss visually at small scale). */
export function validatePathD(d: string): string[] {
  const issues: string[] = [];
  if (/NaN|Infinity/.test(d)) issues.push(`non-finite value in path data: ${d.slice(0, 60)}...`);
  return issues;
}
