import { describe, it, expect } from 'vitest';
import { generateRecommendations } from './recommendationEngine';
import type { RecommendationInputs } from './recommendationEngine';
import type { SeoAnalytics } from './seoAnalytics';
import type { SubmissionAnalytics } from './submissionAnalytics';
import type { CollectionAnalytics } from './collectionAnalytics';

const EMPTY_SEO: SeoAnalytics = { averageScore: 0, lowestScore: 0, highestScore: 0, missingMetadataCount: 0, averageKeywordCoverage: 0, averageMarketplaceCompatibility: 0, sampleSize: 0 };
const EMPTY_SUBMISSIONS: SubmissionAnalytics = { draft: 0, ready: 0, queued: 0, submitted: 0, approved: 0, rejected: 0, needsRevision: 0, archived: 0, total: 0, byMarketplace: {} };
const EMPTY_COLLECTIONS: CollectionAnalytics = { collectionCount: 0, patternCount: 0, averagePatternsPerCollection: 0, largestCollection: null, emptyCollections: [], duplicatePatternUsage: [] };

function baseInputs(overrides: Partial<RecommendationInputs> = {}): RecommendationInputs {
  return { seoAnalytics: EMPTY_SEO, submissionAnalytics: EMPTY_SUBMISSIONS, collectionAnalytics: EMPTY_COLLECTIONS, duplicateSubmissionConflictCount: 0, ...overrides };
}

describe('generateRecommendations — quiet portfolio', () => {
  it('returns an empty list when nothing needs attention', () => {
    expect(generateRecommendations(baseInputs())).toEqual([]);
  });
});

describe('generateRecommendations — improve-seo', () => {
  it('triggers when average SEO score is below 70 with real submissions', () => {
    const recs = generateRecommendations(baseInputs({ seoAnalytics: { ...EMPTY_SEO, averageScore: 60, sampleSize: 5 } }));
    expect(recs.some((r) => r.code === 'improve-seo')).toBe(true);
  });

  it('does not trigger for an empty portfolio (sampleSize 0) even though averageScore is 0', () => {
    const recs = generateRecommendations(baseInputs({ seoAnalytics: { ...EMPTY_SEO, averageScore: 0, sampleSize: 0 } }));
    expect(recs.some((r) => r.code === 'improve-seo')).toBe(false);
  });

  it('is high priority below 50, medium priority between 50 and 70', () => {
    const low = generateRecommendations(baseInputs({ seoAnalytics: { ...EMPTY_SEO, averageScore: 40, sampleSize: 3 } }));
    const mid = generateRecommendations(baseInputs({ seoAnalytics: { ...EMPTY_SEO, averageScore: 60, sampleSize: 3 } }));
    expect(low.find((r) => r.code === 'improve-seo')?.priority).toBe('high');
    expect(mid.find((r) => r.code === 'improve-seo')?.priority).toBe('medium');
  });

  it('does not trigger at or above 70', () => {
    const recs = generateRecommendations(baseInputs({ seoAnalytics: { ...EMPTY_SEO, averageScore: 70, sampleSize: 3 } }));
    expect(recs.some((r) => r.code === 'improve-seo')).toBe(false);
  });
});

describe('generateRecommendations — complete-metadata', () => {
  it('triggers when missingMetadataCount is above 0, with the exact count', () => {
    const recs = generateRecommendations(baseInputs({ seoAnalytics: { ...EMPTY_SEO, missingMetadataCount: 3, sampleSize: 10 } }));
    const rec = recs.find((r) => r.code === 'complete-metadata');
    expect(rec?.relatedCount).toBe(3);
    expect(rec?.priority).toBe('medium'); // 3/10 = 30%, below the 50% high-priority threshold
  });

  it('is high priority when more than half of submissions are missing metadata', () => {
    const recs = generateRecommendations(baseInputs({ seoAnalytics: { ...EMPTY_SEO, missingMetadataCount: 6, sampleSize: 10 } }));
    expect(recs.find((r) => r.code === 'complete-metadata')?.priority).toBe('high');
  });
});

describe('generateRecommendations — move-ready-to-submission', () => {
  it('triggers with the exact ready count', () => {
    const recs = generateRecommendations(baseInputs({ submissionAnalytics: { ...EMPTY_SUBMISSIONS, ready: 4, total: 4 } }));
    expect(recs.find((r) => r.code === 'move-ready-to-submission')?.relatedCount).toBe(4);
  });
});

describe('generateRecommendations — review-rejected', () => {
  it('triggers with high priority and the exact rejected count', () => {
    const recs = generateRecommendations(baseInputs({ submissionAnalytics: { ...EMPTY_SUBMISSIONS, rejected: 2, total: 2 } }));
    const rec = recs.find((r) => r.code === 'review-rejected');
    expect(rec?.relatedCount).toBe(2);
    expect(rec?.priority).toBe('high');
  });
});

describe('generateRecommendations — remove-duplicates', () => {
  it('triggers from duplicate pattern usage alone (organizational, low priority)', () => {
    const recs = generateRecommendations(baseInputs({ collectionAnalytics: { ...EMPTY_COLLECTIONS, duplicatePatternUsage: [{ assetId: 'a1', collectionCount: 2 }] } }));
    const rec = recs.find((r) => r.code === 'remove-duplicates');
    expect(rec?.priority).toBe('low');
    expect(rec?.relatedCount).toBe(1);
  });

  it('triggers from submission duplicate conflicts alone (real risk, high priority)', () => {
    const recs = generateRecommendations(baseInputs({ duplicateSubmissionConflictCount: 2 }));
    const rec = recs.find((r) => r.code === 'remove-duplicates');
    expect(rec?.priority).toBe('high');
    expect(rec?.relatedCount).toBe(2);
  });

  it('combines both signals into one recommendation with a summed relatedCount', () => {
    const recs = generateRecommendations(
      baseInputs({ collectionAnalytics: { ...EMPTY_COLLECTIONS, duplicatePatternUsage: [{ assetId: 'a1', collectionCount: 2 }] }, duplicateSubmissionConflictCount: 1 }),
    );
    const matching = recs.filter((r) => r.code === 'remove-duplicates');
    expect(matching).toHaveLength(1);
    expect(matching[0].relatedCount).toBe(2);
  });
});

describe('generateRecommendations — fill-empty-collections', () => {
  it('triggers with the exact empty-collection count', () => {
    const recs = generateRecommendations(
      baseInputs({ collectionAnalytics: { ...EMPTY_COLLECTIONS, emptyCollections: [{ collectionId: 'c1', name: 'Empty', patternCount: 0 }] } }),
    );
    const rec = recs.find((r) => r.code === 'fill-empty-collections');
    expect(rec?.relatedCount).toBe(1);
    expect(rec?.priority).toBe('low');
  });
});

describe('generateRecommendations — determinism', () => {
  it('produces byte-for-byte identical output across repeated calls with the same input', () => {
    const inputs = baseInputs({
      seoAnalytics: { ...EMPTY_SEO, averageScore: 40, missingMetadataCount: 5, sampleSize: 10 },
      submissionAnalytics: { ...EMPTY_SUBMISSIONS, ready: 2, rejected: 1, total: 3 },
      collectionAnalytics: { ...EMPTY_COLLECTIONS, emptyCollections: [{ collectionId: 'c1', name: 'X', patternCount: 0 }] },
      duplicateSubmissionConflictCount: 1,
    });
    const first = generateRecommendations(inputs);
    const second = generateRecommendations(inputs);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.length).toBeGreaterThan(1);
  });
});
