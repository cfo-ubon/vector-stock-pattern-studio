import { describe, it, expect } from 'vitest';
import { buildAutonomousDesignPlan, leastCoveredCategory, type DecisionEngineInput } from './decisionEngine';
import { createMarketOpportunity } from '../marketing/domain/marketOpportunity';
import { createDailyMission } from '../marketing/domain/dailyMission';
import { createSeasonalEvent } from '../marketing/domain/seasonalEvent';
import { createPortfolioAsset } from '../catalog/domain/asset';
import { emptyAutopilotConstraints } from './domain/constraints';
import type { OpportunityScoreResult } from '../marketing/scoring/opportunityScoring';
import type { EvidenceBand } from '../marketing/domain/evidence';
import type { OfflineSnapshotResult } from '../marketing/snapshot/snapshotService';

function fakeScore(overall: number, confidence: EvidenceBand): OpportunityScoreResult {
  return { components: [], overall, band: 'Test Band', confidence, missingDimensions: [], scoringProfileId: 'SCP-test' };
}

function makeOpportunity(overrides: Partial<Parameters<typeof createMarketOpportunity>[0]> = {}) {
  return createMarketOpportunity({
    snapshotId: 'SNAP-20260101-AAAAAA',
    title: 'Spring Florals Opportunity',
    theme: 'spring florals',
    niche: 'home decor',
    marketplace: 'Etsy',
    score: fakeScore(78, 'high'),
    evidenceRefs: ['obs:OBS-1'],
    now: 1000,
    ...overrides,
  });
}

const NO_OFFLINE_DATA: OfflineSnapshotResult = { snapshot: null, freshnessLabel: '', classification: 'NO_DATA', message: 'no data' };
const LIVE_SNAPSHOT_DATA: OfflineSnapshotResult = {
  snapshot: { id: 'SNAP-20260101-AAAAAA' } as OfflineSnapshotResult['snapshot'],
  freshnessLabel: 'Same day',
  classification: 'SAVED_SNAPSHOT',
  message: 'ok',
};

function baseInput(overrides: Partial<DecisionEngineInput> = {}): DecisionEngineInput {
  return {
    mode: 'FULL_AUTOPILOT',
    requestedCount: 10,
    colorwayCount: 3,
    marketplacePreference: null,
    productionGoal: 'auto',
    constraints: emptyAutopilotConstraints(),
    opportunities: [],
    missions: [],
    seasonalEvents: [],
    portfolioAssets: [],
    offline: NO_OFFLINE_DATA,
    now: 100000,
    ...overrides,
  };
}

describe('buildAutonomousDesignPlan — FULL_AUTOPILOT (Scenario A)', () => {
  it('selects the highest-scoring real Market Opportunity and resolves every field with no manual selection required', () => {
    const weak = makeOpportunity({ title: 'Weak', theme: 'geometric tiles', score: fakeScore(40, 'low'), now: 1 });
    const strong = makeOpportunity({ title: 'Strong', theme: 'botanical florals', score: fakeScore(90, 'high'), now: 2 });
    const plan = buildAutonomousDesignPlan(baseInput({ opportunities: [weak, strong], offline: LIVE_SNAPSHOT_DATA }));

    expect(plan.summary).toContain('botanical');
    expect(plan.decisions.find((d) => d.key === 'theme')?.value).toBe('botanical florals');
    expect(plan.decisions.every((d) => d.rationaleTh.length > 0 && d.rationaleEn.length > 0)).toBe(true);
    expect(plan.collectionStructure.length).toBeGreaterThan(0);
    expect(plan.offline).toBe(false);
    expect(plan.confidence).toBe('high');
  });

  it('never selects an unsupported generator category', () => {
    const opp = makeOpportunity({ theme: 'completely made up nonsense keyword' });
    const plan = buildAutonomousDesignPlan(baseInput({ opportunities: [opp] }));
    const category = plan.decisions.find((d) => d.key === 'categoryId')!;
    expect(category.value).toBe('botanical'); // honest fallback, not a fabricated category
  });

  it('respects excludeCategoryIds by skipping an opportunity whose inferred category is excluded', () => {
    const botanical = makeOpportunity({ title: 'Botanical', theme: 'botanical florals', score: fakeScore(95, 'high'), now: 1 });
    const geometric = makeOpportunity({ title: 'Geometric', theme: 'geometric abstract', score: fakeScore(50, 'medium'), now: 2 });
    const constraints = { ...emptyAutopilotConstraints(), excludeCategoryIds: ['botanical'] };
    const plan = buildAutonomousDesignPlan(baseInput({ opportunities: [botanical, geometric], constraints }));
    expect(plan.decisions.find((d) => d.key === 'categoryId')?.value).toBe('geometric');
  });
});

describe('buildAutonomousDesignPlan — TODAYS_MISSION', () => {
  it('uses the latest Daily Mission as evidence, carrying its real hero motif/composition/palette', () => {
    const opportunity = makeOpportunity({ now: 1 });
    const mission = createDailyMission({
      date: 2000,
      opportunityId: opportunity.id,
      primaryMarketplace: 'Etsy',
      niche: 'home decor',
      theme: 'spring florals',
      category: 'botanical',
      heroMotif: 'Tulip bouquet',
      opportunityScore: 78,
      confidence: 'high',
      evidenceFreshness: '2 days old',
      composition: 'balanced-toss',
      colorDirection: ['#ffffff', '#ffb6c1'],
      buyerGroup: 'gift buyers',
      productUseCases: ['giftWrap'],
      submissionTiming: 'Q2',
    });
    const plan = buildAutonomousDesignPlan(baseInput({ mode: 'TODAYS_MISSION', opportunities: [opportunity], missions: [mission] }));
    expect(plan.decisions.find((d) => d.key === 'heroMotif')?.value).toBe('Tulip bouquet');
    expect(plan.decisions.find((d) => d.key === 'composition')?.value).toBe('balanced-toss');
    expect(plan.targetCustomer).toBe('gift buyers');
    expect(plan.targetProducts).toEqual(['giftWrap']);
  });
});

