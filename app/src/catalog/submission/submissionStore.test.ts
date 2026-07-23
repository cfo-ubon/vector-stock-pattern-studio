import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadSubmissions,
  getSubmission,
  countSubmissions,
  putSubmission,
  putSubmissionsBulk,
  deleteSubmission,
  clearSubmissionStore,
  seedSubmissionStoreForTest,
  resetSubmissionStoreForTest,
  forgetInMemoryStateForTest,
  whenSubmissionStoreHydrated,
} from './submissionStore';
import { createSubmissionRecord } from './submissionRecord';

// Build 026 note: this store's backing persistence moved from a single
// localStorage key to IndexedDB (BUILD_026_AUDIT.md Section 5), but every
// read/write function below stays SYNCHRONOUS — see submissionStore.ts's
// own header comment for the in-memory-cache-plus-async-persist design.
// `seedSubmissionStoreForTest` gives every test below the same
// deterministic, synchronous starting point the old localStorage-backed
// tests had, without needing to await IndexedDB in every single `it()`.

beforeEach(async () => {
  localStorage.clear();
  await resetSubmissionStoreForTest();
});

describe('submissionStore (synchronous cache behavior)', () => {
  it('is empty before anything is written', () => {
    seedSubmissionStoreForTest([]);
    expect(loadSubmissions()).toEqual([]);
    expect(countSubmissions()).toBe(0);
  });

  it('putSubmission inserts a new record and is retrievable by id', () => {
    seedSubmissionStoreForTest([]);
    const record = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy' });
    putSubmission(record);
    expect(getSubmission(record.submissionId)).toEqual(record);
    expect(countSubmissions()).toBe(1);
  });

  it('putSubmission replaces an existing record with the same id (upsert)', () => {
    seedSubmissionStoreForTest([]);
    const record = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy' });
    putSubmission(record);
    const updated = { ...record, titleSnapshot: 'Updated Title' };
    putSubmission(updated);
    expect(countSubmissions()).toBe(1);
    expect(getSubmission(record.submissionId)?.titleSnapshot).toBe('Updated Title');
  });

  it('putSubmissionsBulk upserts many records in one call', () => {
    seedSubmissionStoreForTest([]);
    const records = [
      createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy' }),
      createSubmissionRecord({ patternId: 'p2', marketplaceId: 'shutterstock' }),
    ];
    putSubmissionsBulk(records);
    expect(countSubmissions()).toBe(2);
    expect(loadSubmissions().map((r) => r.submissionId).sort()).toEqual(records.map((r) => r.submissionId).sort());
  });

  it('deleteSubmission removes exactly the targeted record', () => {
    seedSubmissionStoreForTest([]);
    const a = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy' });
    const b = createSubmissionRecord({ patternId: 'p2', marketplaceId: 'shutterstock' });
    putSubmissionsBulk([a, b]);
    deleteSubmission(a.submissionId);
    expect(getSubmission(a.submissionId)).toBeUndefined();
    expect(getSubmission(b.submissionId)).toEqual(b);
    expect(countSubmissions()).toBe(1);
  });

  it('clearSubmissionStore empties everything', () => {
    seedSubmissionStoreForTest([]);
    putSubmission(createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy' }));
    clearSubmissionStore();
    expect(loadSubmissions()).toEqual([]);
  });

  it('seedSubmissionStoreForTest normalizes seeded records the same way hydration would', () => {
    const record = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy' });
    // Simulate an older-schema record missing a field normalizeSubmissionRecord fills in.
    const legacyShaped = { ...record, notes: undefined } as unknown as typeof record;
    seedSubmissionStoreForTest([legacyShaped]);
    expect(getSubmission(record.submissionId)?.notes).toBe('');
  });
});

describe('submissionStore (IndexedDB persistence + hydration/migration)', () => {
  it('persists a put record to IndexedDB and a fresh hydration reads it back', async () => {
    await whenSubmissionStoreHydrated();
    const record = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy' });
    putSubmission(record);
    // Give the fire-and-forget persist a tick to complete.
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Simulate a fresh page load: forget in-memory state only (IndexedDB
    // itself must be left untouched — that's the data being read back).
    forgetInMemoryStateForTest();
    await whenSubmissionStoreHydrated();
    expect(getSubmission(record.submissionId)).toEqual(record);
  });

  it('migrates legacy localStorage records into IndexedDB exactly once, without deleting the localStorage key', async () => {
    const legacyRecord = createSubmissionRecord({ patternId: 'legacy-1', marketplaceId: 'shutterstock' });
    localStorage.setItem('vsp-submission-center-records', JSON.stringify({ schemaVersion: 1, records: [legacyRecord] }));

    await whenSubmissionStoreHydrated();
    expect(getSubmission(legacyRecord.submissionId)).toEqual(legacyRecord);
    // The migration never deletes the legacy key (crash-safety — see module doc comment).
    expect(localStorage.getItem('vsp-submission-center-records')).not.toBeNull();

    // A second hydration cycle (simulating a second page load against the SAME
    // IndexedDB, which now already has the migrated record) must not duplicate
    // anything — the "IndexedDB already has data, don't re-migrate" branch.
    forgetInMemoryStateForTest();
    await whenSubmissionStoreHydrated();
    expect(countSubmissions()).toBe(1);
  });

  it('prefers existing IndexedDB data over the legacy localStorage key once migration has already happened', async () => {
    const legacyRecord = createSubmissionRecord({ patternId: 'legacy-1', marketplaceId: 'shutterstock' });
    localStorage.setItem('vsp-submission-center-records', JSON.stringify({ schemaVersion: 1, records: [legacyRecord] }));
    await whenSubmissionStoreHydrated();

    // Now the localStorage key is stale/out of date relative to IndexedDB — simulate an
    // edit made after migration that never touches localStorage (as real usage would).
    const updated = { ...legacyRecord, titleSnapshot: 'Edited after migration' };
    putSubmission(updated);
    await new Promise((resolve) => setTimeout(resolve, 20));

    forgetInMemoryStateForTest();
    await whenSubmissionStoreHydrated();
    expect(getSubmission(legacyRecord.submissionId)?.titleSnapshot).toBe('Edited after migration');
  });

  it('ignores malformed entries mixed into otherwise-valid legacy localStorage JSON', async () => {
    const valid = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy' });
    localStorage.setItem(
      'vsp-submission-center-records',
      JSON.stringify({ schemaVersion: 1, records: [{ garbage: true }, valid] }),
    );
    await whenSubmissionStoreHydrated();
    expect(countSubmissions()).toBe(1);
    expect(getSubmission(valid.submissionId)).toEqual(valid);
  });

  it('survives corrupted legacy localStorage content by hydrating an empty store', async () => {
    localStorage.setItem('vsp-submission-center-records', 'not json{{{');
    await whenSubmissionStoreHydrated();
    expect(loadSubmissions()).toEqual([]);
  });

  it('is isolated from other localStorage keys (e.g. backup history)', () => {
    seedSubmissionStoreForTest([]);
    localStorage.setItem('vsp-collection-backup-history', JSON.stringify({ schemaVersion: 1, entries: [{ unrelated: true }] }));
    putSubmission(createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy' }));
    expect(countSubmissions()).toBe(1);
    expect(localStorage.getItem('vsp-collection-backup-history')).not.toBeNull();
  });

  it('whenSubmissionStoreHydrated resolves the same settled promise on repeated calls (idempotent)', async () => {
    const first = whenSubmissionStoreHydrated();
    const second = whenSubmissionStoreHydrated();
    expect(first).toBe(second);
    await first;
  });
});
