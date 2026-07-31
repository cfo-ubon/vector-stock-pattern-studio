import { describe, it, expect } from 'vitest';
import { buildAutonomousGeneratorHandoff } from './roleGeneratorHandoff';
import { createCollectionPlan, getCollectionPlanItems } from '../design-director/domain/collectionPlan';
import type { DesignPlan } from './domain/designPlan';

function makePlan(overrides: Partial<DesignPlan> = {}): DesignPlan {
  return {
    summary: 'Test summary',
    decisions: [
      { key: 'categoryId', label: 'Category', value: 'botanical', rationaleTh: 'x', rationaleEn: 'x', source: 'marketOpportunity', userLocked: false },
      { key: 'heroMotif', label: 'Hero Motif', value: 'Not Provided — generator will select a hero motif from the chosen category', rationaleTh: 'x', rationaleEn: 'x', source: 'generatorDefault', userLocked: false },
      { key: 'palette', label: 'Palette', value: 'Auto (category default palette)', rationaleTh: 'x', rationaleEn: 'x', source: 'generatorDefault', userLocked: false },
    ],
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
    ...overrides,
  };
}

describe('buildAutonomousGeneratorHandoff', () => {
  it('builds a real GeneratorHandoff per item, varying composition/density/scale by role', () => {
    const plan = createCollectionPlan({
      briefId: 'BRF-1',
      name: 'Test Plan',
      theme: 'botanical',
      totalSize: 20,
      patternTypeCounts: { hero: 2, secondary: 4, blender: 4, stripe: 2, border: 2, coordinate: 4, miniPattern: 1, texture: 1 },
      now: 1000,
    });
    const items = getCollectionPlanItems(plan);
    const heroItem = items.find((i) => i.patternType === 'hero')!;
    const blenderItem = items.find((i) => i.patternType === 'blender')!;
    const designPlan = makePlan();

    const heroHandoff = buildAutonomousGeneratorHandoff('BRF-1', plan.id, heroItem, designPlan);
    const blenderHandoff = buildAutonomousGeneratorHandoff('BRF-1', plan.id, blenderItem, designPlan);

    expect(heroHandoff.collectionItemId).toBe(heroItem.id);
    expect(heroHandoff.patternType).toBe('hero');
    expect(blenderHandoff.patternType).toBe('blender');
    expect(heroHandoff.composition).not.toBe(blenderHandoff.composition);
    expect(heroHandoff.density).not.toBe(blenderHandoff.density);
    expect(heroHandoff.categoryId).toBe('botanical');
  });

  it('never fabricates a hero motif when the plan has none — falls back to the plan summary honestly', () => {
    const plan = createCollectionPlan({
      briefId: 'BRF-1',
      name: 'Test Plan',
      theme: 'botanical',
      totalSize: 1,
      patternTypeCounts: { hero: 1, secondary: 0, blender: 0, stripe: 0, border: 0, coordinate: 0, miniPattern: 0, texture: 0 },
      now: 1000,
    });
    const item = getCollectionPlanItems(plan)[0];
    const designPlan = makePlan();
    const handoff = buildAutonomousGeneratorHandoff('BRF-1', plan.id, item, designPlan);
    expect(handoff.heroMotif).toBe(designPlan.summary);
  });
});
