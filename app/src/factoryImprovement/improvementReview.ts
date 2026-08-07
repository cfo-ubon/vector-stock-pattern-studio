import type { FactoryDailyKpi, FactoryReview, TrendStatus, FactoryStage } from '../factoryIntelligence/domain/types';
import type { ImprovementReview, ImprovementReviewPeriod, ImprovementReviewMetricChange } from './domain/types';
import { IMPROVEMENT_REVIEW_SCHEMA_VERSION } from './domain/types';

// Mission 3, Part 8 — Improvement Review. Aggregates already-persisted
// Factory Intelligence data (`factoryDailyKpi` snapshots, `factoryReviews`
// per completed batch, Build 032) for a real period window — never
// recomputed from the full task/timeline history (Part 13). Reuses the
// same 2% dead-zone comparison policy `trendEngine.ts` already discloses.

const STABLE_DEADZONE_PERCENT = 2; // matches factoryIntelligence/trendEngine.ts's own disclosed dead-zone policy

const REVIEWED_METRIC_KEYS: { key: keyof FactoryDailyKpi['metrics']; higherIsBetter: boolean }[] = [
  { key: 'factoryEfficiency', higherIsBetter: true },
  { key: 'commercialThroughput', higherIsBetter: true },
  { key: 'repairRatio', higherIsBetter: false },
  { key: 'blockedTaskRatio', higherIsBetter: false },
  { key: 'commercialReadyRatio', higherIsBetter: true },
];

function statusOf(start: number | null, end: number | null, higherIsBetter: boolean): TrendStatus {
  if (start === null || end === null) return 'UNKNOWN';
  const base = Math.max(Math.abs(start), 1);
  const percentChange = ((end - start) / base) * 100;
  if (Math.abs(percentChange) <= STABLE_DEADZONE_PERCENT) return 'STABLE';
  const improved = higherIsBetter ? end > start : end < start;
  return improved ? 'IMPROVED' : 'DECLINED';
}

function pad(n: number, len: number): string {
  return String(n).padStart(len, '0');
}
function dateStamp(now: number): string {
  const d = new Date(now);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1, 2)}${pad(d.getUTCDate(), 2)}`;
}
function randomSuffix(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
export function generateImprovementReviewId(now: number = Date.now()): string {
  return `FIREV-${dateStamp(now)}-${randomSuffix()}`;
}

export function generateImprovementReview(period: ImprovementReviewPeriod, periodStart: number, periodEnd: number, dailyKpiHistory: FactoryDailyKpi[], factoryReviews: FactoryReview[], now: number = Date.now()): ImprovementReview {
  const inWindow = dailyKpiHistory.filter((k) => k.capturedAt >= periodStart && k.capturedAt <= periodEnd).sort((a, b) => a.capturedAt - b.capturedAt);
  const startSnapshot = inWindow[0] ?? null;
  const endSnapshot = inWindow[inWindow.length - 1] ?? null;

  const metricChanges: ImprovementReviewMetricChange[] = REVIEWED_METRIC_KEYS.map(({ key, higherIsBetter }) => {
    const startValue = startSnapshot ? (startSnapshot.metrics[key] as number | null) : null;
    const endValue = endSnapshot ? (endSnapshot.metrics[key] as number | null) : null;
    return { metric: key, status: statusOf(startValue, endValue, higherIsBetter), startValue, endValue };
  });

  metricChanges.push({
    metric: 'businessOutcomeScore',
    status: statusOf(startSnapshot?.businessOutcomeScore ?? null, endSnapshot?.businessOutcomeScore ?? null, true),
    startValue: startSnapshot?.businessOutcomeScore ?? null,
    endValue: endSnapshot?.businessOutcomeScore ?? null,
  });

  const improved = metricChanges.filter((m) => m.status === 'IMPROVED');
  const bestImprovement = improved.length > 0 ? improved.map((m) => m.metric).join(', ') : null;

  const reviewsInWindow = factoryReviews.filter((r) => r.createdAt >= periodStart && r.createdAt <= periodEnd);

  const bottleneckCounts = new Map<FactoryStage, number>();
  for (const r of reviewsInWindow) {
    if (!r.topBottleneckStage) continue;
    bottleneckCounts.set(r.topBottleneckStage, (bottleneckCounts.get(r.topBottleneckStage) ?? 0) + 1);
  }
  const rankedBottlenecks = [...bottleneckCounts.entries()].sort((a, b) => b[1] - a[1]);
  const worstBottleneckStage = rankedBottlenecks[0]?.[0] ?? null;

  const recommendationCounts = new Map<string, number>();
  for (const r of reviewsInWindow) {
    if (!r.topRecommendation) continue;
    recommendationCounts.set(r.topRecommendation, (recommendationCounts.get(r.topRecommendation) ?? 0) + 1);
  }
  const rankedRecommendations = [...recommendationCounts.entries()].sort((a, b) => b[1] - a[1]);
  const topRecommendation = rankedRecommendations[0]?.[0] ?? null;

  return {
    id: generateImprovementReviewId(now),
    period,
    periodStart,
    periodEnd,
    metricChanges,
    bestImprovement,
    worstBottleneckStage,
    topRecommendation,
    batchesReviewed: reviewsInWindow.length,
    createdAt: now,
    schemaVersion: IMPROVEMENT_REVIEW_SCHEMA_VERSION,
  };
}

export const IMPROVEMENT_REVIEW_PERIOD_MS: Record<ImprovementReviewPeriod, number> = {
  DAILY: 24 * 60 * 60 * 1000,
  WEEKLY: 7 * 24 * 60 * 60 * 1000,
  MONTHLY: 30 * 24 * 60 * 60 * 1000,
};

/** Convenience wrapper — the window is always "the last N days ending
 * now," matching Part 8's Daily/Weekly/Monthly cadence. */
export function generatePeriodReview(period: ImprovementReviewPeriod, dailyKpiHistory: FactoryDailyKpi[], factoryReviews: FactoryReview[], now: number = Date.now()): ImprovementReview {
  const periodStart = now - IMPROVEMENT_REVIEW_PERIOD_MS[period];
  return generateImprovementReview(period, periodStart, now, dailyKpiHistory, factoryReviews, now);
}
