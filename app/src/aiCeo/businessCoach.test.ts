import { describe, it, expect } from 'vitest';
import { buildBusinessCoach, type BuildBusinessCoachInput } from './businessCoach';
import { createPortfolioAsset } from '../catalog/domain/asset';
import { createAutonomousDesignRun, transitionAutonomousDesignRun } from '../autopilot/domain/autonomousDesignRun';
import { buildDashboardSnapshot } from '../catalog/dashboard/dashboardSnapshot';
import type { OfflineSnapshotResult } from '../marketing/snapshot/snapshotService';
import type { BusinessStatus } from '../missionControl/businessStatus';

const NO_OFFLINE_DATA: OfflineSnapshotResult = { snapshot: null, freshnessLabel: '', classification: 'NO_DATA', message: 'no data' };
const EMPTY_DASHBOARD = buildDashboardSnapshot({ collections: [], assets: [], submissions: [], now: 1000 });
const EMPTY_STATUS: BusinessStatus = {
  portfolioHealthScore: 0,
  submissionQueue: { ready: 0, pendingReview: 0, pendingUpload: 0 },
  monthlyProgress: { patternsThisMonth: 0 },
  commercialReadiness: 0,
  generatedAt: 1000,
};

function baseInput(overrides: Partial<BuildBusinessCoachInput> = {}): BuildBusinessCoachInput {
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
    businessStatus: EMPTY_STATUS,
    ...overrides,
  };
}

describe('buildBusinessCoach — all 8 required cards, honest empty states', () => {
  it('a fresh install renders every required card with an honest empty-state value, never a fabricated number', () => {
    const run = buildBusinessCoach(baseInput());
    const codes = run.cards.map((c) => c.code);
    expect(codes).toEqual(['todays-focus', 'quick-win', 'blocker', 'unfinished-work', 'next-action', 'weekly-progress', 'portfolio-growth', 'submission-readiness']);
    expect(run.cards.find((c) => c.code === 'quick-win')?.value).toBe('No quick win available right now');
    expect(run.cards.find((c) => c.code === 'blocker')?.value).toBe('No blockers found');
    expect(run.cards.find((c) => c.code === 'weekly-progress')?.value).toBe('0 pattern(s) this week');
    expect(run.cards.find((c) => c.code === 'portfolio-growth')?.value).toBe('0 total pattern(s)');
  });

  it('a real interrupted run surfaces as both Blocker and Unfinished Work, with a real navigation target', () => {
    let interrupted = createAutonomousDesignRun({ mode: 'FULL_AUTOPILOT', requestedCount: 10, now: 1 });
    interrupted = transitionAutonomousDesignRun(interrupted, 'PLAN_READY', 2);
    interrupted = transitionAutonomousDesignRun(interrupted, 'GENERATING', 3);
    const run = buildBusinessCoach(baseInput({ autonomousRuns: [interrupted] }));
    expect(run.cards.find((c) => c.code === 'blocker')?.value).toContain('Continue');
    expect(run.cards.find((c) => c.code === 'blocker')?.navigateTarget).toBe('autopilotHistory');
    expect(run.cards.find((c) => c.code === 'unfinished-work')?.navigateTarget).toBe('autopilotHistory');
  });

  it('Weekly Production Progress and Portfolio Growth report real counts from real Portfolio assets', () => {
    const recent = createPortfolioAsset({ displayName: 'A', originalFilename: 'a.svg', sourceFileReferences: [], previewReference: null, metadataReference: null, presetId: 'botanical' });
    const recentAsset = { ...recent, createdAt: 99000 };
    const run = buildBusinessCoach(baseInput({ portfolioAssets: [recentAsset], now: 100000 }));
    expect(run.cards.find((c) => c.code === 'weekly-progress')?.value).toBe('1 pattern(s) this week');
    expect(run.cards.find((c) => c.code === 'portfolio-growth')?.value).toBe('1 total pattern(s)');
  });

  it('Submission Readiness reflects the real BusinessStatus queue counts, never invented', () => {
    const status: BusinessStatus = { ...EMPTY_STATUS, commercialReadiness: 42, submissionQueue: { ready: 3, pendingReview: 1, pendingUpload: 2 } };
    const run = buildBusinessCoach(baseInput({ businessStatus: status }));
    const card = run.cards.find((c) => c.code === 'submission-readiness')!;
    expect(card.value).toBe('42% ready');
    expect(card.detail).toContain('READY: 3');
    expect(card.detail).toContain('Pending Review: 1');
    expect(card.detail).toContain('Pending Upload: 2');
  });
});
