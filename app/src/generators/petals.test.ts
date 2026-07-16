import { describe, it, expect } from 'vitest';
import { createRng } from '../engine/rng';
import { organicPetalPath, petalRing } from './petals';
import { serialize } from '../engine/svgAst';

describe('organicPetalPath (Build 005, Section 3: Petal Variation)', () => {
  it('omitting rng keeps the original exact symmetric curve', () => {
    const a = organicPetalPath(40, 20, 0.5);
    const b = organicPetalPath(40, 20, 0.5);
    expect(a).toBe(b);
  });

  it('passing rng produces a genuinely different (asymmetric) path than omitting it', () => {
    const withRng = organicPetalPath(40, 20, 0.5, createRng('petal-variation'));
    const withoutRng = organicPetalPath(40, 20, 0.5);
    expect(withRng).not.toBe(withoutRng);
  });

  it('is deterministic for the same seed', () => {
    const a = organicPetalPath(40, 20, 0.5, createRng('petal-variation-det'));
    const b = organicPetalPath(40, 20, 0.5, createRng('petal-variation-det'));
    expect(a).toBe(b);
  });

  it('never produces NaN/Infinity coordinates', () => {
    for (let i = 0; i < 30; i++) {
      const d = organicPetalPath(40, 20, 0.5, createRng(`petal-variation-safety-${i}`));
      expect(d).not.toMatch(/NaN|Infinity/);
    }
  });
});

describe('petalRing (rng-threaded edge variation)', () => {
  it('remains deterministic for the same seed', () => {
    const rng1 = createRng('petal-ring-det');
    const rng2 = createRng('petal-ring-det');
    const a = petalRing(rng1, { count: 6, distance: 10, length: 20, width: 12, color: '#a94438' });
    const b = petalRing(rng2, { count: 6, distance: 10, length: 20, width: 12, color: '#a94438' });
    expect(a.map(serialize)).toEqual(b.map(serialize));
  });

  it('produces valid, finite output', () => {
    const rng = createRng('petal-ring-safety');
    const petals = petalRing(rng, { count: 6, distance: 10, length: 20, width: 12, color: '#a94438' });
    for (const p of petals) {
      expect(serialize(p)).not.toMatch(/NaN|Infinity/);
    }
  });
});
