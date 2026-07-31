import { describe, it, expect } from 'vitest';
import { prepareRunForGeneration } from './runPreparation';
import { createAutonomousDesignRun, transitionAutonomousDesignRun } from './domain/autonomousDesignRun';
import { emptyAutopilotConstraints } from './domain/constraints';
import type { DesignPlan } from './domain/designPlan';

function makePlan(overrides: Partial<DesignPlan> = {}): DesignPlan {
  return {
    summary: 'Test autopilot collection',
    decisions: [
      { key: 'theme', label: 'Theme', value: 'botanical florals', rationaleTh: 'x', rationaleEn: 'x', source: 'marketOpportunity', userLocked: false },
      { key: 'heroMotif', label: 'Hero Motif', value: 'Not Provided — generator will select a hero motif from the chosen category', rationaleTh: 'x', rationaleEn: 'x', source: 'generatorDefault', userLocked: false },
      { key: 'composition', label: 'Composition', value: 'Auto (per collection role)', rationaleTh: 'x', rationaleEn: 'x', source: 'generatorDefault', userLocked: false },
      { key: 'palette', label: 'Palette', value: 'Auto (category default palette)', rationaleTh: 'x', rationaleEn: 'x', source: 'generatorDefault', userLocked: false },
    ],
    marketEvidence: ['obs:OBS-1'],
    portfolioReason: '',
    targetMarketplace: 'Etsy',
    targetCustomer: 'gift buyers',
    targetProducts: ['giftWrap'],
    collectionStructure: [
      { role: 'hero', count: 1 },
      { role: 'secondary', count: 1 },
    ],
    visualDirection: '',
    paletteDirection: '',
    estimatedProductionEffort: '',
    risks: [],
    confidence: 'high',
    dataFreshness: 'Live within this session',
    offline: false,
    ...overrides,
  };
}

function makeReadyRun(plan: DesignPlan | null = makePlan()) {
  let run = createAutonomousDesignRun({
    mode: 'FULL_AUTOPILOT',
    requestedCount: 2,
    sourceEvidence: { marketOpportunityId: 'MO-1', dailyMissionId: null, marketSnapshotId: 'SNAP-1' },
    constraints: emptyAutopilotConstraints(),
    now: 1000,
  });
  run = { ...run, designPlan: plan };
  if (plan) run = transitionAutonomousDesignRun(run, 'PLAN_READY', 1000);
  return run;
}

describe('prepareRunForGeneration', () => {
  it('builds a real, linked MarketingDesignHandoff -> CreativeBrief -> CollectionPlan chain and transitions the run to GENERATING', () => {
    const run = makeReadyRun();
    const prepared = prepareRunForGeneration(run, 2000);

    expect(prepared.brief.theme).toBe('botanical florals');
    expect(prepared.brief.sourceOpportunityId).toBe('MO-1');
    expect(prepared.collectionPlan.briefId).toBe(prepared.brief.id);
    expect(prepared.collectionPlan.totalSize).toBe(2);
    expect(prepared.collectionPlan.patternTypeCounts.hero).toBe(1);
    expect(prepared.collectionPlan.patternTypeCounts.secondary).toBe(1);
    expect(prepared.marketingHandoff.creativeBriefId).toBe(prepared.brief.id);
    expect(prepared.marketingHandoff.collectionPlanId).toBe(prepared.collectionPlan.id);
    expect(prepared.marketingHandoff.marketSnapshotId).toBe('SNAP-1');
    expect(prepared.marketingHandoff.marketOpportunityId).toBe('MO-1');

    expect(prepared.run.status).toBe('GENERATING');
    expect(prepared.run.marketingDesignHandoffId).toBe(prepared.marketingHandoff.id);
    expect(prepared.run.creativeBriefId).toBe(prepared.brief.id);
    expect(prepared.run.collectionPlanId).toBe(prepared.collectionPlan.id);
  });

  it('never fabricates a hero motif/composition/palette when the plan honestly has none', () => {
    const run = makeReadyRun();
    const prepared = prepareRunForGeneration(run, 2000);
    expect(prepared.brief.heroStyle).toBe('');
    expect(prepared.marketingHandoff.heroMotif).toBeNull();
    expect(prepared.marketingHandoff.composition).toBeNull();
    expect(prepared.marketingHandoff.palette).toEqual([]);
  });

  it('carries a real hero motif/composition/hex palette through when the plan has them', () => {
    const plan = makePlan({
      decisions: [
        { key: 'theme', label: 'Theme', value: 'botanical florals', rationaleTh: 'x', rationaleEn: 'x', source: 'marketOpportunity', userLocked: false },
        { key: 'heroMotif', label: 'Hero Motif', value: 'Tulip bouquet', rationaleTh: 'x', rationaleEn: 'x', source: 'dailyMission', userLocked: false },
        { key: 'composition', label: 'Composition', value: 'balanced-toss', rationaleTh: 'x', rationaleEn: 'x', source: 'dailyMission', userLocked: false },
        { key: 'palette', label: 'Palette', value: '#ffffff, #ffb6c1', rationaleTh: 'x', rationaleEn: 'x', source: 'dailyMission', userLocked: false },
      ],
    });
    const run = makeReadyRun(plan);
    const prepared = prepareRunForGeneration(run, 2000);
    expect(prepared.brief.heroStyle).toBe('Tulip bouquet');
    expect(prepared.marketingHandoff.heroMotif).toBe('Tulip bouquet');
    expect(prepared.marketingHandoff.composition).toBe('balanced-toss');
    expect(prepared.marketingHandoff.palette).toEqual(['#ffffff', '#ffb6c1']);
  });

  it('throws for a run with no frozen Design Plan rather than silently preparing an unapproved one', () => {
    const run = makeReadyRun(null);
    expect(() => prepareRunForGeneration(run)).toThrow(/frozen Design Plan/);
  });

  it('throws for a run not in PLAN_READY status', () => {
    const run = createAutonomousDesignRun({ mode: 'FULL_AUTOPILOT', requestedCount: 2, constraints: emptyAutopilotConstraints(), now: 1000 });
    const runWithPlan = { ...run, designPlan: makePlan() };
    expect(() => prepareRunForGeneration(runWithPlan)).toThrow(/PLAN_READY/);
  });

  it('is never called twice for the same run in practice — a second call on an already-GENERATING run throws', () => {
    const run = makeReadyRun();
    const prepared = prepareRunForGeneration(run, 2000);
    expect(() => prepareRunForGeneration(prepared.run, 3000)).toThrow(/PLAN_READY/);
  });
});
