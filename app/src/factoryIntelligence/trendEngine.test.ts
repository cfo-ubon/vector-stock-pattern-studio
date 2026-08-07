import { describe, it, expect } from 'vitest';
import { compareFactoryTrend, dateKeyFor } from './trendEngine';
import type { FactoryDailyKpi, FactoryIntelligenceMetrics } from './domain/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 0, 31, 12, 0, 0).getTime();

function metricsWith(overrides: Partial<FactoryIntelligenceMetrics>): FactoryIntelligenceMetrics {
  return {
    computedAt: NOW,
    factoryEfficiency: null,
    queueEfficiency: null,
    commercialThroughput: 0,
    averageBatchTimeMs: null,
    averageQueueTimeMs: null,
    averageRepairTimeMs: null,
    averageQaTimeMs: null,
    averageSeoTimeMs: null,
    averagePackagingTimeMs: null,
    averageExportPreparationTimeMs: null,
    blockedTaskRatio: null,
    repairRatio: null,
    commercialReadyRatio: null,
    ownerWaitingTimeMs: null,
    ...overrides,
  };
}

function snapshotAt(now: number, metrics: FactoryIntelligenceMetrics, businessOutcomeScore: number | null = null): FactoryDailyKpi {
  return { dateKey: dateKeyFor(now), capturedAt: now, metrics, businessOutcomeScore };
}

describe('compareFactoryTrend', () => {
  it('reports UNKNOWN for every metric with no history at all', () => {
    const today = metricsWith({ factoryEfficiency: 80 });
    const report = compareFactoryTrend(today, null, [], NOW);
    const factoryEff = report.metrics.find((m) => m.metric === 'factoryEfficiency')!;
    expect(factoryEff.statusVsYesterday).toBe('UNKNOWN');
    expect(factoryEff.statusVs7Days).toBe('UNKNOWN');
    expect(factoryEff.statusVs30Days).toBe('UNKNOWN');
  });

  it('detects IMPROVED for a higher-is-better metric that clearly increased', () => {
    const yesterday = snapshotAt(NOW - DAY_MS, metricsWith({ factoryEfficiency: 50 }));
    const today = metricsWith({ factoryEfficiency: 90 });
    const report = compareFactoryTrend(today, null, [yesterday], NOW);
    expect(report.metrics.find((m) => m.metric === 'factoryEfficiency')!.statusVsYesterday).toBe('IMPROVED');
  });

  it('detects DECLINED for a lower-is-better metric that clearly increased', () => {
    const yesterday = snapshotAt(NOW - DAY_MS, metricsWith({ repairRatio: 10 }));
    const today = metricsWith({ repairRatio: 40 });
    const report = compareFactoryTrend(today, null, [yesterday], NOW);
    expect(report.metrics.find((m) => m.metric === 'repairRatio')!.statusVsYesterday).toBe('DECLINED');
  });

  it('detects STABLE within the dead-zone and never fabricates a percentage for missing data', () => {
    const yesterday = snapshotAt(NOW - DAY_MS, metricsWith({ factoryEfficiency: 80 }));
    const today = metricsWith({ factoryEfficiency: 81 });
    const report = compareFactoryTrend(today, null, [yesterday], NOW);
    const point = report.metrics.find((m) => m.metric === 'factoryEfficiency')!;
    expect(point.statusVsYesterday).toBe('STABLE');
    expect(point.statusVs7Days).toBe('UNKNOWN');
    expect(point.last7Days).toBeNull();
  });

  it('looks up the exact 7-day and 30-day historical snapshots by dateKey', () => {
    const sevenDaysAgo = snapshotAt(NOW - 7 * DAY_MS, metricsWith({ commercialThroughput: 2 }));
    const thirtyDaysAgo = snapshotAt(NOW - 30 * DAY_MS, metricsWith({ commercialThroughput: 1 }));
    const today = metricsWith({ commercialThroughput: 5 });
    const report = compareFactoryTrend(today, null, [sevenDaysAgo, thirtyDaysAgo], NOW);
    const point = report.metrics.find((m) => m.metric === 'commercialThroughput')!;
    expect(point.last7Days).toBe(2);
    expect(point.last30Days).toBe(1);
    expect(point.statusVs7Days).toBe('IMPROVED');
    expect(point.statusVs30Days).toBe('IMPROVED');
  });

  it('compares businessOutcomeScore using the same historical lookup', () => {
    const yesterday = snapshotAt(NOW - DAY_MS, metricsWith({}), 40);
    const report = compareFactoryTrend(metricsWith({}), 70, [yesterday], NOW);
    const point = report.metrics.find((m) => m.metric === 'businessOutcomeScore')!;
    expect(point.today).toBe(70);
    expect(point.yesterday).toBe(40);
    expect(point.statusVsYesterday).toBe('IMPROVED');
  });
});
