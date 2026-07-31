import { describe, it, expect } from 'vitest';
import { computeCollectionCompleteness } from './completeness';
import { createCollectionPlan, type PatternTypeCounts } from '../domain/collectionPlan';

describe('computeCollectionCompleteness', () => {
  it('reports 100% when every check passes', () => {
    const counts: PatternTypeCounts = { hero: 2, secondary: 5, blender: 4, stripe: 2, border: 2, coordinate: 3, miniPattern: 2, texture: 1 };
    const plan = createCollectionPlan({ briefId: 'BRF-1', name: 'X', theme: 'Y', totalSize: 21, patternTypeCounts: counts, colorwayCount: 3, now: 1000 });
    const result = computeCollectionCompleteness(plan);
    expect(result.percent).toBe(100);
    expect(result.missing).toEqual([]);
    expect(result.commercialReadiness).toBe('Ready for production');
  });

  it('names every real gap when the plan is missing hero/blender/border/colorway', () => {
    const counts: PatternTypeCounts = { hero: 0, secondary: 10, blender: 0, stripe: 5, border: 0, coordinate: 0, miniPattern: 0, texture: 5 };
    const plan = createCollectionPlan({ briefId: 'BRF-1', name: 'X', theme: 'Y', totalSize: 20, patternTypeCounts: counts, colorwayCount: 1, now: 1000 });
    const result = computeCollectionCompleteness(plan);
    expect(result.missing).toEqual(expect.arrayContaining(['Missing Hero', 'Missing Blender', 'Missing Border', 'Missing Colorway', 'Missing Coordinate']));
    expect(result.percent).toBeLessThan(100);
  });
});
