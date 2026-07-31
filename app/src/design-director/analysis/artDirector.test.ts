import { describe, it, expect } from 'vitest';
import { computeArtDirectorReview } from './artDirector';
import { computeCollectionCompleteness } from './completeness';
import { computeCollectionBalance } from './balance';
import { computeCollectionDiversity } from './diversity';
import { createCollectionPlan, type PatternTypeCounts } from '../domain/collectionPlan';
import { createCreativeBrief } from '../domain/creativeBrief';
import { defaultPatternTypeRatios } from '../planner/collectionPlanner';

describe('computeArtDirectorReview', () => {
  it('reports "no issues found" for a well-formed, balanced, non-dark plan', () => {
    const counts = defaultPatternTypeRatios(20);
    const brief = createCreativeBrief({ collectionName: 'X', theme: 'Botanical', colorDirection: ['#F0D8C0', '#E8B090'], now: 1000 });
    const plan = createCollectionPlan({ briefId: brief.id, name: 'X', theme: 'Botanical', totalSize: 20, patternTypeCounts: counts, colorwayCount: 3, now: 1000 });
    const completeness = computeCollectionCompleteness(plan);
    const balance = computeCollectionBalance(plan);
    const diversity = computeCollectionDiversity(plan, brief, []);
    const review = computeArtDirectorReview(brief, completeness, balance, diversity);
    expect(review.some((r) => r.id === 'no-issues')).toBe(true);
  });

  it('flags a dark palette using real hex lightness', () => {
    const counts = defaultPatternTypeRatios(20);
    const brief = createCreativeBrief({ collectionName: 'X', theme: 'Botanical', colorDirection: ['#101010', '#0a0a0a'], now: 1000 });
    const plan = createCollectionPlan({ briefId: brief.id, name: 'X', theme: 'Botanical', totalSize: 20, patternTypeCounts: counts, colorwayCount: 3, now: 1000 });
    const completeness = computeCollectionCompleteness(plan);
    const balance = computeCollectionBalance(plan);
    const diversity = computeCollectionDiversity(plan, brief, []);
    const review = computeArtDirectorReview(brief, completeness, balance, diversity);
    expect(review.some((r) => r.id === 'palette-too-dark')).toBe(true);
  });

  it('surfaces every completeness gap as a critical recommendation', () => {
    const counts: PatternTypeCounts = { hero: 0, secondary: 10, blender: 0, stripe: 5, border: 0, coordinate: 0, miniPattern: 0, texture: 5 };
    const brief = createCreativeBrief({ collectionName: 'X', theme: 'Botanical', now: 1000 });
    const plan = createCollectionPlan({ briefId: brief.id, name: 'X', theme: 'Botanical', totalSize: 20, patternTypeCounts: counts, colorwayCount: 1, now: 1000 });
    const completeness = computeCollectionCompleteness(plan);
    const balance = computeCollectionBalance(plan);
    const diversity = computeCollectionDiversity(plan, brief, []);
    const review = computeArtDirectorReview(brief, completeness, balance, diversity);
    expect(review.filter((r) => r.severity === 'critical').length).toBeGreaterThan(0);
  });
});
