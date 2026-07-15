import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import { createAngleFamily, pickFamilyAngle } from './rotationFamilies';

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
