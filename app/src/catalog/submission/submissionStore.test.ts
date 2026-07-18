import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadSubmissions,
  getSubmission,
  countSubmissions,
  putSubmission,
  putSubmissionsBulk,
  deleteSubmission,
  clearSubmissionStore,
} from './submissionStore';
import { createSubmissionRecord } from './submissionRecord';

beforeEach(() => {
  localStorage.clear();
});

describe('submissionStore', () => {
  it('is empty before anything is written', () => {
    expect(loadSubmissions()).toEqual([]);
    expect(countSubmissions()).toBe(0);
  });

  it('putSubmission inserts a new record and is retrievable by id', () => {
    const record = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy' });
    putSubmission(record);
    expect(getSubmission(record.submissionId)).toEqual(record);
    expect(countSubmissions()).toBe(1);
  });

  it('putSubmission replaces an existing record with the same id (upsert)', () => {
    const record = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy' });
    putSubmission(record);
    const updated = { ...record, titleSnapshot: 'Updated Title' };
    putSubmission(updated);
    expect(countSubmissions()).toBe(1);
    expect(getSubmission(record.submissionId)?.titleSnapshot).toBe('Updated Title');
  });

  it('putSubmissionsBulk upserts many records in one call', () => {
    const records = [
      createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy' }),
      createSubmissionRecord({ patternId: 'p2', marketplaceId: 'shutterstock' }),
    ];
    putSubmissionsBulk(records);
    expect(countSubmissions()).toBe(2);
    expect(loadSubmissions().map((r) => r.submissionId).sort()).toEqual(records.map((r) => r.submissionId).sort());
  });

  it('deleteSubmission removes exactly the targeted record', () => {
    const a = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy' });
    const b = createSubmissionRecord({ patternId: 'p2', marketplaceId: 'shutterstock' });
    putSubmissionsBulk([a, b]);
    deleteSubmission(a.submissionId);
    expect(getSubmission(a.submissionId)).toBeUndefined();
    expect(getSubmission(b.submissionId)).toEqual(b);
    expect(countSubmissions()).toBe(1);
  });

  it('clearSubmissionStore empties everything', () => {
    putSubmission(createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy' }));
    clearSubmissionStore();
    expect(loadSubmissions()).toEqual([]);
  });

  it('survives corrupted localStorage content by returning an empty store', () => {
    localStorage.setItem('vsp-submission-center-records', 'not json{{{');
    expect(loadSubmissions()).toEqual([]);
  });

  it('ignores malformed entries mixed into otherwise-valid stored JSON', () => {
    localStorage.setItem(
      'vsp-submission-center-records',
      JSON.stringify({ schemaVersion: 1, records: [{ garbage: true }, createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy' })] }),
    );
    expect(loadSubmissions()).toHaveLength(1);
  });

  it('is isolated from other localStorage keys (e.g. backup history)', () => {
    localStorage.setItem('vsp-collection-backup-history', JSON.stringify({ schemaVersion: 1, entries: [{ unrelated: true }] }));
    putSubmission(createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy' }));
    expect(countSubmissions()).toBe(1);
    expect(localStorage.getItem('vsp-collection-backup-history')).not.toBeNull();
  });
});
