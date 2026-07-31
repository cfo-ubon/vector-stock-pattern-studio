import { describe, it, expect, beforeEach } from 'vitest';
import { clearMarketSnapshots } from '../storage/marketSnapshotStore';
import {
  saveSnapshot,
  duplicateSnapshot,
  archiveSnapshot,
  compareSnapshots,
  exportSnapshotAsJson,
  importSnapshotFromJson,
  getMostRecentSnapshotForOfflineUse,
  InvalidSnapshotImportError,
} from './snapshotService';

beforeEach(async () => {
  await clearMarketSnapshots();
});

describe('saveSnapshot', () => {
  it('creates and persists a snapshot in one call', async () => {
    const snapshot = await saveSnapshot({ researchDateRange: { from: 0, to: 1000 }, evidenceRefs: ['OBS-1'], now: 1000 });
    const offline = await getMostRecentSnapshotForOfflineUse(1000);
    expect(offline.snapshot?.id).toBe(snapshot.id);
  });
});

describe('duplicateSnapshot', () => {
  it('duplicates a saved snapshot as a new independent record', async () => {
    const original = await saveSnapshot({ researchDateRange: { from: 0, to: 1000 }, evidenceRefs: ['OBS-1'], keywords: ['botanical'], now: 1000 });
    const copy = await duplicateSnapshot(original.id, 5000);
    expect(copy.id).not.toBe(original.id);
    expect(copy.keywords).toEqual(['botanical']);
  });

  it('throws for a snapshot id that does not exist', async () => {
    await expect(duplicateSnapshot('SNAP-does-not-exist')).rejects.toThrow();
  });
});

describe('archiveSnapshot', () => {
  it('marks a snapshot archived without deleting it', async () => {
    const snapshot = await saveSnapshot({ researchDateRange: { from: 0, to: 1000 }, evidenceRefs: ['OBS-1'], now: 1000 });
    const archived = await archiveSnapshot(snapshot.id);
    expect(archived.archived).toBe(true);
    // Archived snapshots are excluded from "most recent for offline use" but still exist.
    const offline = await getMostRecentSnapshotForOfflineUse(1000);
    expect(offline.classification).toBe('NO_DATA');
  });
});

describe('compareSnapshots', () => {
  it('diffs two real snapshots field by field, not a fabricated similarity score', async () => {
    const a = await saveSnapshot({ researchDateRange: { from: 0, to: 1000 }, evidenceRefs: ['OBS-1'], keywords: ['botanical', 'floral'], observedDemand: 'low', now: 1000 });
    const b = await saveSnapshot({ researchDateRange: { from: 0, to: 1000 }, evidenceRefs: ['OBS-2'], keywords: ['floral', 'geometric'], observedDemand: 'high', now: 2000 });
    const comparison = await compareSnapshots(a.id, b.id);
    expect(comparison.addedKeywords).toEqual(['geometric']);
    expect(comparison.removedKeywords).toEqual(['botanical']);
    expect(comparison.demandChanged).toBe(true);
  });
});

describe('exportSnapshotAsJson / importSnapshotFromJson', () => {
  it('round-trips a snapshot through export then import, as a new independent record', async () => {
    const original = await saveSnapshot({ researchDateRange: { from: 0, to: 1000 }, evidenceRefs: ['OBS-1'], keywords: ['minimal'], now: 1000 });
    const json = exportSnapshotAsJson(original);
    const imported = await importSnapshotFromJson(json, 9000);
    expect(imported.id).not.toBe(original.id);
    expect(imported.keywords).toEqual(['minimal']);
    expect(imported.createdAt).toBe(9000);
  });

  it('rejects invalid JSON', async () => {
    await expect(importSnapshotFromJson('{not valid json')).rejects.toThrow(InvalidSnapshotImportError);
  });

  it('rejects well-formed JSON that is not a valid snapshot', async () => {
    await expect(importSnapshotFromJson(JSON.stringify({ hello: 'world' }))).rejects.toThrow(InvalidSnapshotImportError);
  });
});

describe('getMostRecentSnapshotForOfflineUse', () => {
  it('reports NO_DATA honestly when nothing has ever been saved', async () => {
    const result = await getMostRecentSnapshotForOfflineUse(1000);
    expect(result.classification).toBe('NO_DATA');
    expect(result.snapshot).toBeNull();
    expect(result.message).toContain('No verified live market data is available');
  });

  it('returns the most recently created non-archived snapshot with a dated, honest message', async () => {
    await saveSnapshot({ researchDateRange: { from: 0, to: 1000 }, evidenceRefs: ['OBS-1'], now: 1000 });
    const newer = await saveSnapshot({ researchDateRange: { from: 0, to: 2000 }, evidenceRefs: ['OBS-2'], now: 2000 });
    const now = 2000 + 3 * 24 * 60 * 60 * 1000;
    const result = await getMostRecentSnapshotForOfflineUse(now);
    expect(result.classification).toBe('SAVED_SNAPSHOT');
    expect(result.snapshot?.id).toBe(newer.id);
    expect(result.freshnessLabel).toBe('3 days old');
    expect(result.message).toContain('saved snapshot dated');
  });
});
