import { describe, it, expect } from 'vitest';
import { computeRichnessBudget } from './richnessBudget';

describe('computeRichnessBudget (Build 023)', () => {
  it('gives premiumHero styles a higher repair ceiling than non-premium styles', () => {
    const premium = computeRichnessBudget(true);
    const normal = computeRichnessBudget(false);
    expect(premium.maxRepairFraction).toBeGreaterThan(normal.maxRepairFraction);
  });

  it('never returns a fraction of 1.0 or more — some natural looseness is always preserved', () => {
    expect(computeRichnessBudget(true).maxRepairFraction).toBeLessThan(1);
    expect(computeRichnessBudget(false).maxRepairFraction).toBeLessThan(1);
  });
});
