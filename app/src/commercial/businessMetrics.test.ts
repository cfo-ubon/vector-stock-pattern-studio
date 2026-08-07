import { describe, it, expect } from 'vitest';
import { computeBusinessMetrics, MANUAL_MINUTES_PER_PACKAGE_BASELINE } from './businessMetrics';
import type { CommercialPackageHistoryEntry, CommercialReadinessReport } from './domain/types';

function entry(overrides: Partial<CommercialPackageHistoryEntry>): CommercialPackageHistoryEntry {
  return { id: 'e1', createdAt: Date.now(), assetId: 'a1', marketplaceId: 'etsy', status: 'BUILT', readinessScore: 96, ...overrides };
}

describe('computeBusinessMetrics', () => {
  it('reports every count as zero and every rate as null with no history at all', () => {
    const metrics = computeBusinessMetrics([], [], 1_700_000_000_000);
    expect(metrics.commercialThroughputToday).toBe(0);
    expect(metrics.packagesPerHour).toBeNull();
    expect(metrics.commercialReadinessAverage).toBeNull();
    expect(metrics.averageCompletionTimeMs).toBeNull();
    expect(metrics.readyToday).toBe(0);
    expect(metrics.ownerTimeSavedMinutesToday).toBe(0);
    expect(metrics.automationPercent).toBeNull();
  });

  it('counts only today\'s packages toward throughput/readyToday, and estimates owner time saved from the documented baseline', () => {
    const now = new Date('2026-08-01T15:00:00Z').getTime();
    const todayEntry1 = entry({ id: 'e1', createdAt: new Date('2026-08-01T10:00:00Z').getTime(), status: 'BUILT' });
    const todayEntry2 = entry({ id: 'e2', createdAt: new Date('2026-08-01T12:00:00Z').getTime(), status: 'NEEDS_VERIFICATION' });
    const yesterdayEntry = entry({ id: 'e3', createdAt: new Date('2026-07-31T10:00:00Z').getTime(), status: 'BUILT' });

    const metrics = computeBusinessMetrics([todayEntry1, todayEntry2, yesterdayEntry], [], now);

    expect(metrics.commercialThroughputToday).toBe(2);
    expect(metrics.readyToday).toBe(1);
    expect(metrics.readyThisWeek).toBe(2);
    expect(metrics.ownerTimeSavedMinutesToday).toBe(2 * MANUAL_MINUTES_PER_PACKAGE_BASELINE);
    expect(metrics.automationPercent).toBe(50);
  });

  it('averages real readiness scores across the current report batch', () => {
    const reports = [{ score: 80 } as CommercialReadinessReport, { score: 100 } as CommercialReadinessReport];
    const metrics = computeBusinessMetrics([], reports, Date.now());
    expect(metrics.commercialReadinessAverage).toBe(90);
  });
});
