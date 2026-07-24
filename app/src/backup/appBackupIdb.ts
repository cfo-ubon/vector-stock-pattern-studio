// Application Backup System — generic IndexedDB store dump/restore.
//
// Every store in `APP_BACKUP_STORE_NAMES` is a flat, keyPath-addressed
// object store (see `storage/db.ts`) with no cross-store membership model
// of its own (that's `PortfolioAsset.collectionIds`, which lives *inside*
// the `portfolioAssets` record and therefore already travels with it) — so
// a full-database dump/restore needs no per-store domain types, just the
// store's own name and a plain `getAll()`/`put()` over every record. This
// mirrors `productionBackup.ts`'s "plain upsert, primary key decides
// create-vs-overwrite" restore model, generalized across all stores
// (including `portfolioFiles`, dumped separately as binary `assets/`
// entries by `appBackupBuilder.ts` — see that module for why).

import { openDb, requestAsPromise } from '../storage/db';
import type { AppBackupDatabaseDump } from './appBackupFormat';

export async function dumpStore(storeName: string): Promise<unknown[]> {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  return requestAsPromise(store.getAll());
}

export async function dumpAllStores(storeNames: readonly string[]): Promise<AppBackupDatabaseDump> {
  const dump: AppBackupDatabaseDump = {};
  for (const name of storeNames) {
    dump[name] = await dumpStore(name);
  }
  return dump;
}

/** Upserts every record in `records` into `storeName` via `put()` — each
 * record's own keyPath field decides whether it creates a new row or
 * overwrites an existing one, so restoring the same backup twice is
 * idempotent and restoring onto a database that already has *newer* data
 * for some records intentionally lets the backup's copy win (restore is
 * explicit user intent to go back to this snapshot). */
export async function putAllRecords(storeName: string, records: unknown[]): Promise<void> {
  if (records.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  for (const record of records) store.put(record);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error(`Transaction aborted while restoring "${storeName}"`));
  });
}

export async function restoreAllStores(dump: AppBackupDatabaseDump, storeNames: readonly string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const name of storeNames) {
    const records = dump[name] ?? [];
    await putAllRecords(name, records);
    counts[name] = records.length;
  }
  return counts;
}
