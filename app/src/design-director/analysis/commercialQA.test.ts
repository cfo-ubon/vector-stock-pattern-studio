import { describe, it, expect } from 'vitest';
import { computeCommercialQA } from './commercialQA';
import { computeCollectionCompleteness } from './completeness';
import { computeCollectionBalance } from './balance';
import { computeCollectionDiversity } from './diversity';
import { createCollectionPlan } from '../domain/collectionPlan';
import { createCreativeBrief } from '../domain/creativeBrief';
import { defaultPatternTypeRatios } from '../planner/collectionPlanner';

describe('computeCommercialQA', () => {
  it('scores all 9 dimensions and derives Commercial Readiness as their average', () => {
    const counts = defaultPatternTypeRatios(20);
    const brief = createCreativeBrief({
      collectionName: 'X',
      theme: 'Botanical',
      targetMarketplace: 'etsy',
      targetProducts: ['fabric', 'homeDecor'],
      heroStyle: 'Watercolor',
      colorDirection: ['#9CAF88'],
      buyerPersona: 'Gift buyers',
      confidence: 'high',
      now: 1000,
    });
    const plan = createCollectionPlan({
      briefId: brief.id,
      name: 'X',
      theme: 'Botanical',
      totalSize: 20,
      patternTypeCounts: counts,
      colorwayCount: 3,
      targetMarketplace: 'etsy',
      targetProducts: ['fabric', 'homeDecor'],
      now: 1000,
    });
    const completeness = computeCollectionCompleteness(plan);
    const balance = computeCollectionBalance(plan);
    const diversity = computeCollectionDiversity(plan, brief, []);
    const qa = computeCommercialQA(brief, plan, completeness, balance, diversity);

    expect(qa.components).toHaveLength(9);
    expect(qa.components.map((c) => c.dimension)).toContain('Commercial Readiness');
    const withoutOverall = qa.components.filter((c) => c.dimension !== 'Commercial Readiness');
    const expectedOverall = Math.round(withoutOverall.reduce((s, c) => s + c.score, 0) / withoutOverall.length);
    expect(qa.overall).toBe(expectedOverall);

    const marketplaceFit = qa.components.find((c) => c.dimension === 'Marketplace Fit')!;
    expect(marketplaceFit.score).toBe(90);
  });

  it('scores marketplace fit lower for an unrecognized marketplace', () => {
    const counts = defaultPatternTypeRatios(20);
    const brief = createCreativeBrief({ collectionName: 'X', theme: 'Botanical', targetMarketplace: 'not-a-real-marketplace', now: 1000 });
    const plan = createCollectionPlan({ briefId: brief.id, name: 'X', theme: 'Botanical', totalSize: 20, patternTypeCounts: counts, now: 1000 });
    const completeness = computeCollectionCompleteness(plan);
    const balance = computeCollectionBalance(plan);
    const diversity = computeCollectionDiversity(plan, brief, []);
    const qa = computeCommercialQA(brief, plan, completeness, balance, diversity);
    const marketplaceFit = qa.components.find((c) => c.dimension === 'Marketplace Fit')!;
    expect(marketplaceFit.score).toBeLessThan(90);
  });
});
