import { describe, it, expect } from 'vitest';
import { createCollectionPlan, isValidCollectionPlan, InvalidCollectionPlanInputError, type PatternTypeCounts } from './collectionPlan';

const counts: PatternTypeCounts = { hero: 2, secondary: 5, blender: 4, stripe: 2, border: 2, coordinate: 3, miniPattern: 1, texture: 1 };

describe('createCollectionPlan', () => {
  it('creates a well-shaped plan', () => {
    const plan = createCollectionPlan({ briefId: 'BRF-1', name: 'Spring', theme: 'Botanical', totalSize: 20, patternTypeCounts: counts, now: 1000 });
    expect(plan.briefId).toBe('BRF-1');
    expect(plan.colorwayCount).toBe(3);
    expect(isValidCollectionPlan(plan)).toBe(true);
  });

  it('rejects an empty briefId', () => {
    expect(() => createCollectionPlan({ briefId: '', name: 'X', theme: 'Y', totalSize: 20, patternTypeCounts: counts })).toThrow(InvalidCollectionPlanInputError);
  });
});
