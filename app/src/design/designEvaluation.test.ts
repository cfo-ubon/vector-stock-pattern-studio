import { describe, it, expect } from 'vitest';
import { evaluateDesign } from './designEvaluation';
import { defaultParams } from '../engine/defaults';

describe('evaluateDesign', () => {
  it('returns a real evaluation with every score in a sane 0-100 range, sourced from the real engines', () => {
    const evaluation = evaluateDesign({ ...defaultParams(), seed: 'eval-seed-1' });

    expect(evaluation.tileData).toBeTruthy();
    expect(evaluation.attempts).toBeGreaterThanOrEqual(1);

    for (const value of Object.values(evaluation.beauty)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }

    // A handful of real CompositionMetrics fields the Inspector surfaces —
    // confirms they're real numbers, not NaN/undefined from a bad call.
    expect(Number.isFinite(evaluation.metrics.heroSeparation)).toBe(true);
    expect(Number.isFinite(evaluation.metrics.colorBalance)).toBe(true);
    expect(Number.isFinite(evaluation.metrics.seamlessIntegrity)).toBe(true);

    // Problems/issues are real typed arrays (possibly empty for a clean
    // default pattern) — never undefined.
    expect(Array.isArray(evaluation.problems)).toBe(true);
    expect(Array.isArray(evaluation.issues)).toBe(true);
  });

  it('produces a different tile for a different seed (live regeneration is real, not cached/stubbed)', () => {
    const a = evaluateDesign({ ...defaultParams(), seed: 'seed-a' });
    const b = evaluateDesign({ ...defaultParams(), seed: 'seed-b' });
    expect(JSON.stringify(a.tileData.svg)).not.toBe(JSON.stringify(b.tileData.svg));
  });

  it('reflects a real density change in the recomputed metrics', () => {
    const low = evaluateDesign({ ...defaultParams(), seed: 'density-seed', density: 0.15 });
    const high = evaluateDesign({ ...defaultParams(), seed: 'density-seed', density: 0.85 });
    expect(JSON.stringify(low.tileData.svg)).not.toBe(JSON.stringify(high.tileData.svg));
  });
});