describe('buildAutonomousDesignPlan — PORTFOLIO_GAP (Scenario, offline-safe)', () => {
  it('picks the category with the fewest existing Portfolio assets and marks the plan offline', () => {
    const heavyBotanical = Array.from({ length: 5 }, (_, i) =>
      createPortfolioAsset({ displayName: `Botanical ${i}`, originalFilename: `b${i}.svg`, sourceFileReferences: [], previewReference: null, metadataReference: null, presetId: 'botanical' }),
    );
    const plan = buildAutonomousDesignPlan(baseInput({ mode: 'PORTFOLIO_GAP', portfolioAssets: heavyBotanical }));
    expect(plan.decisions.find((d) => d.key === 'categoryId')?.value).not.toBe('botanical');
    expect(plan.offline).toBe(true);
    expect(plan.marketEvidence).toEqual([]);
  });
});

describe('buildAutonomousDesignPlan — EVERGREEN_COMMERCIAL (Scenario C, no market data)', () => {
  it('never claims live market evidence when none exists', () => {
    const plan = buildAutonomousDesignPlan(baseInput({ mode: 'EVERGREEN_COMMERCIAL' }));
    expect(plan.offline).toBe(true);
    expect(plan.marketEvidence).toEqual([]);
    expect(plan.dataFreshness).toBe('No saved Market Snapshot available');
  });
});

describe('buildAutonomousDesignPlan — SEASONAL_OPPORTUNITY', () => {
  it('selects the nearest upcoming seasonal event as evidence', () => {
    const soon = createSeasonalEvent({ eventName: 'Valentines Day', eventDate: 200000, now: 100000, designLeadDays: 30, demandWindowDays: 200000 });
    const far = createSeasonalEvent({ eventName: 'Christmas', eventDate: 900000, now: 100000, designLeadDays: 30, demandWindowDays: 900000 });
    const plan = buildAutonomousDesignPlan(baseInput({ mode: 'SEASONAL_OPPORTUNITY', seasonalEvents: [soon, far], now: 100000 }));
    expect(plan.decisions.find((d) => d.key === 'theme')?.value).toBe('Valentines Day');
    expect(plan.offline).toBe(false);
  });

  it('falls back to an evergreen default when no seasonal event is upcoming', () => {
    const plan = buildAutonomousDesignPlan(baseInput({ mode: 'SEASONAL_OPPORTUNITY', seasonalEvents: [] }));
    expect(plan.offline).toBe(true);
  });
});

describe('buildAutonomousDesignPlan — CUSTOM_GOAL (Scenario B)', () => {
  it('translates the spec\'s own Thai example sentence into theme/marketplace/count', () => {
    const plan = buildAutonomousDesignPlan(
      baseInput({ mode: 'CUSTOM_GOAL', userInstruction: 'สร้าง Luxury Botanical สำหรับ Adobe Stock จำนวน 20 ลาย', requestedCount: 20 }),
    );
    expect(plan.targetMarketplace).toBe('Adobe Stock');
    expect(plan.decisions.find((d) => d.key === 'categoryId')?.value).toBe('botanical');
  });
});

describe('buildAutonomousDesignPlan — Guided Autopilot constraints', () => {
  it('a locked marketplace preference is reflected as userLocked with source userConstraint', () => {
    const opp = makeOpportunity();
    const constraints = { ...emptyAutopilotConstraints(), preferredMarketplace: 'Shutterstock' };
    const plan = buildAutonomousDesignPlan(baseInput({ mode: 'GUIDED_AUTOPILOT', opportunities: [opp], constraints }));
    const marketplaceDecision = plan.decisions.find((d) => d.key === 'marketplace')!;
    expect(marketplaceDecision.value).toBe('Shutterstock');
    expect(marketplaceDecision.userLocked).toBe(true);
    expect(marketplaceDecision.source).toBe('userConstraint');
  });

  it('a required product target is honored even without Daily Mission evidence', () => {
    const opp = makeOpportunity();
    const constraints = { ...emptyAutopilotConstraints(), requiredProductTargets: ['wallpaper'] };
    const plan = buildAutonomousDesignPlan(baseInput({ opportunities: [opp], constraints }));
    expect(plan.targetProducts).toEqual(['wallpaper']);
  });
});

describe('buildAutonomousDesignPlan — no active opportunities at all', () => {
  it('honestly falls back to an evergreen default rather than fabricating a Market Opportunity', () => {
    const plan = buildAutonomousDesignPlan(baseInput({ opportunities: [] }));
    expect(plan.offline).toBe(true);
    expect(plan.marketEvidence).toEqual([]);
  });
});

describe('leastCoveredCategory (Build 030, exported for Mission Control\'s Portfolio Gap reading)', () => {
  it('returns a supported category with count 0 when the Portfolio is empty', () => {
    const { count } = leastCoveredCategory([], emptyAutopilotConstraints());
    expect(count).toBe(0);
  });

  it('picks the real minimum-count category from real Portfolio assets, never a fabricated one', () => {
    const asset = createPortfolioAsset({ displayName: 'A', originalFilename: 'a.svg', sourceFileReferences: [], previewReference: null, metadataReference: null, presetId: 'botanical' });
    const { categoryId, count } = leastCoveredCategory([asset], emptyAutopilotConstraints());
    expect(categoryId).not.toBe('botanical');
    expect(count).toBe(0);
  });
});
