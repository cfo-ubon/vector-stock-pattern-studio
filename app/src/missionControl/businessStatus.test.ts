import { describe, it, expect, beforeEach } from 'vitest';
import { buildBusinessStatus, loadBusinessStatus } from './businessStatus';
import { clearPortfolioStores, importAssetTransaction } from '../catalog/storage/portfolioStore';
import { clearCollectionsStore } from '../catalog/storage/collectionStore';
import { clearSubmissionStore } from '../catalog/submission/submissionStore';
import { clearProductionQueueItems, putProductionQueueItem } from '../catalog/queue/productionQueueStore';
import { createProductionQueueItem, transitionProductionQueueItem } from '../catalog/queue/productionQueue';
import { createPortfolioAsset } from '../catalog/domain/asset';
import type { PortfolioAsset } from '../catalog/domain/types';
import type { loadDashboardSnapshot } from '../catalog/dashboard/portfolioDashboardService';

type DashboardSnapshot = Awaited<ReturnType<typeof loadDashboardSnapshot>>;

function makeDashboard(overrides: Partial<{ overall: number; readinessRate: number }> = {}): DashboardSnapshot {
  return {
    generatedAt: 0,
    portfolioHealth: { overall: overrides.overall ?? 0, components: {} as never },
    submissionAnalytics: {} as never,
    seoAnalytics: {} as never,
    collectionAnalytics: {} as never,
    marketplaceAnalytics: [],
    readinessAnalytics: { totalPatterns: 0, patternsWithSubmissions: 0, patternsWithoutSubmissions: 0, patternsReadyOrBeyond: 0, readinessRate: overrides.readinessRate ?? 0 },
    recommendations: [],
  };
}

function makeAsset(createdAt: number): PortfolioAsset {
  return createPortfolioAsset({ displayName: 'Test', originalFilename: 'test.svg', sourceFileReferences: [], previewReference: null, metadataReference: null, createdAt });
}

describe('buildBusinessStatus (pure)', () => {
  it('reshapes real Dashboard Snapshot numbers without inventing new ones', () => {
    const status = buildBusinessStatus([], [], makeDashboard({ overall: 72, readinessRate: 45 }), Date.now());
    expect(status.portfolioHealthScore).toBe(72);
    expect(status.commercialReadiness).toBe(45);
  });

  it('tallies the real Production Queue statuses into READY / Pending Review / Pending Upload', () => {
    const now = Date.now();
    const ready = transitionProductionQueueItem(transitionProductionQueueItem(transitionProductionQueueItem(createProductionQueueItem({ ideaNote: 'a', now }), 'GENERATED', now), 'QUALITY_REVIEW', now), 'READY', now);
    const review = transitionProductionQueueItem(transitionProductionQueueItem(createProductionQueueItem({ ideaNote: 'b', now }), 'GENERATED', now), 'QUALITY_REVIEW', now);
    const packaged = transitionProductionQueueItem(ready, 'PACKAGE_PREPARED', now);
    const status = buildBusinessStatus([], [ready, review, packaged], makeDashboard(), now);
    expect(status.submissionQueue.ready).toBe(1);
    expect(status.submissionQueue.pendingReview).toBe(1);
    expect(status.submissionQueue.pendingUpload).toBe(1);
  });

  it('counts only patterns created within the current calendar month — honest, not fabricated', () => {
    const now = new Date(2026, 6, 15).getTime(); // July 15, 2026
    const thisMonth = makeAsset(new Date(2026, 6, 1).getTime());
    const lastMonth = makeAsset(new Date(2026, 5, 30).getTime());
    const status = buildBusinessStatus([thisMonth, lastMonth], [], makeDashboard(), now);
    expect(status.monthlyProgress.patternsThisMonth).toBe(1);
  });
});

describe('loadBusinessStatus — real storage integration', () => {
  beforeEach(async () => {
    await clearPortfolioStores();
    await clearCollectionsStore();
    clearSubmissionStore();
    await clearProductionQueueItems();
  });

  it('returns an honest empty-baseline status for a fresh install', async () => {
    const status = await loadBusinessStatus();
    expect(status.portfolioHealthScore).toBe(0);
    expect(status.submissionQueue).toEqual({ ready: 0, pendingReview: 0, pendingUpload: 0 });
    expect(status.monthlyProgress.patternsThisMonth).toBe(0);
  });

  it('reflects a real imported asset and a real queued item together', async () => {
    const asset = createPortfolioAsset({ displayName: 'Floral', originalFilename: 'floral.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
    await importAssetTransaction(asset, []);
    await putProductionQueueItem(createProductionQueueItem({ ideaNote: 'floral idea' }));

    const status = await loadBusinessStatus();
    expect(status.monthlyProgress.patternsThisMonth).toBe(1);
  });
});
