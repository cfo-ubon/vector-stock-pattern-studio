import { describe, it, expect } from 'vitest';
import { generateImprovementReview, generatePeriodReview } from './improvementReview';
import type { FactoryDailyKpi, FactoryReview, FactoryIntelligenceMetrics } from '../factoryIntelligence/domain/types';

function metrics(overrides: Partial<FactoryIntelligenceMetrics>): FactoryIntelligenceMetrics {
  return {
    computedAt: 1000,
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

function kpiSnapshot(overrides: Partial<FactoryDailyKpi>): FactoryDailyKpi {
  return { dateKey: '2026-08-01', capturedAt: 1000, metrics: metrics({}), businessOutcomeScore: null, ...overrides };
}

function review(overrides: Partial<FactoryReview>): FactoryReview {
  return {
    id: 'FREV-1',
    batchId: 'B-1',
    packagesProduced: 1,
    commercialReady: 1,
    review: 0,
    rejected: 0,
    averageCompletionTimeMs: 1000,
    repairCount: 0,
    queueDelaysMs: null,
    factoryEfficiency: 90,
    ownerTimeSavedMinutes: 45,
    topBottleneckStage: 'repair',
    topRecommendation: 'Investigate why repairs are not resolving on the first attempt.',
    createdAt: 1000,
    schemaVersion: 1,
    ...overrides,
  };
}

describe('generateImprovementReview', () => {
  it('reports UNKNOWN for every metric when there is no daily KPI history in the window', () => {
    const result = generateImprovementReview('DAILY', 0, 1000, [], [], 1000);
    expect(result.metricChanges.every((m) => m.status === 'UNKNOWN')).toBe(true);
    expect(result.bestImprovement).toBeNull();
    expect(result.worstBottleneckStage).toBeNull();
    expect(result.topRecommendation).toBeNull();
    expect(result.batchesReviewed).toBe(0);
  });

  it('reports IMPROVED for factoryEfficiency when it genuinely rises across the window', () => {
    const history = [kpiSnapshot({ dateKey: '2026-08-01', capturedAt: 100, metrics: metrics({ factoryEfficiency: 50 }) }), kpiSnapshot({ dateKey: '2026-08-02', capturedAt: 900, metrics: metrics({ factoryEfficiency: 90 }) })];
    const result = generateImprovementReview('DAILY', 0, 1000, history, [], 1000);
    const change = result.metricChanges.find((m) => m.metric === 'factoryEfficiency');
    expect(change?.status).toBe('IMPROVED');
    expect(result.bestImprovement).toContain('factoryEfficiency');
  });

  it('identifies the most frequent real bottleneck and recommendation across reviews in the window', () => {
    const reviews = [review({ id: 'R1', topBottleneckStage: 'repair', topRecommendation: 'Fix repairs' }), review({ id: 'R2', topBottleneckStage: 'repair', topRecommendation: 'Fix repairs' }), review({ id: 'R3', topBottleneckStage: 'qa', topRecommendation: 'Fix QA' })];
    const result = generateImprovementReview('WEEKLY', 0, 1000, [], reviews, 1000);
    expect(result.worstBottleneckStage).toBe('repair');
    expect(result.topRecommendation).toBe('Fix repairs');
    expect(result.batchesReviewed).toBe(3);
  });

  it('never recomputes from full history — only counts reviews inside the given window', () => {
    const outOfWindow = review({ id: 'R-old', createdAt: -5000 });
    const inWindow = review({ id: 'R-new', createdAt: 500 });
    const result = generateImprovementReview('DAILY', 0, 1000, [], [outOfWindow, inWindow], 1000);
    expect(result.batchesReviewed).toBe(1);
  });
});

describe('generatePeriodReview', () => {
  it('computes a MONTHLY window ending at now', () => {
    const result = generatePeriodReview('MONTHLY', [], [], 10_000_000);
    expect(result.period).toBe('MONTHLY');
    expect(result.periodEnd).toBe(10_000_000);
    expect(result.periodStart).toBeLessThan(result.periodEnd);
  });
});
