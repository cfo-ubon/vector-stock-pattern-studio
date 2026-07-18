import { describe, it, expect } from 'vitest';
import { computeReadinessAnalytics } from './readinessAnalytics';
import { createPortfolioAsset } from '../domain/asset';
import { createSubmissionRecord } from '../submission/submissionRecord';
import type { PortfolioAsset } from '../domain/types';
import type { SubmissionRecord } from '../submission/submissionRecord';

function makeAsset(): PortfolioAsset {
  return createPortfolioAsset({ displayName: 'A', originalFilename: 'a.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
}

function record(patternId: string, status: SubmissionRecord['status']): SubmissionRecord {
  return { ...createSubmissionRecord({ patternId, marketplaceId: 'etsy' }), status };
}

describe('computeReadinessAnalytics — empty portfolio', () => {
  it('returns all-zero stats for no assets and no submissions', () => {
    expect(computeReadinessAnalytics([], [])).toEqual({ totalPatterns: 0, patternsWithSubmissions: 0, patternsWithoutSubmissions: 0, patternsReadyOrBeyond: 0, readinessRate: 0 });
  });
});

describe('computeReadinessAnalytics — with/without submissions', () => {
  it('counts patterns with and without any submission', () => {
    const a = makeAsset();
    const b = makeAsset();
    const c = makeAsset();
    const report = computeReadinessAnalytics([a, b, c], [record(a.assetId, 'DRAFT')]);
    expect(report.totalPatterns).toBe(3);
    expect(report.patternsWithSubmissions).toBe(1);
    expect(report.patternsWithoutSubmissions).toBe(2);
  });

  it('ignores submissions referencing a patternId not present in the catalog', () => {
    const a = makeAsset();
    const report = computeReadinessAnalytics([a], [record('stale-deleted-asset', 'DRAFT')]);
    expect(report.patternsWithSubmissions).toBe(0);
    expect(report.patternsWithoutSubmissions).toBe(1);
  });
});

describe('computeReadinessAnalytics — ready or beyond', () => {
  it('counts DRAFT/NEEDS_REVISION/REJECTED/ARCHIVED as NOT ready or beyond', () => {
    const a = makeAsset();
    const b = makeAsset();
    const c = makeAsset();
    const d = makeAsset();
    const assets = [a, b, c, d];
    const records = [record(a.assetId, 'DRAFT'), record(b.assetId, 'NEEDS_REVISION'), record(c.assetId, 'REJECTED'), record(d.assetId, 'ARCHIVED')];
    const report = computeReadinessAnalytics(assets, records);
    expect(report.patternsReadyOrBeyond).toBe(0);
  });

  it('counts READY/QUEUED/SUBMITTED/APPROVED as ready or beyond', () => {
    const a = makeAsset();
    const b = makeAsset();
    const c = makeAsset();
    const d = makeAsset();
    const assets = [a, b, c, d];
    const records = [record(a.assetId, 'READY'), record(b.assetId, 'QUEUED'), record(c.assetId, 'SUBMITTED'), record(d.assetId, 'APPROVED')];
    const report = computeReadinessAnalytics(assets, records);
    expect(report.patternsReadyOrBeyond).toBe(4);
    expect(report.readinessRate).toBe(100);
  });

  it('a pattern counts as ready-or-beyond if ANY of its submissions qualifies', () => {
    const a = makeAsset();
    const report = computeReadinessAnalytics([a], [record(a.assetId, 'DRAFT'), record(a.assetId, 'READY')]);
    expect(report.patternsReadyOrBeyond).toBe(1);
  });

  it('readinessRate is rounded to 1 decimal place', () => {
    const assets = [makeAsset(), makeAsset(), makeAsset()];
    const report = computeReadinessAnalytics(assets, [record(assets[0].assetId, 'READY')]);
    expect(report.readinessRate).toBe(33.3);
  });
});
