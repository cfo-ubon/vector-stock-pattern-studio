import { describe, it, expect } from 'vitest';
import { buildHeroOpportunity, estimateBeautyScoreForCategory, estimateAverageMinutesPerPattern, type HeroOpportunityInput } from './heroOpportunity';
import { createMarketOpportunity } from '../marketing/domain/marketOpportunity';
import { createPortfolioAsset } from '../catalog/domain/asset';
import { createAutonomousDesignRun, transitionAutonomousDesignRun } from '../autopilot/domain/autonomousDesignRun';
import { emptyAutopilotConstraints } from '../autopilot/domain/constraints';
import type { OpportunityScoreResult } from '../marketing/scoring/opportunityScoring';
import type { OfflineSnapshotResult } from '../marketing/snapshot/snapshotService';
import type { QualitySnapshot } from '../catalog/quality/qualitySnapshotStore';
import type { PortfolioAsset } from '../catalog/domain/types';

function fakeScore(overall: number): OpportunityScoreResult {
  return { components: [], overall, band: 'Test', confidence: 'high', missingDimensions: [], scoringProfileId: 'SCP-test' };
}

function makeOpportunity(overrides: Partial<Parameters<typeof createMarketOpportunity>[0]> = {}) {
  return createMarketOpportunity({
    snapshotId: 'SNAP-1',
    title: 'Luxury Botanical',
    theme: 'luxury botanical',
    niche: 'home decor',
    marketplace: 'Adobe Stock',
    score: fakeScore(88),
    evidenceRefs: [],
    now: 1000,
    ...overrides,
  });
}

const NO_OFFLINE: OfflineSnapshotResult = { snapshot: null, freshnessLabel: '', classification: 'NO_DATA', message: '' };

function baseHeroInput(overrides: Partial<HeroOpportunityInput> = {}): HeroOpportunityInput {
  return {
    opportunities: [],
    missions: [],
    seasonalEvents: [],
    portfolioAssets: [],
    qualitySnapshots: [],
    autonomousRuns: [],
    offline: NO_OFFLINE,
    requestedCount: 10,
    now: 100000,
    ...overrides,
  };
}

describe('buildHeroOpportunity', () => {
  it('picks the strongest real Market Opportunity, never a fabricated theme', () => {
    const hero = buildHeroOpportunity(baseHeroInput({ opportunities: [makeOpportunity()] }));
    expect(hero.theme).toBe('luxury botanical');
    expect(hero.marketplace).toBe('Adobe Stock');
    expect(hero.estimatedCommercialScore).toBe(88);
    expect(hero.stars).toBe(5);
  });

  it('falls back honestly (evergreen/portfolio-gap) with a null commercial score when there is no market evidence', () => {
    const hero = buildHeroOpportunity(baseHeroInput());
    expect(hero.estimatedCommercialScore).toBeNull();
  });

  it('shows an honest null beauty score when the Portfolio has no evaluated pattern in that category', () => {
    const hero = buildHeroOpportunity(baseHeroInput({ opportunities: [makeOpportunity()] }));
    expect(hero.estimatedBeautyScore).toBeNull();
  });

  it('shows an honest null production-time estimate when no Autopilot run has ever completed', () => {
    const hero = buildHeroOpportunity(baseHeroInput());
    expect(hero.estimatedProductionMinutes).toBeNull();
  });

  it('portfolio gap band reflects the real least-covered-category count', () => {
    const hero = buildHeroOpportunity(baseHeroInput());
    expect(hero.portfolioGap).toBe('HIGH');
    expect(hero.portfolioGapCount).toBe(0);
  });
});

describe('estimateBeautyScoreForCategory', () => {
  it('averages real QualitySnapshot beautyScore for matching-category assets only', () => {
    const asset1 = createPortfolioAsset({ displayName: 'A', originalFilename: 'a.svg', sourceFileReferences: [], previewReference: null, metadataReference: null, presetId: 'botanical' });
    const asset2 = createPortfolioAsset({ displayName: 'B', originalFilename: 'b.svg', sourceFileReferences: [], previewReference: null, metadataReference: null, presetId: 'geometric' });
    const snap1: QualitySnapshot = { snapshotId: 's1', assetId: asset1.assetId, productionAssetId: null, beautyScore: 80, commercialScore: 70, thumbnailScore: null, fragmented: false, deadSpace: false, decision: 'READY', generatorVersion: 'v1', createdAt: 0, schemaVersion: 1 };
    const snap2: QualitySnapshot = { ...snap1, snapshotId: 's2', assetId: asset2.assetId, beautyScore: 20 };
    const assets: PortfolioAsset[] = [asset1, asset2];
    expect(estimateBeautyScoreForCategory('botanical', assets, [snap1, snap2])).toBe(80);
  });

  it('returns null (not a fabricated number) when nothing has been evaluated for that category', () => {
    expect(estimateBeautyScoreForCategory('botanical', [], [])).toBeNull();
  });
});

describe('estimateAverageMinutesPerPattern', () => {
  it('derives real minutes-per-pattern from a run\'s own GENERATING -> COMPLETED history span', () => {
    let run = createAutonomousDesignRun({ mode: 'FULL_AUTOPILOT', requestedCount: 5, constraints: emptyAutopilotConstraints(), now: 0 });
    run = { ...run, designPlan: {} as never };
    run = transitionAutonomousDesignRun(run, 'PLAN_READY', 0);
    run = transitionAutonomousDesignRun(run, 'GENERATING', 0);
    run = transitionAutonomousDesignRun(run, 'COMPLETED', 5 * 60000); // 5 minutes for 5 items = 1 min/item
    run = { ...run, completedCount: 5 };
    expect(estimateAverageMinutesPerPattern([run])).toBe(1);
  });

  it('returns null when no run has completed', () => {
    expect(estimateAverageMinutesPerPattern([])).toBeNull();
  });
});
