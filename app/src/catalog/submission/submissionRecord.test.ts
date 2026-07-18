import { describe, it, expect } from 'vitest';
import {
  createSubmissionRecord,
  normalizeSubmissionRecord,
  isValidSubmissionRecord,
  isValidSubmissionId,
  InvalidSubmissionInputError,
  SUBMISSION_SCHEMA_VERSION,
} from './submissionRecord';

describe('createSubmissionRecord', () => {
  it('produces a well-shaped DRAFT record with sensible defaults', () => {
    const now = new Date(2026, 6, 18).getTime();
    const record = createSubmissionRecord({ patternId: 'VSP-20260718-ABCDEF', marketplaceId: 'shutterstock', now });
    expect(isValidSubmissionId(record.submissionId)).toBe(true);
    expect(record.patternId).toBe('VSP-20260718-ABCDEF');
    expect(record.marketplaceId).toBe('shutterstock');
    expect(record.status).toBe('DRAFT');
    expect(record.version).toBe(1);
    expect(record.titleSnapshot).toBe('');
    expect(record.descriptionSnapshot).toBe('');
    expect(record.keywordSnapshot).toEqual([]);
    expect(record.category).toBeNull();
    expect(record.notes).toBe('');
    expect(record.submittedAt).toBeNull();
    expect(record.createdAt).toBe(now);
    expect(record.updatedAt).toBe(now);
    expect(record.schemaVersion).toBe(SUBMISSION_SCHEMA_VERSION);
    expect(record.statusHistory).toEqual([{ status: 'DRAFT', changedAt: now }]);
  });

  it('carries every optional field through when provided', () => {
    const record = createSubmissionRecord({
      patternId: 'p1',
      marketplaceId: 'etsy',
      titleSnapshot: 'Floral Seamless Pattern',
      descriptionSnapshot: 'A lush spring floral pattern.',
      keywordSnapshot: ['floral', 'spring', 'seamless'],
      category: 'Patterns',
      notes: 'Second attempt after rejection',
      version: 2,
    });
    expect(record.titleSnapshot).toBe('Floral Seamless Pattern');
    expect(record.descriptionSnapshot).toBe('A lush spring floral pattern.');
    expect(record.keywordSnapshot).toEqual(['floral', 'spring', 'seamless']);
    expect(record.category).toBe('Patterns');
    expect(record.notes).toBe('Second attempt after rejection');
    expect(record.version).toBe(2);
  });

  it('rejects an empty patternId or marketplaceId', () => {
    expect(() => createSubmissionRecord({ patternId: '', marketplaceId: 'etsy' })).toThrow(InvalidSubmissionInputError);
    expect(() => createSubmissionRecord({ patternId: '  ', marketplaceId: 'etsy' })).toThrow(InvalidSubmissionInputError);
    expect(() => createSubmissionRecord({ patternId: 'p1', marketplaceId: '' })).toThrow(InvalidSubmissionInputError);
  });

  it('generates a unique id on every call', () => {
    const a = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy' });
    const b = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy' });
    expect(a.submissionId).not.toBe(b.submissionId);
  });
});

describe('isValidSubmissionId', () => {
  it('accepts the SUB-YYYYMMDD-XXXXXX shape', () => {
    const record = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy' });
    expect(isValidSubmissionId(record.submissionId)).toBe(true);
  });
  it('rejects unrelated strings', () => {
    expect(isValidSubmissionId('not-a-submission-id')).toBe(false);
    expect(isValidSubmissionId('COL-20260718-ABCDEF')).toBe(false);
    expect(isValidSubmissionId(42)).toBe(false);
  });
});

describe('normalizeSubmissionRecord', () => {
  it('fills in missing fields with safe defaults, mirroring normalizeCollection', () => {
    const bare = { submissionId: 'SUB-20260718-AAAAAA', patternId: 'p1', marketplaceId: 'etsy', status: 'DRAFT', createdAt: 1, updatedAt: 1, version: 1 } as never;
    const normalized = normalizeSubmissionRecord(bare);
    expect(normalized.submittedAt).toBeNull();
    expect(normalized.titleSnapshot).toBe('');
    expect(normalized.descriptionSnapshot).toBe('');
    expect(normalized.keywordSnapshot).toEqual([]);
    expect(normalized.category).toBeNull();
    expect(normalized.notes).toBe('');
    expect(normalized.statusHistory).toEqual([]);
    expect(normalized.schemaVersion).toBe(SUBMISSION_SCHEMA_VERSION);
  });

  it('leaves a fully-populated record unchanged', () => {
    const record = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy', titleSnapshot: 'X' });
    expect(normalizeSubmissionRecord(record)).toEqual(record);
  });
});

describe('isValidSubmissionRecord', () => {
  it('accepts a real record', () => {
    expect(isValidSubmissionRecord(createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy' }))).toBe(true);
  });
  it('rejects garbage', () => {
    expect(isValidSubmissionRecord(null)).toBe(false);
    expect(isValidSubmissionRecord({})).toBe(false);
    expect(isValidSubmissionRecord({ submissionId: 'x' })).toBe(false);
  });
});
