// Application Backup System — Backup History.
//
// One record per backup ever created or restored from, stored in its own
// IndexedDB store (`appBackupHistory`, added in `storage/db.ts` DB_VERSION
// 7) — including the archive's own Blob, so "Restore" from the Backup
// History tab works directly without the user having to re-locate the
// original `.vspsb` file on disk. Retention pruning (5/10/20/Unlimited,
// oldest-first) is applied by the caller after every new record via
// `pruneBackupHistory`, matching `autoBackupSettings.ts`'s `retentionLimit`.

import { openDb, requestAsPromise, APP_BACKUP_HISTORY_STORE } from '../storage/db';
import type { AutoBackupRetention } from './autoBackupSettings';
import { retentionLimit } from './autoBackupSettings';

export type AppBackupHistoryTrigger = 'manual' | 'auto' | 'safety';
export type AppBackupHistoryResult = 'success' | 'failed';

export interface AppBackupHistoryRecord {
  historyId: string;
  createdAt: number;
  fileName: string;
  /** Where this backup was produced for — a device label (e.g. "Windows
   * PC", "iPad") for a normal backup, or a fixed description for
   * automatic/safety backups. Browsers cannot report a real save
   * location (no filesystem access), so this is informational only —
   * see `appBackupBuilder.ts`'s `defaultDeviceLabel` doc comment. */
  destination: string;
  result: AppBackupHistoryResult;
  durationMs: number;
  trigger: AppBackupHistoryTrigger;
  appVersionLabel?: string;
  dbVersion: number;
  fileCount: number;
  assetFileCount: number;
  originalSize: number;
  compressedSize: number;
  /** The archive itself, so a later "Restore" doesn't need the user to
   * re-locate the file. `null` for a failed backup attempt (nothing to
   * store) — the record still exists so the failure is visible in
   * history. */
  blob: Blob | null;
  errorMessage?: string;
}

export async function addBackupHistoryRecord(record: AppBackupHistoryRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(APP_BACKUP_HISTORY_STORE, 'readwrite');
  tx.objectStore(APP_BACKUP_HISTORY_STORE).put(record);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listBackupHistory(): Promise<AppBackupHistoryRecord[]> {
  const db = await openDb();
  const tx = db.transaction(APP_BACKUP_HISTORY_STORE, 'readonly');
  const records = await requestAsPromise(tx.objectStore(APP_BACKUP_HISTORY_STORE).getAll() as IDBRequest<AppBackupHistoryRecord[]>);
  return records.slice().sort((a, b) => b.createdAt - a.createdAt);
}

export async function getBackupHistoryRecord(historyId: string): Promise<AppBackupHistoryRecord | undefined> {
  const db = await openDb();
  const tx = db.transaction(APP_BACKUP_HISTORY_STORE, 'readonly');
  return requestAsPromise(tx.objectStore(APP_BACKUP_HISTORY_STORE).get(historyId) as IDBRequest<AppBackupHistoryRecord | undefined>);
}

/** Test/reset-only — mirrors `catalog/storage/collectionStore.ts`'s
 * `clearCollectionsStore` convention. */
export async function clearBackupHistoryStore(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(APP_BACKUP_HISTORY_STORE, 'readwrite');
  tx.objectStore(APP_BACKUP_HISTORY_STORE).clear();
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteBackupHistoryRecord(historyId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(APP_BACKUP_HISTORY_STORE, 'readwrite');
  tx.objectStore(APP_BACKUP_HISTORY_STORE).delete(historyId);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Deletes the oldest successful backups beyond `retention`, oldest
 * first — matches the brief's "retention 5/10/20/Unlimited with
 * auto-delete-oldest" requirement. Failed-backup records and
 * `'safety'`-trigger records (pre-restore safety nets, which the user
 * did not choose to create and may still need) are never pruned by this
 * function; only `'manual'`/`'auto'` successful backups count toward the
 * limit. Returns the number of records deleted. */
export async function pruneBackupHistory(retention: AutoBackupRetention): Promise<number> {
  const limit = retentionLimit(retention);
  if (limit === null) return 0;

  const all = await listBackupHistory();
  const prunable = all.filter((r) => r.result === 'success' && r.trigger !== 'safety');
  if (prunable.length <= limit) return 0;

  const toDelete = prunable.slice(limit);
  for (const record of toDelete) {
    await deleteBackupHistoryRecord(record.historyId);
  }
  return toDelete.length;
}
