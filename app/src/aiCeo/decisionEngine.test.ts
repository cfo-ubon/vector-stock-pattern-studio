import { describe, it, expect } from 'vitest';
import { rankAiCeoRecommendations, topAiCeoRecommendation, type AiCeoDecisionInput } from './decisionEngine';
import { createMarketOpportunity } from '../marketing/domain/marketOpportunity';
import { createPortfolioAsset } from '../catalog/domain/asset';
import { createAutonomousDesignRun, transitionAutonomousDesignRun } from '../autopilot/domain/autonomousDesignRun';
import { buildDashboardSnapshot } from '../catalog/dashboard/dashboardSnapshot';
import type { DashboardSnapshot } from '../catalog/dashboard/dashboardSnapshot';
import type { OpportunityScoreResult } from '../marketing/scoring/opportunityScoring';
import type { EvidenceBand } from '../marketing/domain/evidence';
import type { OfflineSnapshotResult } from '../marketing/snapshot/snapshotService';
import type { AiMemory } from './domain/types';

function fakeScore(overall: number, confidence: EvidenceBand): OpportunityScoreResult {
  return { components: [], overall, band: 'Test Band', confidence, missingDimensions: [], scoringProfileId: 'SCP-test' };
}

const NO_OFFLINE_DATA: OfflineSnapshotResult = { snapshot: null, freshnessLabel: '', classification: 'NO_DATA', message: 'no data' };
const LIVE_SNAPSHOT_DATA: OfflineSnapshotResult = {
  snapshot: { id: 'SNAP-20260101-AAAAAA' } as OfflineSnapshotResult['snapshot'],
  freshnessLabel: 'Same day',
  classification: 'SAVED_SNAPSHOT',
  message: 'ok',
};
const EMPTY_DASHBOARD: DashboardSnapshot = buildDashboardSnapshot({ collections: [], assets: [], submissions: [], now: 1000 });

function baseInput(overrides: Partial<AiCeoDecisionInput> = {}): AiCeoDecisionInput {
  return {
    opportunities: [],
    missions: [],
    seasonalEvents: [],
    portfolioAssets: [],
    autonomousRuns: [],
    dashboard: EMPTY_DASHBOARD,
    offline: NO_OFFLINE_DATA,
    confirmedMemories: [],
    requestedCount: 10,
    now: 100000,
    ...overrides,
  };
}

function memory(overrides: Partial<AiMemory> = {}): AiMemory {
  return { id: 'MEM-1', type: 'PREFERRED_MARKETPLACE', value: 'Etsy', status: 'CONFIRMED', sourceCandidateId: null, confirmedAt: 1, updatedAt: 1, schemaVersion: 1, ...overrides };
}

describe('rankAiCeoRecommendations — never fabricates evidence', () => {
  it('with zero real data anywhere, still returns a real recommendation with INSUFFICIENT_DATA honesty label', () => {
    const recs = rankAiCeoRecommendations(baseInput());
    expect(recs.length).toBeGreaterThan(0);
    const top = topAiCeoRecommendation(recs);
    expect(top.action).toBe('USE_EVERGREEN_FALLBACK');
    expect(top.dataFreshness).toBe('INSUFFICIENT_DATA');
    expect(top.risks.length).toBeGreaterThan(0);
  });

  it('picks the highest-scoring real Market Opportunity as CREATE_NEW_COLLECTION with LIVE_DATA freshness', () => {
    const strong = createMarketOpportunity({
      snapshotId: 'SNAP-20260101-AAAAAA',
      title: 'Strong',
      theme: 'botanical florals',
      niche: 'home decor',
      marketplace: 'Etsy',
      score: fakeScore(90, 'high'),
      evidenceRefs: ['obs:OBS-1'],
      now: 1000,
    });
    const recs = rankAiCeoRecommendations(baseInput({ opportunities: [strong], offline: LIVE_SNAPSHOT_DATA }));
    const top = topAiCeoRecommendation(recs);
    expect(top.action).toBe('CREATE_NEW_COLLECTION');
    expect(top.dataFreshness).toBe('LIVE_DATA');
    expect(top.evidenceRefs).toContain('obs:OBS-1');
    expect(top.autopilotAction).toEqual({ mode: 'FULL_AUTOPILOT', requestedCount: 10, marketplace: null, productionGoal: 'auto' });
  });

  it('falls back to a real Portfolio-gap DIVERSIFY_PORTFOLIO pick when the Portfolio has real assets but no market evidence', () => {
    const asset = createPortfolioAsset({ displayName: 'A', originalFilename: 'a.svg', sourceFileReferences: [], previewReference: null, metadataReference: null, presetId: 'botanical' });
    const recs = rankAiCeoRecommendations(baseInput({ portfolioAssets: [asset] }));
    const top = topAiCeoRecommendation(recs);
    expect(top.action).toBe('DIVERSIFY_PORTFOLIO');
    expect(top.dataFreshness).toBe('LOCAL_PORTFOLIO_ANALYSIS');
    expect(top.reason).not.toBe('');
  });
});

