import { describe, it, expect } from 'vitest';
import { computeCollectionBalance } from './balance';
import { createCollectionPlan } from '../domain/collectionPlan';
import { defaultPatternTypeRatios } from '../planner/collectionPlanner';

describe('computeCollectionBalance', () => {
  it('reports no warnings when counts follow the default ratio', () => {
    const counts = defaultPatternTypeRatios(20);
    const plan = createCollectionPlan({ briefId: 'BRF-1', name: 'X', theme: 'Y', totalSize: 20, patternTypeCounts: counts, now: 1000 });
    const balance = computeCollectionBalance(plan);
    expect(balance.warnings).toEqual([]);
    expect(balance.entries.every((e) => e.withinTolerance)).toBe(true);
  });

  it('flags a hero-heavy collection', () => {
    const counts = { hero: 15, secondary: 1, blender: 1, stripe: 1, border: 1, coordinate: 1, miniPattern: 0, texture: 0 };
    const plan = createCollectionPlan({ briefId: 'BRF-1', name: 'X', theme: 'Y', totalSize: 20, patternTypeCounts: counts, now: 1000 });
    const balance = computeCollectionBalance(plan);
    expect(balance.warnings.some((w) => w.toLowerCase().includes('hero'))).toBe(true);
  });

  it('flags a plan with no hero pattern at all', () => {
    const counts = { hero: 0, secondary: 10, blender: 4, stripe: 2, border: 2, coordinate: 1, miniPattern: 1, texture: 0 };
    const plan = createCollectionPlan({ briefId: 'BRF-1', name: 'X', theme: 'Y', totalSize: 20, patternTypeCounts: counts, now: 1000 });
    const balance = computeCollectionBalance(plan);
    expect(balance.warnings.some((w) => w.includes('no clear focal point'))).toBe(true);
  });
});
