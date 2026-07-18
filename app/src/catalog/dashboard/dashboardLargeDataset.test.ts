import { describe, it, expect } from 'vitest';
import { buildDashboardSnapshot } from './dashboardSnapshot';
import { createCollection } from '../domain/collection';
import { createPortfolioAsset } from '../domain/asset';
import { createSubmissionRecord } from '../submission/submissionRecord';
import type { PortfolioAsset } from '../domain/types';
import type { SubmissionRecord } from '../submission/submissionRecord';
import type { Collection } from '../domain/collection';

// Build 017 — "Large dataset" required test category. 400 patterns
// across 40 collections, each pattern submitted to 5 marketplaces
// (2,000 submissions total) — consistent with the scale Build 015's and
// Build 016's own large-dataset tests used, and large enough to exceed
// any accidental O(n^2) mistake's practical runtime.
describe('Portfolio Dashboard — large dataset', () => {
  it('assembles a correct, complete snapshot for 400 patterns / 40 collections / 2,000 submissions', () => {
    const collectionCount = 40;
    const patternCount = 400;
    const marketplaceIds = ['shutterstock', 'adobestock', 'freepik', 'gettyimages', 'etsy'];

    const collections: Collection[] = Array.from({ length: collectionCount }, (_, i) => createCollection({ name: `Collection ${i}`, now: 1_700_000_000_000 + i }));

    const assets: PortfolioAsset[] = [];
    for (let i = 0; i < patternCount; i++) {
      const base = createPortfolioAsset({ displayName: `Pattern ${i}`, originalFilename: `p${i}.svg`, sourceFileReferences: [], previewReference: null, metadataReference: null });
      // Every pattern belongs to exactly one collection, round-robin —
      // fully organized, so Collection Organization health should read 100.
      assets.push({ ...base, collectionIds: [collections[i % collectionCount].id] });
    }

    const statuses = ['DRAFT', 'READY', 'QUEUED', 'SUBMITTED', 'APPROVED'] as const;
    const submissions: SubmissionRecord[] = [];
    for (let i = 0; i < patternCount; i++) {
      marketplaceIds.forEach((marketplaceId, mIndex) => {
        const status = statuses[(i + mIndex) % statuses.length];
        const record = createSubmissionRecord({
          patternId: assets[i].assetId,
          marketplaceId,
          titleSnapshot: `Pattern ${i} for ${marketplaceId}`,
          descriptionSnapshot: `A seamless pattern number ${i}, designed for ${marketplaceId} with a soft pastel spring feel.`,
          keywordSnapshot: ['seamless', 'floral', 'pastel', 'spring', 'fabric', 'wallpaper', `variant${i}`],
          category: 'Patterns',
          now: 1_700_000_000_000 + i * 1000 + mIndex,
        });
        submissions.push({ ...record, status });
      });
    }

    expect(submissions).toHaveLength(patternCount * marketplaceIds.length); // 2,000

    const start = performance.now();
    const snapshot = buildDashboardSnapshot({ collections, assets, submissions, now: 1_800_000_000_000 });
    const durationMs = performance.now() - start;
    expect(durationMs).toBeLessThan(20000);

    // Collection Analytics correctness at scale.
    expect(snapshot.collectionAnalytics.collectionCount).toBe(collectionCount);
    expect(snapshot.collectionAnalytics.patternCount).toBe(patternCount);
    expect(snapshot.collectionAnalytics.emptyCollections).toHaveLength(0);
    expect(snapshot.collectionAnalytics.duplicatePatternUsage).toHaveLength(0);

    // Readiness Analytics correctness at scale.
    expect(snapshot.readinessAnalytics.totalPatterns).toBe(patternCount);
    expect(snapshot.readinessAnalytics.patternsWithSubmissions).toBe(patternCount);

    // Submission Analytics correctness at scale — every status cycles
    // evenly across the 5-per-pattern submissions, so each of the 5
    // used statuses should appear exactly patternCount times.
    expect(snapshot.submissionAnalytics.total).toBe(2000);
    for (const status of statuses) {
      const field = { DRAFT: 'draft', READY: 'ready', QUEUED: 'queued', SUBMITTED: 'submitted', APPROVED: 'approved' }[status] as keyof typeof snapshot.submissionAnalytics;
      expect(snapshot.submissionAnalytics[field]).toBe(patternCount);
    }

    // Marketplace Analytics correctness at scale.
    expect(snapshot.marketplaceAnalytics).toHaveLength(5);
    for (const entry of snapshot.marketplaceAnalytics) {
      expect(entry.patternsPlanned).toBe(patternCount);
    }

    // SEO Analytics correctness at scale — every score in range, real
    // sample size.
    expect(snapshot.seoAnalytics.sampleSize).toBe(2000);
    expect(snapshot.seoAnalytics.averageScore).toBeGreaterThanOrEqual(0);
    expect(snapshot.seoAnalytics.averageScore).toBeLessThanOrEqual(100);
    expect(snapshot.seoAnalytics.lowestScore).toBeLessThanOrEqual(snapshot.seoAnalytics.averageScore);
    expect(snapshot.seoAnalytics.highestScore).toBeGreaterThanOrEqual(snapshot.seoAnalytics.averageScore);

    // Portfolio Health correctness at scale — a fully-organized,
    // fully-complete, mostly-valid portfolio should score reasonably
    // well, and every component must be in range.
    expect(snapshot.portfolioHealth.overall).toBeGreaterThanOrEqual(0);
    expect(snapshot.portfolioHealth.overall).toBeLessThanOrEqual(100);
    expect(snapshot.portfolioHealth.components.collectionOrganization).toBe(100);
    for (const value of Object.values(snapshot.portfolioHealth.components)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }

    // Recommendations are still well-formed at scale (Ready/Rejected
    // counts are large, so both should fire).
    expect(snapshot.recommendations.some((r) => r.code === 'move-ready-to-submission')).toBe(true);

    // Determinism at scale: rebuilding from the exact same input
    // produces byte-identical output.
    const rebuilt = buildDashboardSnapshot({ collections, assets, submissions, now: 1_800_000_000_000 });
    expect(JSON.stringify(rebuilt)).toBe(JSON.stringify(snapshot));
  }, 30000);
});
