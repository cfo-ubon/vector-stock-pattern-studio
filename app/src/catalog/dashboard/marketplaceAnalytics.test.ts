import { describe, it, expect } from 'vitest';
import { computeMarketplaceAnalytics } from './marketplaceAnalytics';
import { createSubmissionRecord } from '../submission/submissionRecord';
import type { SubmissionRecord } from '../submission/submissionRecord';

function record(patternId: string, marketplaceId: string, status: SubmissionRecord['status']): SubmissionRecord {
  return { ...createSubmissionRecord({ patternId, marketplaceId }), status };
}

describe('computeMarketplaceAnalytics', () => {
  it('returns an empty array for no submissions', () => {
    expect(computeMarketplaceAnalytics([])).toEqual([]);
  });

  it('lists distinct marketplaces sorted by id', () => {
    const records = [record('p1', 'shutterstock', 'DRAFT'), record('p2', 'etsy', 'DRAFT')];
    const report = computeMarketplaceAnalytics(records);
    expect(report.map((r) => r.marketplaceId)).toEqual(['etsy', 'shutterstock']);
  });

  it('counts patternsPlanned as distinct patterns, not raw record count', () => {
    const records = [record('p1', 'etsy', 'DRAFT'), record('p1', 'etsy', 'READY'), record('p2', 'etsy', 'DRAFT')];
    const report = computeMarketplaceAnalytics(records);
    expect(report[0].patternsPlanned).toBe(2); // p1 and p2, even though p1 has 2 records
  });

  it('counts ready/submitted/approved/rejected by current status', () => {
    const records = [record('p1', 'etsy', 'READY'), record('p2', 'etsy', 'SUBMITTED'), record('p3', 'etsy', 'APPROVED'), record('p4', 'etsy', 'REJECTED'), record('p5', 'etsy', 'DRAFT')];
    const report = computeMarketplaceAnalytics(records);
    expect(report[0]).toMatchObject({ ready: 1, submitted: 1, approved: 1, rejected: 1 });
  });

  it('approvalRate is null when there is no decided outcome yet', () => {
    const records = [record('p1', 'etsy', 'READY'), record('p2', 'etsy', 'SUBMITTED')];
    const report = computeMarketplaceAnalytics(records);
    expect(report[0].approvalRate).toBeNull();
  });

  it('approvalRate is computed as approved / (approved + rejected), as a percentage', () => {
    const records = [record('p1', 'etsy', 'APPROVED'), record('p2', 'etsy', 'APPROVED'), record('p3', 'etsy', 'APPROVED'), record('p4', 'etsy', 'REJECTED')];
    const report = computeMarketplaceAnalytics(records);
    expect(report[0].approvalRate).toBe(75);
  });

  it('keeps marketplaces fully independent', () => {
    const records = [record('p1', 'etsy', 'APPROVED'), record('p2', 'shutterstock', 'REJECTED')];
    const report = computeMarketplaceAnalytics(records);
    const etsy = report.find((r) => r.marketplaceId === 'etsy')!;
    const shutterstock = report.find((r) => r.marketplaceId === 'shutterstock')!;
    expect(etsy.approvalRate).toBe(100);
    expect(shutterstock.approvalRate).toBe(0);
  });
});
