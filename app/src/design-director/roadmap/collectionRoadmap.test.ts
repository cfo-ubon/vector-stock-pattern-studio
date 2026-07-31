import { describe, it, expect } from 'vitest';
import { buildCollectionRoadmap, totalRoadmapHours } from './collectionRoadmap';
import { createCollectionPlan, type PatternTypeCounts } from '../domain/collectionPlan';

const counts: PatternTypeCounts = { hero: 2, secondary: 5, blender: 4, stripe: 2, border: 2, coordinate: 3, miniPattern: 1, texture: 1 };

describe('buildCollectionRoadmap', () => {
  it('produces one ordered step per non-zero pattern type plus a colorway expansion step', () => {
    const plan = createCollectionPlan({ briefId: 'BRF-1', name: 'Spring', theme: 'Botanical', totalSize: 20, patternTypeCounts: counts, colorwayCount: 3, now: 1000 });
    const steps = buildCollectionRoadmap(plan);
    expect(steps[0].patternType).toBe('hero');
    expect(steps.at(-1)!.patternType).toBe('colorwayExpansion');
    expect(steps.every((s, i) => s.order === i + 1)).toBe(true);
    expect(totalRoadmapHours(steps)).toBeGreaterThan(0);
  });

  it('skips zero-count pattern types', () => {
    const zeroed = { ...counts, texture: 0, miniPattern: 0 };
    const plan = createCollectionPlan({ briefId: 'BRF-1', name: 'Spring', theme: 'Botanical', totalSize: 18, patternTypeCounts: zeroed, colorwayCount: 1, now: 1000 });
    const steps = buildCollectionRoadmap(plan);
    expect(steps.find((s) => s.patternType === 'texture')).toBeUndefined();
    expect(steps.find((s) => s.patternType === 'miniPattern')).toBeUndefined();
    expect(steps.find((s) => s.patternType === 'colorwayExpansion')).toBeUndefined();
  });
});
