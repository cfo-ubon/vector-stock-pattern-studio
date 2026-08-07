import { describe, it, expect } from 'vitest';
import { buildAiCeoBrief, type BuildAiCeoBriefInput } from './morningBrief';
import { findContinueYesterdayAction } from './continueYesterday';
import { rankAiCeoRecommendations } from './decisionEngine';
import { createMarketOpportunity } from '../marketing/domain/marketOpportunity';
import { createPortfolioAsset } from '../catalog/domain/asset';
import { createAutonomousDesignRun, transitionAutonomousDesignRun } from '../autopilot/domain/autonomousDesignRun';
import { buildDashboardSnapshot } from '../catalog/dashboard/dashboardSnapshot';
import type { DashboardSnapshot } from '../catalog/dashboard/dashboardSnapshot';
import type { OpportunityScoreResult } from '../marketing/scoring/opportunityScoring';
import type { EvidenceBand } from '../marketing/domain/evidence';
import type { OfflineSnapshotResult } from '../marketing/snapshot/snapshotService';
import type { AiCeoBrief } from './domain/types';

function fakeScore(overall: number, confidence: EvidenceBand): OpportunityScoreResult {
  return { components: [], overall, band: 'Test Band', confidence, missingDimensions: [], scoringProfileId: 'SCP-test' };
}

const NO_OFFLINE_DATA: OfflineSnapshotResult = { snapshot: null, freshnessLabel: '', classification: 'NO_DATA', message: 'no data' };
const EMPTY_DASHBOARD: DashboardSnapshot = buildDashboardSnapshot({ collections: [], assets: [], submissions: [], now: 1000 });

function baseInput(overrides: Partial<BuildAiCeoBriefInput> = {}): BuildAiCeoBriefInput {
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
    previousBrief: undefined,
    ...overrides,
  };
}

describe('buildAiCeoBrief — every one of the spec\'s 14 required sections is present', () => {
  it('a fresh install produces a real, honest Brief with no fabricated numbers', () => {
    const brief = buildAiCeoBrief(baseInput());
    expect(['Good morning!', 'Good afternoon!', 'Good evening!']).toContain(brief.greeting);
    expect(brief.dateLabel).toBe('1970-01-01');
    expect(brief.dataStatus).toBe('INSUFFICIENT_DATA');
    expect(brief.yesterdaySummary).toBeNull();
    expect(brief.topRecommendation).toBeDefined();
    expect(Array.isArray(brief.alternativeRecommendations)).toBe(true);
    expect(brief.portfolioImpact).toBeTruthy();
    expect(brief.productionSizeRecommendation).toBeTruthy();
    expect(brief.confidence).toBe('unknown');
    expect(brief.freshnessLabel).toBeTruthy();
    expect(brief.missingInformation.length).toBeGreaterThan(0);
    expect(brief.explanation.why.length).toBeGreaterThan(0);
    expect(brief.explanation.missingData.length).toBeGreaterThan(0);
  });

  it('with a real prior Brief, produces a real yesterdaySummary (never fabricated)', () => {
    const previousBrief = { id: 'BRIEF-1', createdAt: 1000 } as AiCeoBrief;
    const asset = createPortfolioAsset({ displayName: 'A', originalFilename: 'a.svg', sourceFileReferences: [], previewReference: null, metadataReference: null, presetId: 'botanical' });
    const assetSince = { ...asset, createdAt: 2000 };
    const brief = buildAiCeoBrief(baseInput({ previousBrief, portfolioAssets: [assetSince], now: 5000 }));
    expect(brief.yesterdaySummary).toContain('1 new Portfolio item');
  });

  it('a real Market Opportunity produces a non-empty primaryAction hand-off the user can start Autopilot from', () => {
    const strong = createMarketOpportunity({
      snapshotId: 'SNAP-20260101-AAAAAA',
      title: 'Strong',
      theme: 'botanical florals',
      niche: 'home decor',
      marketplace: 'Etsy',
      score: fakeScore(90, 'high'),
      evidenceRefs: [],
      now: 1000,
    });
    const brief = buildAiCeoBrief(baseInput({ opportunities: [strong] }));
    expect(brief.primaryAction).not.toBeNull();
    expect(brief.primaryAction?.mode).toBe('FULL_AUTOPILOT');
  });
});

describe('findContinueYesterdayAction (Module 11)', () => {
  it('returns null when there is genuinely nothing unfinished', () => {
    const recs = rankAiCeoRecommendations(baseInput());
    // With zero portfolio/market data the only recommendation is the evergreen fallback, not "unfinished work".
    expect(findContinueYesterdayAction(recs)).toBeNull();
  });

  it('surfaces a real interrupted-run continuation over the market-driven recommendation', () => {
    let run = createAutonomousDesignRun({ mode: 'FULL_AUTOPILOT', requestedCount: 10, now: 1 });
    run = transitionAutonomousDesignRun(run, 'PLAN_READY', 2);
    run = transitionAutonomousDesignRun(run, 'GENERATING', 3);
    const recs = rankAiCeoRecommendations(baseInput({ autonomousRuns: [run] }));
    const action = findContinueYesterdayAction(recs);
    expect(action?.action).toBe('CONTINUE_INTERRUPTED_RUN');
    expect(action?.navigateTarget).toBe('autopilotHistory');
  });
});
