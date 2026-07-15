import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import { createAngleFamily, pickFamilyAngle, createWindTendency, growthAngleFromOffset, pickNaturalRotation } from './rotationFamilies';

function angularDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

describe('createAngleFamily', () => {
  it('is deterministic for the same seed', () => {
    const a = createAngleFamily(createRng('family-1'));
    const b = createAngleFamily(createRng('family-1'));
    expect(a).toEqual(b);
  });

  it('defaults to 3-4 base angles', () => {
    for (let i = 0; i < 20; i++) {
      const family = createAngleFamily(createRng(`family-count-${i}`));
      expect(family.angles.length).toBeGreaterThanOrEqual(3);
      expect(family.angles.length).toBeLessThanOrEqual(4);
    }
  });

  it('never lands within 10 degrees of a grid-aligned direction (0/45/90/...)', () => {
    const gridAligned = [0, 45, 90, 135, 180, 225, 270, 315, 360];
    for (let i = 0; i < 30; i++) {
      const family = createAngleFamily(createRng(`family-grid-${i}`));
      for (const angle of family.angles) {
        for (const g of gridAligned) {
          const d = Math.min(Math.abs(angle - g) % 360, 360 - (Math.abs(angle - g) % 360));
          expect(d).toBeGreaterThanOrEqual(10);
        }
      }
    }
  });

  it('keeps every angle at least 60% of the even-spacing distance apart', () => {
    for (let i = 0; i < 30; i++) {
      const family = createAngleFamily(createRng(`family-sep-${i}`));
      const minSeparation = (360 / family.angles.length) * 0.6;
      for (let a = 0; a < family.angles.length; a++) {
        for (let b = a + 1; b < family.angles.length; b++) {
          const d = Math.min(Math.abs(family.angles[a] - family.angles[b]) % 360, 360 - (Math.abs(family.angles[a] - family.angles[b]) % 360));
          expect(d).toBeGreaterThanOrEqual(minSeparation - 1e-6);
        }
      }
    }
  });
});

describe('pickFamilyAngle', () => {
  it('is deterministic for the same seed', () => {
    const family = createAngleFamily(createRng('pick-family-1'));
    const a = pickFamilyAngle(createRng('pick-1'), family, 15);
    const b = pickFamilyAngle(createRng('pick-1'), family, 15);
    expect(a).toBe(b);
  });

  it('stays within jitterAmount of one of the family bases', () => {
    const family = createAngleFamily(createRng('pick-family-2'));
    for (let i = 0; i < 50; i++) {
      const angle = pickFamilyAngle(createRng(`pick-2-${i}`), family, 15);
      const closest = Math.min(...family.angles.map((a) => Math.min(Math.abs(angle - a) % 360, 360 - (Math.abs(angle - a) % 360))));
      expect(closest).toBeLessThanOrEqual(15 + 1e-6);
    }
  });

  it('spreads picks across every family base roughly evenly over many draws', () => {
    const family = createAngleFamily(createRng('pick-family-3'));
    const counts = new Array(family.angles.length).fill(0);
    const rng = createRng('pick-3-many');
    const trials = 400;
    for (let i = 0; i < trials; i++) {
      const angle = pickFamilyAngle(rng, family, 10);
      let closestIdx = 0;
      let closestDist = Infinity;
      family.angles.forEach((a, idx) => {
        const d = Math.min(Math.abs(angle - a) % 360, 360 - (Math.abs(angle - a) % 360));
        if (d < closestDist) { closestDist = d; closestIdx = idx; }
      });
      counts[closestIdx]++;
    }
    const expected = trials / family.angles.length;
    for (const c of counts) {
      expect(c).toBeGreaterThan(expected * 0.5);
      expect(c).toBeLessThan(expected * 1.5);
    }
  });
});

