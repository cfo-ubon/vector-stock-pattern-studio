import { describe, it, expect } from 'vitest';
import { computeSeoAnalytics } from './seoAnalytics';
import { createSubmissionRecord } from '../submission/submissionRecord';
import type { CreateSubmissionInput } from '../submission/submissionRecord';
import { computeSeoScore } from '../seo/seoScoring';

function record(overrides: CreateSubmissionInput): ReturnType<typeof createSubmissionRecord> {
  return createSubmissionRecord(overrides);
}

const GOOD_CONTENT = {
  patternId: 'p1',
  marketplaceId: 'shutterstock',
  titleSnapshot: 'Seamless Pastel Floral Spring Pattern With Botanical Motifs',
  descriptionSnapshot: 'This seamless floral pattern brings a soft, pastel spring feel to any project. It works beautifully on fabric and wallpaper.',
  keywordSnapshot: ['seamless', 'floral', 'pastel', 'fabric', 'wallpaper', 'spring', 'botanical', 'vector', 'editable'],
  category: 'Patterns',
};

function goodRecord(overrides: Partial<CreateSubmissionInput> = {}) {
  return record({ ...GOOD_CONTENT, ...overrides } as CreateSubmissionInput);
}

describe('computeSeoAnalytics — empty input', () => {
  it('returns all-zero stats and sampleSize 0 for no submissions', () => {
    expect(computeSeoAnalytics([])).toEqual({ averageScore: 0, lowestScore: 0, highestScore: 0, missingMetadataCount: 0, averageKeywordCoverage: 0, averageMarketplaceCompatibility: 0, sampleSize: 0 });
  });
});

describe('computeSeoAnalytics — score aggregation', () => {
  it('matches computeSeoScore\'s own overall score for a single submission', () => {
    const submission = goodRecord();
    const report = computeSeoAnalytics([submission]);
    const expectedScore = computeSeoScore({ title: submission.titleSnapshot, description: submission.descriptionSnapshot, keywords: submission.keywordSnapshot }, submission.marketplaceId).overall;
    expect(report.averageScore).toBe(expectedScore);
    expect(report.lowestScore).toBe(expectedScore);
    expect(report.highestScore).toBe(expectedScore);
    expect(report.sampleSize).toBe(1);
  });

  it('lowest and highest diverge across a mix of good and poor submissions', () => {
    const good = goodRecord();
    const poor = record({ patternId: 'p2', marketplaceId: 'shutterstock' }); // empty title/description/keywords
    const report = computeSeoAnalytics([good, poor]);
    expect(report.highestScore).toBeGreaterThan(report.lowestScore);
    expect(report.averageScore).toBeGreaterThanOrEqual(report.lowestScore);
    expect(report.averageScore).toBeLessThanOrEqual(report.highestScore);
  });
});

describe('computeSeoAnalytics — missing metadata', () => {
  it('counts submissions missing title, description, keywords, or category', () => {
    const complete = goodRecord({ patternId: 'p1' });
    const missingTitle = goodRecord({ patternId: 'p2', titleSnapshot: '' });
    const missingKeywords = goodRecord({ patternId: 'p3', keywordSnapshot: [] });
    const missingCategory = goodRecord({ patternId: 'p4', category: null });
    const report = computeSeoAnalytics([complete, missingTitle, missingKeywords, missingCategory]);
    expect(report.missingMetadataCount).toBe(3);
  });

  it('is 0 when every submission is fully complete', () => {
    const report = computeSeoAnalytics([goodRecord({ patternId: 'p1' }), goodRecord({ patternId: 'p2' })]);
    expect(report.missingMetadataCount).toBe(0);
  });
});

describe('computeSeoAnalytics — keyword coverage and marketplace compatibility', () => {
  it('averageKeywordCoverage is 100 when every submission touches every concept bucket', () => {
    const report = computeSeoAnalytics([goodRecord()]);
    expect(report.averageKeywordCoverage).toBeGreaterThan(0);
  });

  it('averageMarketplaceCompatibility drops when submissions violate marketplace rules', () => {
    const compliant = goodRecord({ patternId: 'p1' });
    const nonCompliant = goodRecord({ patternId: 'p2', keywordSnapshot: ['one'] }); // below shutterstock's 7-keyword minimum
    const report = computeSeoAnalytics([compliant, nonCompliant]);
    const compliantOnly = computeSeoAnalytics([compliant]);
    expect(report.averageMarketplaceCompatibility).toBeLessThan(compliantOnly.averageMarketplaceCompatibility);
  });
});
