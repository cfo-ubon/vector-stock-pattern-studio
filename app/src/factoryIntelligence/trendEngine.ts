import type { FactoryIntelligenceMetrics, FactoryDailyKpi, FactoryTrendReport, MetricTrendPoint, TrendStatus } from './domain/types';

// Mission 2, Part 6 — Factory Trend Engine. Compares today's live metrics
// against exact historical daily snapshots (yesterday / 7 days ago / 30
// days ago) — never a fabricated percentage, and never recomputed from
// the full task/timeline history (Part 11): each historical point is a
// direct lookup into the already-persisted `factoryDailyKpi` store by
// its `dateKey`.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Within this percent of the previous value counts as STABLE rather
 * than IMPROVED/DECLINED — a disclosed dead-zone policy, not a measured
 * threshold (there is no historical volatility data yet to derive one
 * from). */
const STABLE_DEADZONE_PERCENT = 2;

export function dateKeyFor(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface TrendMetricConfig {
  key: keyof FactoryIntelligenceMetrics | 'businessOutcomeScore';
  higherIsBetter: boolean;
}

const TREND_METRICS: TrendMetricConfig[] = [
  { key: 'factoryEfficiency', higherIsBetter: true },
  { key: 'queueEfficiency', higherIsBetter: true },
  { key: 'commercialThroughput', higherIsBetter: true },
  { key: 'repairRatio', higherIsBetter: false },
  { key: 'blockedTaskRatio', higherIsBetter: false },
  { key: 'commercialReadyRatio', higherIsBetter: true },
  { key: 'businessOutcomeScore', higherIsBetter: true },
];

function valueOf(snapshot: FactoryDailyKpi | undefined, key: TrendMetricConfig['key']): number | null {
  if (!snapshot) return null;
  if (key === 'businessOutcomeScore') return snapshot.businessOutcomeScore;
  const v = snapshot.metrics[key as keyof FactoryIntelligenceMetrics];
  return typeof v === 'number' ? v : null;
}

function statusOf(current: number | null, previous: number | null, higherIsBetter: boolean): TrendStatus {
  if (current === null || previous === null) return 'UNKNOWN';
  const base = Math.max(Math.abs(previous), 1);
  const percentChange = ((current - previous) / base) * 100;
  if (Math.abs(percentChange) <= STABLE_DEADZONE_PERCENT) return 'STABLE';
  const improved = higherIsBetter ? current > previous : current < previous;
  return improved ? 'IMPROVED' : 'DECLINED';
}

export function compareFactoryTrend(todayMetrics: FactoryIntelligenceMetrics, todayOutcomeScore: number | null, history: FactoryDailyKpi[], now: number = Date.now()): FactoryTrendReport {
  const byDateKey = new Map(history.map((h) => [h.dateKey, h]));
  const yesterday = byDateKey.get(dateKeyFor(now - DAY_MS));
  const sevenDaysAgo = byDateKey.get(dateKeyFor(now - 7 * DAY_MS));
  const thirtyDaysAgo = byDateKey.get(dateKeyFor(now - 30 * DAY_MS));

  const todaySnapshot: FactoryDailyKpi = { dateKey: dateKeyFor(now), capturedAt: now, metrics: todayMetrics, businessOutcomeScore: todayOutcomeScore };

  const metrics: MetricTrendPoint[] = TREND_METRICS.map(({ key, higherIsBetter }) => {
    const today = valueOf(todaySnapshot, key);
    const yesterdayValue = valueOf(yesterday, key);
    const last7Value = valueOf(sevenDaysAgo, key);
    const last30Value = valueOf(thirtyDaysAgo, key);
    return {
      metric: key,
      today,
      yesterday: yesterdayValue,
      last7Days: last7Value,
      last30Days: last30Value,
      statusVsYesterday: statusOf(today, yesterdayValue, higherIsBetter),
      statusVs7Days: statusOf(today, last7Value, higherIsBetter),
      statusVs30Days: statusOf(today, last30Value, higherIsBetter),
    };
  });

  return { computedAt: now, metrics };
}
