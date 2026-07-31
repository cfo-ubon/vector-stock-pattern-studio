import { describe, it, expect } from 'vitest';
import { defaultPatternTypeRatios, buildCollectionPlan } from './collectionPlanner';
import { createCreativeBrief } from '../domain/creativeBrief';
import { COLLECTION_PATTERN_TYPE_VALUES } from '../domain/collectionPlan';

describe('defaultPatternTypeRatios', () => {
  it('splits totalSize across all 8 pattern types summing back to totalSize exactly', () => {
    const counts = defaultPatternTypeRatios(20);
    const sum = COLLECTION_PATTERN_TYPE_VALUES.reduce((s, t) => s + counts[t], 0);
    expect(sum).toBe(20);
    expect(counts.hero).toBeGreaterThan(0);
  });

  it('assigns any rounding remainder to secondary', () => {
    const counts = defaultPatternTypeRatios(7);
    const sum = COLLECTION_PATTERN_TYPE_VALUES.reduce((s, t) => s + counts[t], 0);
    expect(sum).toBe(7);
  });
});

describe('buildCollectionPlan', () => {
  it('builds a plan from a brief using the default ratio', () => {
    const brief = createCreativeBrief({ collectionName: 'Spring', theme: 'Botanical', collectionSize: 20, now: 1000 });
    const plan = buildCollectionPlan(brief, { now: 1000 });
    expect(plan.briefId).toBe(brief.id);
    expect(plan.totalSize).toBe(20);
    expect(plan.name).toBe('Spring');
  });
});
