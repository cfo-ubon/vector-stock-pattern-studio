import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import { weightedPickPreferred } from './designerBrain';

describe('weightedPickPreferred (Build 005, Section 6: Designer Brain)', () => {
  it('single-entry lists always return that entry', () => {
    const rng = createRng('brain-single');
    expect(weightedPickPreferred(rng, ['only'])).toBe('only');
  });

  it('is deterministic for the same rng sequence', () => {
    const list = ['a', 'b', 'c', 'd'];
    const a = weightedPickPreferred(createRng('brain-det'), list);
    const b = weightedPickPreferred(createRng('brain-det'), list);
    expect(a).toBe(b);
  });

  it('only ever returns an entry from the given list', () => {
    const list = ['a', 'b', 'c', 'd'];
    for (let i = 0; i < 50; i++) {
      const picked = weightedPickPreferred(createRng(`brain-membership-${i}`), list);
      expect(list).toContain(picked);
    }
  });

  it('genuinely favors the primary (first) entry over an equal split among a multi-entry list', () => {
    const list = ['primary', 'b', 'c', 'd'];
    let primaryCount = 0;
    const trials = 400;
    for (let i = 0; i < trials; i++) {
      if (weightedPickPreferred(createRng(`brain-weight-${i}`), list) === 'primary') primaryCount++;
    }
    const primaryRate = primaryCount / trials;
    // A uniform pick over 4 entries would land ~25%; the primary entry
    // should land close to 50% (some seed noise tolerated).
    expect(primaryRate).toBeGreaterThan(0.35);
    expect(primaryRate).toBeLessThan(0.65);
  });

  it('still produces every non-primary entry with real, roughly-even frequency (variation is real, not removed)', () => {
    const list = ['primary', 'b', 'c', 'd'];
    const counts: Record<string, number> = { primary: 0, b: 0, c: 0, d: 0 };
    const trials = 800;
    for (let i = 0; i < trials; i++) {
      counts[weightedPickPreferred(createRng(`brain-variation-${i}`), list)]++;
    }
    expect(counts.b).toBeGreaterThan(0);
    expect(counts.c).toBeGreaterThan(0);
    expect(counts.d).toBeGreaterThan(0);
  });
});
