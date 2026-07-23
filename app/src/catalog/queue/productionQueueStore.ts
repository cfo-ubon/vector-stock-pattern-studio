import { openDb, idbAvailable, requestAsPromise, PRODUCTION_QUEUE_STORE } from '../../storage/db';
import type { ProductionQueueItem } from './productionQueue';
import { isValidProductionQueueItem } from './productionQueue';

// Build 026, Phase 14 — Production Queue persistence. Plain IndexedDB
// CRUD, same shape as `quality/qualitySnapshotStore.ts` and
// `submission/rejectionStore.ts` -- no in-memory cache layer, since
// nothing in this app's existing call sites needs the Production Queue
// to be read synchronously the way `submissionStore.ts` did before its
// Build 026 IndexedDB migration.

export class ProductionQueueStorageUnavailableError extends Error {
  constructor() {
    super('The Production Queue requires a browser with IndexedDB support.');
    this.name = 'ProductionQueueStorageUnavailableError';
  }
}

function assertAvailable(): void {
  if (!idbAvailable()) throw new ProductionQueueStorageUnavailableError();
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(PRODUCTION_QUEUE_STORE, mode).objectStore(PRODUCTION_QUEUE_STORE);
}

export async function loadProductionQueueItems(): Promise<ProductionQueueItem[]> {
  assertAvailable();
  const db = await openDb();
  const items = await requestAsPromise(tx(db, 'readonly').getAll() as IDBRequest<ProductionQueueItem[]>);
  return items.filter(isValidProductionQueueItem);
}

export async function getProductionQueueItem(queueItemId: string): Promise<ProductionQueueItem | undefined> {
  assertAvailable();
  const db = await openDb();
  const item = await requestAsPromise(tx(db, 'readonly').get(queueItemId) as IDBRequest<ProductionQueueItem | undefined>);
  return item && isValidProductionQueueItem(item) ? item : undefined;
}

export async function putProductionQueueItem(item: ProductionQueueItem): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').put(item));
}

export async function deleteProductionQueueItem(queueItemId: string): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').delete(queueItemId) as unknown as IDBRequest<undefined>);
}

export async function clearProductionQueueItems(): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').clear() as unknown as IDBRequest<undefined>);
}
