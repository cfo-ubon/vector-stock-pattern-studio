import { describe, it, expect } from 'vitest';
import { computeSubmissionStatistics } from './submissionStatistics';
import { createSubmissionRecord } from './submissionRecord';
import type { SubmissionRecord } from './submissionRecord';

function withStatus(patternId: string, marketplaceId: string, status: SubmissionRecord['status']): SubmissionRecord {
  return { ...createSubmissionRecord({ patternId, marketplaceId }), status };
}

describe('computeSubmissionStatistics', () => {
  it('reports all-zero counts for an empty list', () => {
    const stats = computeSubmissionStatistics([]);
    expect(stats.totalSubmissions).toBe(0);
    expect(stats.byStatus.DRAFT).toBe(0);
    expect(stats.byMarketplace).toEqual({});
  });

  it('counts totalSubmissions and byStatus correctly', () => {
    const records = [
      withStatus('p1', 'etsy', 'READY'),
      withStatus('p2', 'etsy', 'READY'),
      withStatus('p3', 'shutterstock', 'QUEUED'),
      withStatus('p4', 'shutterstock', 'SUBMITTED'),
      withStatus('p5', 'freepik', 'APPROVED'),
      withStatus('p6', 'freepik', 'REJECTED'),
    ];
    const stats = computeSubmissionStatistics(records);
    expect(stats.totalSubmissions).toBe(6);
    expect(stats.byStatus.READY).toBe(2);
    expect(stats.byStatus.QUEUED).toBe(1);
    expect(stats.byStatus.SUBMITTED).toBe(1);
    expect(stats.byStatus.APPROVED).toBe(1);
    expect(stats.byStatus.REJECTED).toBe(1);
    expect(stats.byStatus.DRAFT).toBe(0);
  });

  it('breaks totals down per marketplace', () => {
    const records = [withStatus('p1', 'etsy', 'READY'), withStatus('p2', 'etsy', 'QUEUED'), withStatus('p3', 'shutterstock', 'READY')];
    const stats = computeSubmissionStatistics(records);
    expect(stats.byMarketplace.etsy.total).toBe(2);
    expect(stats.byMarketplace.etsy.byStatus.READY).toBe(1);
    expect(stats.byMarketplace.etsy.byStatus.QUEUED).toBe(1);
    expect(stats.byMarketplace.shutterstock.total).toBe(1);
    expect(stats.byMarketplace.shutterstock.byStatus.READY).toBe(1);
  });
});
