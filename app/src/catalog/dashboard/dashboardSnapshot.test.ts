import { describe, it, expect } from 'vitest';
import { buildDashboardSnapshot } from './dashboardSnapshot';
import { createCollection } from '../domain/collection';
import { createPortfolioAsset } from '../domain/asset';
import { createSubmissionRecord } from '../submission/submissionRecord';
import type { PortfolioAsset } from '../domain/types';

function asset(collectionIds: string[] = []): PortfolioAsset {
  const base = createPortfolioAsset({ displayName: 'A', originalFilename: 'a.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
  return { ...base, collectionIds };
}

describe('buildDashboardSnapshot — empty portfolio', () => {
  it('assembles a complete snapshot with every section present, all at their empty baseline', () => {
    const snapshot = buildDashboardSnapshot({ collections: [], assets: [], submissions: [], now: 12345 });
    expect(snapshot.generatedAt).toBe(12345);
    expect(snapshot.portfolioHealth.overall).toBe(0);
    expect(snapshot.submissionAnalytics.total).toBe(0);
    expect(snapshot.seoAnalytics.sampleSize).toBe(0);
    expect(snapshot.collectionAnalytics.collectionCount).toBe(0);
    expect(snapshot.marketplaceAnalytics).toEqual([]);
    expect(snapshot.readinessAnalytics.totalPatterns).toBe(0);
    expect(snapshot.recommendations).toEqual([]);
  });
});

describe('buildDashboardSnapshot — real mixed portfolio', () => {
  it('wires every analytics section from the same input consistently', () => {
    const collection = createCollection({ name: 'Spring 2026' });
    const a1 = asset([collection.id]);
    const a2 = asset();
    const submission = { ...createSubmissionRecord({ patternId: a1.assetId, marketplaceId: 'etsy', titleSnapshot: 'A pattern' }), status: 'READY' as const };

    const snapshot = buildDashboardSnapshot({ collections: [collection], assets: [a1, a2], submissions: [submission], now: 999 });

    expect(snapshot.collectionAnalytics.collectionCount).toBe(1);
    expect(snapshot.collectionAnalytics.patternCount).toBe(1);
    expect(snapshot.readinessAnalytics.totalPatterns).toBe(2);
    expect(snapshot.readinessAnalytics.patternsReadyOrBeyond).toBe(1);
    expect(snapshot.submissionAnalytics.ready).toBe(1);
    expect(snapshot.submissionAnalytics.total).toBe(1);
    expect(snapshot.marketplaceAnalytics).toHaveLength(1);
    expect(snapshot.marketplaceAnalytics[0].marketplaceId).toBe('etsy');
    expect(snapshot.seoAnalytics.sampleSize).toBe(1);
    expect(snapshot.portfolioHealth.overall).toBeGreaterThan(0);
  });

  it('includes recommendations that reflect the same data the analytics sections report', () => {
    const emptyCollection = createCollection({ name: 'Empty' });
    const snapshot = buildDashboardSnapshot({ collections: [emptyCollection], assets: [], submissions: [], now: 1 });
    expect(snapshot.recommendations.some((r) => r.code === 'fill-empty-collections')).toBe(true);
    expect(snapshot.collectionAnalytics.emptyCollections).toHaveLength(1);
  });
});

describe('buildDashboardSnapshot — determinism', () => {
  it('produces identical output across repeated calls with the same input and the same now', () => {
    const collection = createCollection({ name: 'X', now: 1000 });
    const a1 = asset([collection.id]);
    const input = { collections: [collection], assets: [a1], submissions: [createSubmissionRecord({ patternId: a1.assetId, marketplaceId: 'etsy', now: 2000 })], now: 5000 };
    const first = buildDashboardSnapshot(input);
    const second = buildDashboardSnapshot(input);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('defaults generatedAt to the current time when now is omitted', () => {
    const before = Date.now();
    const snapshot = buildDashboardSnapshot({ collections: [], assets: [], submissions: [] });
    const after = Date.now();
    expect(snapshot.generatedAt).toBeGreaterThanOrEqual(before);
    expect(snapshot.generatedAt).toBeLessThanOrEqual(after);
  });
});
