import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadBackupHistory,
  recordBackupCreated,
  recordRestoreCompleted,
  recordRestoreFailed,
  clearBackupHistory,
  HISTORY_ENTRY_LIMIT,
} from './backupHistoryStore';
import { buildCollectionBackup } from './backupBuilder';
import { clearCollectionsStore } from '../storage/collectionStore';
import { clearPortfolioStores } from '../storage/portfolioStore';
import type { BackupArchive } from './backupFormat';

beforeEach(async () => {
  localStorage.clear();
  await clearCollectionsStore();
  await clearPortfolioStores();
});

describe('backupHistoryStore', () => {
  it('is empty before anything is recorded', () => {
    expect(loadBackupHistory()).toEqual([]);
  });

  it('records a backup-created event', async () => {
    const archive = await buildCollectionBackup({ label: 'Weekly backup' });
    const entry = recordBackupCreated(archive);
    const history = loadBackupHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(entry);
    expect(history[0].kind).toBe('backup-created');
    expect(history[0].label).toBe('Weekly backup');
    expect(history[0].stats).toEqual(archive.stats);
  });

  it('records restore-completed and restore-failed events with their mode', async () => {
    const archive = await buildCollectionBackup();
    recordRestoreCompleted(archive, 'overwrite');
    recordRestoreFailed(archive, 'merge', 'checksum mismatch');
    const history = loadBackupHistory();
    expect(history.map((e) => e.kind).sort()).toEqual(['restore-completed', 'restore-failed']);
    const failed = history.find((e) => e.kind === 'restore-failed')!;
    expect(failed.restoreMode).toBe('merge');
    expect(failed.failureReason).toBe('checksum mismatch');
    const completed = history.find((e) => e.kind === 'restore-completed')!;
    expect(completed.restoreMode).toBe('overwrite');
    expect(completed.failureReason).toBeUndefined();
  });

  it('returns entries newest first', async () => {
    const archive = await buildCollectionBackup();
    const first = recordBackupCreated(archive);
    const second = recordBackupCreated({ ...archive, createdAt: archive.createdAt + 1 });
    const history = loadBackupHistory();
    expect(history[0].id).toBe(second.id);
    expect(history[1].id).toBe(first.id);
  });

  it('caps history at HISTORY_ENTRY_LIMIT entries, dropping the oldest', async () => {
    const archive = await buildCollectionBackup();
    for (let i = 0; i < HISTORY_ENTRY_LIMIT + 10; i++) {
      recordBackupCreated({ ...archive, createdAt: i });
    }
    const history = loadBackupHistory();
    expect(history).toHaveLength(HISTORY_ENTRY_LIMIT);
    // Newest-first: the most recently appended (highest createdAt) must survive.
    expect(history[0].archiveCreatedAt).toBe(HISTORY_ENTRY_LIMIT + 9);
    // The oldest entries (createdAt 0..9) must have been evicted.
    expect(history.some((e) => e.archiveCreatedAt < 10)).toBe(false);
  });

  it('clearBackupHistory empties the log', async () => {
    const archive = await buildCollectionBackup();
    recordBackupCreated(archive);
    expect(loadBackupHistory()).toHaveLength(1);
    clearBackupHistory();
    expect(loadBackupHistory()).toEqual([]);
  });

  it('survives corrupted localStorage content by returning an empty history', () => {
    localStorage.setItem('vsp-collection-backup-history', 'not json{{{');
    expect(loadBackupHistory()).toEqual([]);
  });

  it('ignores malformed entries mixed into otherwise-valid stored JSON', () => {
    localStorage.setItem(
      'vsp-collection-backup-history',
      JSON.stringify({ schemaVersion: 1, entries: [{ garbage: true }, { id: 'ok', kind: 'backup-created', recordedAt: 1, archiveCreatedAt: 1, stats: { collectionCount: 0, assetCount: 0, membershipCount: 0 } }] }),
    );
    const history = loadBackupHistory();
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe('ok');
  });

  it('does not persist the archive payload itself, only lightweight metadata', async () => {
    const archive: BackupArchive = await buildCollectionBackup();
    recordBackupCreated(archive);
    const raw = localStorage.getItem('vsp-collection-backup-history')!;
    expect(raw.includes(archive.payload)).toBe(false);
    expect(raw.includes(archive.checksum)).toBe(false);
  });
});
