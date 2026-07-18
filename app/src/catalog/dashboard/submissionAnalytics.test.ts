import { describe, it, expect } from 'vitest';
import { computeSubmissionAnalytics } from './submissionAnalytics';
import { createSubmissionRecord } from '../submission/submissionRecord';
import type { SubmissionRecord } from '../submission/submissionRecord';

function withStatus(marketplaceId: string, status: SubmissionRecord['status']): SubmissionRecord {
  return { ...createSubmissionRecord({ patternId: 'p1', marketplaceId }), status };
}

describe('computeSubmissionAnalytics', () => {
  it('returns all-zero counts for an empty list', () => {
    const report = computeSubmissionAnalytics([]);
    expect(report.total).toBe(0);
    expect(report.draft).toBe(0);
    expect(report.byMarketplace).toEqual({});
  });

  it('counts every one of the 8 statuses under its own field', () => {
    const records = [
      withStatus('etsy', 'DRAFT'),
      withStatus('etsy', 'READY'),
      withStatus('etsy', 'QUEUED'),
      withStatus('etsy', 'SUBMITTED'),
      withStatus('etsy', 'APPROVED'),
      withStatus('etsy', 'REJECTED'),
      withStatus('etsy', 'NEEDS_REVISION'),
      withStatus('etsy', 'ARCHIVED'),
    ];
    const report = computeSubmissionAnalytics(records);
    expect(report).toMatchObject({ draft: 1, ready: 1, queued: 1, submitted: 1, approved: 1, rejected: 1, needsRevision: 1, archived: 1, total: 8 });
  });

  it('passes through the same byMarketplace breakdown computeSubmissionStatistics produces', () => {
    const records = [withStatus('etsy', 'READY'), withStatus('etsy', 'READY'), withStatus('shutterstock', 'DRAFT')];
    const report = computeSubmissionAnalytics(records);
    expect(report.byMarketplace.etsy.total).toBe(2);
    expect(report.byMarketplace.etsy.byStatus.READY).toBe(2);
    expect(report.byMarketplace.shutterstock.total).toBe(1);
  });
});