describe('rankAiCeoRecommendations — urgency ranking', () => {
  it('ranks an interrupted (GENERATING) run above every other recommendation', () => {
    let run = createAutonomousDesignRun({ mode: 'FULL_AUTOPILOT', requestedCount: 10, now: 1 });
    run = transitionAutonomousDesignRun(run, 'PLAN_READY', 2);
    run = transitionAutonomousDesignRun(run, 'GENERATING', 3);
    const recs = rankAiCeoRecommendations(baseInput({ autonomousRuns: [run] }));
    expect(topAiCeoRecommendation(recs).action).toBe('CONTINUE_INTERRUPTED_RUN');
    expect(topAiCeoRecommendation(recs).navigateTarget).toBe('autopilotHistory');
  });

  it('ranks real un-imported READY items above a fresh market-driven recommendation', () => {
    let run = createAutonomousDesignRun({ mode: 'FULL_AUTOPILOT', requestedCount: 1, now: 1 });
    run = transitionAutonomousDesignRun(run, 'PLAN_READY', 2);
    run = transitionAutonomousDesignRun(run, 'GENERATING', 3);
    run = transitionAutonomousDesignRun(run, 'COMPLETED', 4);
    run = { ...run, items: [{ collectionItemId: 'CI-1', generatorHandoffId: null, portfolioAssetId: null, qualitySnapshotId: null, decision: 'READY', repairAttempts: 0, error: null, completedAt: 4 }] };
    const recs = rankAiCeoRecommendations(baseInput({ autonomousRuns: [run] }));
    expect(topAiCeoRecommendation(recs).action).toBe('MOVE_READY_TO_PORTFOLIO');
  });
});

describe('rankAiCeoRecommendations — Module 8 confirmed memory transparency', () => {
  it('a CONFIRMED preferred-marketplace memory overrides the picked marketplace and is disclosed in memoryInfluence', () => {
    const strong = createMarketOpportunity({
      snapshotId: 'SNAP-20260101-AAAAAA',
      title: 'Strong',
      theme: 'botanical florals',
      niche: 'home decor',
      marketplace: 'Shutterstock',
      score: fakeScore(90, 'high'),
      evidenceRefs: [],
      now: 1000,
    });
    const recs = rankAiCeoRecommendations(baseInput({ opportunities: [strong], confirmedMemories: [memory({ value: 'Etsy' })] }));
    const top = topAiCeoRecommendation(recs);
    expect(top.autopilotAction?.marketplace).toBe('Etsy');
    expect(top.memoryInfluence.some((m) => m.includes('Etsy'))).toBe(true);
    expect(top.memoryInfluence[0]).toContain('Based on your confirmed preference');
  });

  it('a SUGGESTED-only memory (never confirmed) never appears in confirmedMemories input and cannot influence anything', () => {
    // Module 8's structural guarantee is enforced by the storage layer
    // (`aiMemoryStore.ts`'s `loadConfirmedAiMemories` never returns a
    // SUGGESTED candidate) — this test documents the Decision Engine side:
    // an empty confirmedMemories array produces zero memoryInfluence.
    const recs = rankAiCeoRecommendations(baseInput({ confirmedMemories: [] }));
    expect(topAiCeoRecommendation(recs).memoryInfluence).toEqual([]);
  });
});

describe('rankAiCeoRecommendations — real Portfolio-health hygiene items', () => {
  it('surfaces a real REVIEW_REJECTED_ITEMS recommendation from the Dashboard Snapshot, never fabricated', () => {
    const dashboardWithRejected: DashboardSnapshot = {
      ...EMPTY_DASHBOARD,
      recommendations: [{ code: 'review-rejected', priority: 'high', message: '2 submission(s) were rejected — review the marketplace\'s feedback and resubmit.', relatedCount: 2 }],
    };
    const recs = rankAiCeoRecommendations(baseInput({ dashboard: dashboardWithRejected }));
    const reviewRec = recs.find((r) => r.action === 'REVIEW_REJECTED_ITEMS');
    expect(reviewRec).toBeDefined();
    expect(reviewRec?.reason).toContain('2 submission(s) were rejected');
    expect(reviewRec?.navigateTarget).toBe('portfolio');
  });
});
