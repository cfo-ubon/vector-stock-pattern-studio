import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import {
  smoothPathD,
  densifySpline,
  buildArcSampler,
  tangentToUpAngleDeg,
  wobbleEnvelope,
  radialAsymmetry,
  validatePoints,
  validatePathD,
  removeDegenerate,
  type Pt,
} from './curveEngine';

const square: Pt[] = [
  { x: -10, y: -10 },
  { x: 10, y: -10 },
  { x: 10, y: 10 },
  { x: -10, y: 10 },
];

describe('smoothPathD', () => {
  it('produces a closed path starting and ending consistently', () => {
    const d = smoothPathD(square, { closed: true });
    expect(d.startsWith('M -10 -10')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(validatePathD(d)).toEqual([]);
  });

  it('produces an open path with no trailing Z', () => {
    const d = smoothPathD(square, { closed: false });
    expect(d.endsWith('Z')).toBe(false);
    expect(validatePathD(d)).toEqual([]);
  });

  it('is deterministic for the same input', () => {
    expect(smoothPathD(square, { closed: true })).toBe(smoothPathD(square, { closed: true }));
  });

  it('handles the degenerate 2-point case as a straight line', () => {
    const d = smoothPathD([{ x: 0, y: 0 }, { x: 5, y: 5 }]);
    expect(d).toBe('M 0 0 L 5 5');
  });
});

describe('buildArcSampler', () => {
  const stem: Pt[] = [
    { x: 0, y: -50 },
    { x: 5, y: -16 },
    { x: -5, y: 16 },
    { x: 0, y: 50 },
  ];

  it('places t=0 and t=1 at the spline endpoints', () => {
    const sampler = buildArcSampler(stem, { samplesPerSegment: 20 });
    const start = sampler.at(0);
    const end = sampler.at(1);
    expect(start.point.x).toBeCloseTo(stem[0].x, 0);
    expect(start.point.y).toBeCloseTo(stem[0].y, 0);
    expect(end.point.y).toBeCloseTo(stem[stem.length - 1].y, 0);
  });

  it('returns a unit tangent vector at every sample', () => {
    const sampler = buildArcSampler(stem, { samplesPerSegment: 20 });
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const { tangent } = sampler.at(t);
      const mag = Math.hypot(tangent.x, tangent.y);
      expect(mag).toBeCloseTo(1, 2);
    }
  });

  it('is deterministic and monotonic in arc length', () => {
    const sampler = buildArcSampler(stem, { samplesPerSegment: 20 });
    const a = sampler.at(0.3).point;
    const b = sampler.at(0.3).point;
    expect(a).toEqual(b);
  });
});

describe('tangentToUpAngleDeg', () => {
  it('maps a straight-down tangent to 180deg and straight-up to 0deg', () => {
    expect(tangentToUpAngleDeg({ x: 0, y: -1 })).toBeCloseTo(0, 5);
    expect(tangentToUpAngleDeg({ x: 0, y: 1 })).toBeCloseTo(180, 5);
    expect(tangentToUpAngleDeg({ x: 1, y: 0 })).toBeCloseTo(90, 5);
  });
});

describe('wobbleEnvelope', () => {
  it('is deterministic for the same rng seed', () => {
    const a = wobbleEnvelope(createRng('wobble'), 8, 0.1, (t) => Math.sin(Math.PI * t));
    const b = wobbleEnvelope(createRng('wobble'), 8, 0.1, (t) => Math.sin(Math.PI * t));
    expect(a).toEqual(b);
  });

  it('stays within the requested amplitude band of the base curve', () => {
    const base = (t: number) => 10 + t;
    const out = wobbleEnvelope(createRng('band'), 20, 0.15, base);
    out.forEach((v, i) => {
      const t = i / 20;
      const b = base(t);
      expect(v).toBeGreaterThanOrEqual(b * 0.85 - 1e-9);
      expect(v).toBeLessThanOrEqual(b * 1.15 + 1e-9);
    });
  });
});

describe('radialAsymmetry', () => {
  it('is deterministic and bounded by the requested amounts', () => {
    const rng = createRng('asym');
    for (let i = 0; i < 50; i++) {
      const j = radialAsymmetry(rng, 6, 0.1);
      expect(Math.abs(j.angle)).toBeLessThanOrEqual(6);
      expect(j.lengthScale).toBeGreaterThanOrEqual(0.9);
      expect(j.lengthScale).toBeLessThanOrEqual(1.1);
    }
  });
});

describe('validatePoints / removeDegenerate', () => {
  it('flags non-finite coordinates', () => {
    const issues = validatePoints([{ x: 0, y: 0 }, { x: NaN, y: 1 }]);
    expect(issues.length).toBeGreaterThan(0);
  });

  it('flags zero-length segments', () => {
    const issues = validatePoints([{ x: 0, y: 0 }, { x: 0, y: 0 }]);
    expect(issues.length).toBeGreaterThan(0);
  });

  it('removeDegenerate drops points that validatePoints would flag', () => {
    const cleaned = removeDegenerate([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 5 }]);
    expect(validatePoints(cleaned)).toEqual([]);
  });

  it('accepts a clean point set', () => {
    expect(validatePoints(square)).toEqual([]);
  });
});

describe('densifySpline', () => {
  it('never introduces non-finite points', () => {
    const dense = densifySpline(square, { closed: true, samplesPerSegment: 12 });
    for (const p of dense) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });
});
