import { describe, it, expect } from 'vitest';
import { detectDuplicateSubmission } from './submissionDuplicateDetection';
import { createSubmissionRecord } from './submissionRecord';
import type { SubmissionRecord } from './submissionRecord';

function withStatus(record: SubmissionRecord, status: SubmissionRecord['status']): SubmissionRecord {
  return { ...record, status };
}

describe('detectDuplicateSubmission', () => {
  it('reports no conflict when there are no existing submissions', () => {
    const result = detectDuplicateSubmission({ patternId: 'p1', marketplaceId: 'etsy', version: 1 }, []);
    expect(result.isDuplicate).toBe(false);
    expect(result.conflicts).toEqual([]);
  });

  it('detects same-version: identical pattern+marketplace+version already exists', () => {
    const existing = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy', version: 1 });
    const result = detectDuplicateSubmission({ patternId: 'p1', marketplaceId: 'etsy', version: 1 }, [existing]);
    expect(result.isDuplicate).toBe(true);
    expect(result.conflicts).toEqual([{ reason: 'same-version', existingSubmissionId: existing.submissionId }]);
  });

  it('does not flag same-version for a different version number', () => {
    const existing = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy', version: 1 });
    const result = detectDuplicateSubmission({ patternId: 'p1', marketplaceId: 'etsy', version: 2 }, [existing]);
    expect(result.conflicts.some((c) => c.reason === 'same-version')).toBe(false);
  });

  it('detects already-approved regardless of version', () => {
    const approved = withStatus(createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy', version: 1 }), 'APPROVED');
    const result = detectDuplicateSubmission({ patternId: 'p1', marketplaceId: 'etsy', version: 2 }, [approved]);
    expect(result.isDuplicate).toBe(true);
    expect(result.conflicts).toEqual([{ reason: 'already-approved', existingSubmissionId: approved.submissionId }]);
  });

  it('detects already-submitted regardless of version', () => {
    const submitted = withStatus(createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy', version: 1 }), 'SUBMITTED');
    const result = detectDuplicateSubmission({ patternId: 'p1', marketplaceId: 'etsy', version: 2 }, [submitted]);
    expect(result.isDuplicate).toBe(true);
    expect(result.conflicts).toEqual([{ reason: 'already-submitted', existingSubmissionId: submitted.submissionId }]);
  });

  it('a single existing record can trigger multiple simultaneous reasons', () => {
    const submitted = withStatus(createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy', version: 1 }), 'SUBMITTED');
    const result = detectDuplicateSubmission({ patternId: 'p1', marketplaceId: 'etsy', version: 1 }, [submitted]);
    expect(result.conflicts.map((c) => c.reason).sort()).toEqual(['already-submitted', 'same-version']);
  });

  it('never flags a different marketplace as a conflict', () => {
    const existing = withStatus(createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy', version: 1 }), 'APPROVED');
    const result = detectDuplicateSubmission({ patternId: 'p1', marketplaceId: 'shutterstock', version: 1 }, [existing]);
    expect(result.isDuplicate).toBe(false);
  });

  it('never flags a different pattern as a conflict', () => {
    const existing = withStatus(createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy', version: 1 }), 'APPROVED');
    const result = detectDuplicateSubmission({ patternId: 'p2', marketplaceId: 'etsy', version: 1 }, [existing]);
    expect(result.isDuplicate).toBe(false);
  });

  it('excludes the candidate itself via submissionId, so re-validating an existing record never conflicts with itself', () => {
    const existing = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy', version: 1 });
    const result = detectDuplicateSubmission({ patternId: 'p1', marketplaceId: 'etsy', version: 1, submissionId: existing.submissionId }, [existing]);
    expect(result.isDuplicate).toBe(false);
  });

  it('a Draft or Rejected existing record alone does not trigger already-approved/already-submitted', () => {
    const draft = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy', version: 2 });
    const rejected = withStatus(createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy', version: 1 }), 'REJECTED');
    const result = detectDuplicateSubmission({ patternId: 'p1', marketplaceId: 'etsy', version: 3 }, [draft, rejected]);
    expect(result.isDuplicate).toBe(false);
  });

  describe('same-production-asset (Build 026)', () => {
    it('flags same-production-asset when a different patternId shares productionAssetId at the same marketplace', () => {
      const existing = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy', version: 1, productionAssetId: 'PAID-abc' });
      const result = detectDuplicateSubmission(
        { patternId: 'p2-renamed-copy', marketplaceId: 'etsy', version: 1, productionAssetId: 'PAID-abc' },
        [existing],
      );
      expect(result.isDuplicate).toBe(true);
      expect(result.conflicts).toEqual([{ reason: 'same-production-asset', existingSubmissionId: existing.submissionId }]);
    });

    it('does not flag same-production-asset for a different marketplace', () => {
      const existing = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy', version: 1, productionAssetId: 'PAID-abc' });
      const result = detectDuplicateSubmission(
        { patternId: 'p2', marketplaceId: 'shutterstock', version: 1, productionAssetId: 'PAID-abc' },
        [existing],
      );
      expect(result.isDuplicate).toBe(false);
    });

    it('does not flag same-production-asset when productionAssetId differs', () => {
      const existing = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy', version: 1, productionAssetId: 'PAID-abc' });
      const result = detectDuplicateSubmission(
        { patternId: 'p2', marketplaceId: 'etsy', version: 1, productionAssetId: 'PAID-different' },
        [existing],
      );
      expect(result.isDuplicate).toBe(false);
    });

    it('never matches on null productionAssetId -- null means unknown, not same', () => {
      const existing = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy', version: 1 });
      const result = detectDuplicateSubmission({ patternId: 'p2', marketplaceId: 'etsy', version: 1, productionAssetId: null }, [existing]);
      expect(result.isDuplicate).toBe(false);
    });

    it('does not double-report via same-production-asset when patternId is also identical (already-covered by the other rules)', () => {
      const existing = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy', version: 1, productionAssetId: 'PAID-abc' });
      const result = detectDuplicateSubmission(
        { patternId: 'p1', marketplaceId: 'etsy', version: 1, productionAssetId: 'PAID-abc' },
        [existing],
      );
      expect(result.conflicts.some((c) => c.reason === 'same-production-asset')).toBe(false);
      expect(result.conflicts.some((c) => c.reason === 'same-version')).toBe(true);
    });
  });
});