describe('createWindTendency: Build 004 Section 7', () => {
  it('is deterministic for the same seed', () => {
    const a = createWindTendency(createRng('wind-1'));
    const b = createWindTendency(createRng('wind-1'));
    expect(a).toEqual(b);
  });

  it('produces a real angle in [0, 360) and a modest strength (0.08-0.22)', () => {
    for (let i = 0; i < 20; i++) {
      const wind = createWindTendency(createRng(`wind-range-${i}`));
      expect(wind.angleDeg).toBeGreaterThanOrEqual(0);
      expect(wind.angleDeg).toBeLessThan(360);
      expect(wind.strength).toBeGreaterThanOrEqual(0.08);
      expect(wind.strength).toBeLessThanOrEqual(0.22);
    }
  });
});

describe('growthAngleFromOffset: Build 004 Section 7', () => {
  it('matches the tangentToUpAngleDeg convention (0deg = up/-y, 90deg = right/+x)', () => {
    expect(growthAngleFromOffset(0, -1)).toBeCloseTo(0, 5);
    expect(growthAngleFromOffset(1, 0)).toBeCloseTo(90, 5);
    expect(growthAngleFromOffset(0, 1)).toBeCloseTo(180, 5);
    expect(growthAngleFromOffset(-1, 0)).toBeCloseTo(-90, 5);
  });
});

describe('pickNaturalRotation: Build 004 Section 7', () => {
  const family = createAngleFamily(createRng('natural-family'));

  it('is deterministic for the same seed', () => {
    const input = { family, jitterAmount: 15, growthAngleDeg: 90, growthWeight: 0.6, wind: { angleDeg: 40, strength: 0.15 }, gravityWeight: 0.1 };
    const a = pickNaturalRotation(createRng('natural-det'), input);
    const b = pickNaturalRotation(createRng('natural-det'), input);
    expect(a).toBe(b);
  });

  it('with no growth/wind/gravity influence, behaves like plain family-based rotation (stays within jitter of a family base)', () => {
    for (let i = 0; i < 30; i++) {
      const angle = pickNaturalRotation(createRng(`natural-plain-${i}`), { family, jitterAmount: 15 });
      const closest = Math.min(...family.angles.map((a) => angularDist(angle, a)));
      expect(closest).toBeLessThanOrEqual(15 + 1e-6);
    }
  });

  it('a strongly-weighted growth direction pulls rotation close to it, overriding the family base', () => {
    for (let i = 0; i < 20; i++) {
      const angle = pickNaturalRotation(createRng(`natural-growth-${i}`), {
        family,
        jitterAmount: 5,
        growthAngleDeg: 200,
        growthWeight: 0.95,
      });
      expect(angularDist(angle, 200)).toBeLessThan(20);
    }
  });

  it('a strong wind tendency pulls the average rotation toward the wind angle over many draws', () => {
    const wind = { angleDeg: 60, strength: 0.9 };
    const rng = createRng('natural-wind-many');
    let sumSin = 0;
    let sumCos = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
      const angle = pickNaturalRotation(rng, { family, jitterAmount: 10, wind });
      const rad = (angle * Math.PI) / 180;
      sumSin += Math.sin(rad);
      sumCos += Math.cos(rad);
    }
    const meanAngle = (Math.atan2(sumSin / trials, sumCos / trials) * 180) / Math.PI;
    expect(angularDist(meanAngle, wind.angleDeg)).toBeLessThan(20);
  });

  it('a full gravity weight pulls rotation to straight down (180deg) regardless of family/growth', () => {
    for (let i = 0; i < 20; i++) {
      const angle = pickNaturalRotation(createRng(`natural-gravity-${i}`), {
        family,
        jitterAmount: 5,
        growthAngleDeg: 10,
        growthWeight: 0.3,
        gravityWeight: 1,
      });
      expect(angularDist(angle, 180)).toBeLessThan(15);
    }
  });

  it('never produces NaN even when weighted vectors nearly cancel', () => {
    const cancelFamily = { angles: [0] };
    for (let i = 0; i < 10; i++) {
      const angle = pickNaturalRotation(createRng(`natural-cancel-${i}`), {
        family: cancelFamily,
        jitterAmount: 5,
        growthAngleDeg: 180,
        growthWeight: 0.5,
      });
      expect(Number.isFinite(angle)).toBe(true);
    }
  });
});
