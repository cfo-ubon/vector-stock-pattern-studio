import { openDb, idbAvailable, requestAsPromise, MARKET_SNAPSHOTS_STORE } from '../../storage/db';
import type { MarketSnapshot } from '../domain/marketSnapshot';
import { isValidMarketSnapshot } from '../domain/marketSnapshot';

// Build 028 — Market Snapshots are never auto-deleted (Section 3's explicit
// "Do not delete old snapshots automatically"), so this store intentionally
// has no pruning/retention logic anywhere, unlike e.g. `appBackupHistoryStore.ts`.

export class MarketSnapshotStorageUnavailableError extends Error {
  constructor() {
    super('The Marketing Intelligence Center requires a browser with IndexedDB support.');
    this.name = 'MarketSnapshotStorageUnavailableError';
  }
}

function assertAvailable(): void {
  if (!idbAvailable()) throw new MarketSnapshotStorageUnavailableError();
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(MARKET_SNAPSHOTS_STORE, mode).objectStore(MARKET_SNAPSHOTS_STORE);
}

export async function loadMarketSnapshots(): Promise<MarketSnapshot[]> {
  assertAvailable();
  const db = await openDb();
  const items = await requestAsPromise(tx(db, 'readonly').getAll() as IDBRequest<MarketSnapshot[]>);
  return items.filter(isValidMarketSnapshot);
}

export async function getMarketSnapshot(id: string): Promise<MarketSnapshot | undefined> {
  assertAvailable();
  const db = await openDb();
  const item = await requestAsPromise(tx(db, 'readonly').get(id) as IDBRequest<MarketSnapshot | undefined>);
  return item && isValidMarketSnapshot(item) ? item : undefined;
}

export async function putMarketSnapshot(item: MarketSnapshot): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').put(item));
}

export async function deleteMarketSnapshot(id: string): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').delete(id) as unknown as IDBRequest<undefined>);
}

export async function clearMarketSnapshots(): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').clear() as unknown as IDBRequest<undefined>);
}
