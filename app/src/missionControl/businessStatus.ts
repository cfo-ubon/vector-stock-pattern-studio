import { loadDashboardSnapshot } from '../catalog/dashboard/portfolioDashboardService';
import { loadPortfolioAssets } from '../catalog/storage/portfolioStore';
import { loadProductionQueueItems } from '../catalog/queue/productionQueueStore';
import type { PortfolioAsset } from '../catalog/domain/types';
import type { ProductionQueueItem } from '../catalog/queue/productionQueue';

// Build 030 ("Today's Business Status") — a read-only reshape over two
// existing sources, no new score and no new counting rule of its own:
// `portfolioHealth`/`commercialReadiness` are the exact Build 017
// Dashboard Snapshot numbers every other screen already shows, and the
// submission-queue counts are a straight tally of Build 026's own
// `ProductionQueueStatus` stages (`READY`/`QUALITY_REVIEW`/
// `PACKAGE_PREPARED` — the queue's own real "ready to sell" / "needs a
// human look" / "packaged, waiting to go out" stages). Never a technical
// generator parameter — Mission Control's whole point is to stay
// business-language.

export interface BusinessStatus {
  portfolioHealthScore: number;
  submissionQueue: {
    ready: number;
    pendingReview: number;
    pendingUpload: number;
  };
  /** Real count of Portfolio assets first created within the current
   * calendar month — an honest "this month so far" tally, not a target or
   * a forecast. */
  monthlyProgress: {
    patternsThisMonth: number;
  };
  /** `ReadinessAnalytics.readinessRate` from the existing Dashboard
   * Snapshot — the % of the catalog with at least one submission at READY
   * or beyond. */
  commercialReadiness: number;
  generatedAt: number;
}

function countPatternsThisMonth(assets: PortfolioAsset[], now: number): number {
  const d = new Date(now);
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  return assets.filter((a) => a.createdAt >= monthStart).length;
}

/** Pure — given the same inputs, always the same status. The two IO
 * boundaries (`loadBusinessStatus` below) are thin loaders over this. */
export function buildBusinessStatus(
  assets: PortfolioAsset[],
  queueItems: ProductionQueueItem[],
  dashboard: Awaited<ReturnType<typeof loadDashboardSnapshot>>,
  now: number,
): BusinessStatus {
  const ready = queueItems.filter((q) => q.status === 'READY').length;
  const pendingReview = queueItems.filter((q) => q.status === 'QUALITY_REVIEW').length;
  const pendingUpload = queueItems.filter((q) => q.status === 'PACKAGE_PREPARED').length;

  return {
    portfolioHealthScore: dashboard.portfolioHealth.overall,
    submissionQueue: { ready, pendingReview, pendingUpload },
    monthlyProgress: { patternsThisMonth: countPatternsThisMonth(assets, now) },
    commercialReadiness: dashboard.readinessAnalytics.readinessRate,
    generatedAt: now,
  };
}

export async function loadBusinessStatus(now: number = Date.now()): Promise<BusinessStatus> {
  const [assets, queueItems, dashboard] = await Promise.all([loadPortfolioAssets(), loadProductionQueueItems(), loadDashboardSnapshot()]);
  return buildBusinessStatus(assets, queueItems, dashboard, now);
}
