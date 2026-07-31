import { describe, it, expect } from 'vitest';
import { getDesignPlanDecision } from './designPlan';
import type { DesignPlan } from './designPlan';

function makePlan(): DesignPlan {
  return {
    summary: 'Test',
    decisions: [{ key: 'theme', label: 'Theme', value: 'botanical', rationaleTh: 'x', rationaleEn: 'x', source: 'marketOpportunity', userLocked: false }],
    marketEvidence: [],
    portfolioReason: '',
    targetMarketplace: 'Etsy',
    targetCustomer: 'Not Provided',
    targetProducts: [],
    collectionStructure: [],
    visualDirection: '',
    paletteDirection: '',
    estimatedProductionEffort: '',
    risks: [],
    confidence: 'unknown',
    dataFreshness: '',
    offline: true,
  };
}

describe('getDesignPlanDecision', () => {
  it('finds a decision by key', () => {
    const plan = makePlan();
    expect(getDesignPlanDecision(plan, 'theme')?.value).toBe('botanical');
  });

  it('returns undefined for a missing key rather than throwing', () => {
    const plan = makePlan();
    expect(getDesignPlanDecision(plan, 'nonexistent')).toBeUndefined();
  });
});
