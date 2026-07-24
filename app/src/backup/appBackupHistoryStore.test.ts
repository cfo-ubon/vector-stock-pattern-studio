import { describe, it, expect, beforeEach } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import {
  addBackupHistoryRecord,
  listBackupHistory,
  getBackupHistoryRecord,
  deleteBackupHistoryRecord,
  pruneBackupHistory,
  clearBackupHistoryStore,
} from './appBackupHistoryStore';
import type { AppBackupHistoryRecord } from './appBackupHistoryStore';

beforeEach(async () => {
  await clearBackupHistoryStore();
});

function makeRecord(overrides: Partial<AppBackupHistoryRecord> = {}): AppBackupHistoryRecord {
  return {
    historyId: overrides.historyId ?? `h-${Math.random().toString(36).slice(2)}`,
    createdAt: overrides.createdAt ?? Date.now(),
    fileName: 'backup.vspsb',
    destination: 'Test Device',
    result: 'success',
    durationMs: 1000,
    trigger: 'manual',
    dbVersion: 7,
    fileCount: 5,
    assetFileCount: 2,
    originalSize: 1000,
    compressedSize: 400,
    blob: new NodeBlob(['test']) as unknown as Blob,
    ...overrides,
  };
}

describe('addBackupHistoryRecord / listBackupHistory', () => {
  it('lists records newest-first', async () => {
    await addBackupHistoryRecord(makeRecord({ historyId: 'a', createdAt: 1000 }));
    await addBackupHistoryRecord(makeRecord({ historyId: 'b', createdAt: 3000 }));
    await addBackupHistoryRecord(makeRecord({ historyId: 'c', createdAt: 2000 }));

    const list = await listBackupHistory();
    expect(list.map((r) => r.historyId)).toEqual(['b', 'c', 'a']);
  });

  it('round-trips the stored archive Blob', async () => {
    await addBackupHistoryRecord(makeRecord({ historyId: 'a', blob: new NodeBlob(['payload content']) as unknown as Blob }));
    const record = await getBackupHistoryRecord('a');
    expect(record).toBeDefined();
    const text = await record!.blob!.arrayBuffer();
    expect(new TextDecoder().decode(text)).toBe('payload content');
  });

  it('supports a null blob for a failed backup attempt', async () => {
    await addBackupHistoryRecord(makeRecord({ historyId: 'failed-1', result: 'failed', blob: null, errorMessage: 'disk full' }));
    const record = await getBackupHistoryRecord('failed-1');
    expect(record?.result).toBe('failed');
    expect(record?.blob).toBeNull();
  });
});

describe('deleteBackupHistoryRecord', () => {
  it('removes exactly the targeted record', async () => {
    await addBackupHistoryRecord(makeRecord({ historyId: 'a' }));
    await addBackupHistoryRecord(makeRecord({ historyId: 'b' }));
    await deleteBackupHistoryRecord('a');
    const list = await listBackupHistory();
    expect(list.map((r) => r.historyId)).toEqual(['b']);
  });
});

describe('pruneBackupHistory', () => {
  it('does nothing for "unlimited" retention', async () => {
    for (let i = 0; i < 10; i++) await addBackupHistoryRecord(makeRecord({ historyId: `r${i}`, createdAt: i }));
    const deleted = await pruneBackupHistory('unlimited');
    expect(deleted).toBe(0);
    expect(await listBackupHistory()).toHaveLength(10);
  });

  it('deletes the oldest successful backups beyond the limit', async () => {
    for (let i = 0; i < 7; i++) await addBackupHistoryRecord(makeRecord({ historyId: `r${i}`, createdAt: i }));
    const deleted = await pruneBackupHistory(5);
    expect(deleted).toBe(2);
    const remaining = await listBackupHistory();
    expect(remaining).toHaveLength(5);
    // the two oldest (r0, r1) should be gone; the five newest kept
    expect(remaining.map((r) => r.historyId).sort()).toEqual(['r2', 'r3', 'r4', 'r5', 'r6'].sort());
  });

  it('does not delete anything when the count is already within the limit', async () => {
    for (let i = 0; i < 3; i++) await addBackupHistoryRecord(makeRecord({ historyId: `r${i}`, createdAt: i }));
    const deleted = await pruneBackupHistory(5);
    expect(deleted).toBe(0);
  });

  it('never prunes safety-backup or failed records, even when they push the count over the limit', async () => {
    await addBackupHistoryRecord(makeRecord({ historyId: 'safety-1', trigger: 'safety', createdAt: 1 }));
    await addBackupHistoryRecord(makeRecord({ historyId: 'failed-1', result: 'failed', blob: null, createdAt: 2 }));
    for (let i = 0; i < 6; i++) await addBackupHistoryRecord(makeRecord({ historyId: `manual-${i}`, createdAt: 100 + i }));

    const deleted = await pruneBackupHistory(5);
    const remaining = await listBackupHistory();
    expect(remaining.some((r) => r.historyId === 'safety-1')).toBe(true);
    expect(remaining.some((r) => r.historyId === 'failed-1')).toBe(true);
    // 6 manual backups pruned to 5 -> 1 deleted, safety/failed untouched
    expect(deleted).toBe(1);
  });
});
