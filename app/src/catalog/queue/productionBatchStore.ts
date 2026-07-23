import { openDb, idbAvailable, requestAsPromise, PRODUCTION_BATCHES_STORE } from '../../storage/db';
import type { ProductionBatch } from './productionBatch';
import { isValidProductionBatch } from './productionBatch';

// Build 026, Phase 14 — Production Batch persistence. Same plain-CRUD
// shape as `productionQueueStore.ts`.

export class ProductionBatchStorageUnavailableError extends Error {
  constructor() {
    super('Production Batches require a browser with IndexedDB support.');
    this.name = 'ProductionBatchStorageUnavailableError';
  }
}

function assertAvailable(): void {
  if (!idbAvailable()) throw new ProductionBatchStorageUnavailableError();
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(PRODUCTION_BATCHES_STORE, mode).objectStore(PRODUCTION_BATCHES_STORE);
}

export async function loadProductionBatches(): Promise<ProductionBatch[]> {
  assertAvailable();
  const db = await openDb();
  const items = await requestAsPromise(tx(db, 'readonly').getAll() as IDBRequest<ProductionBatch[]>);
  return items.filter(isValidProductionBatch);
}

export async function getProductionBatch(batchId: string): Promise<ProductionBatch | undefined> {
  assertAvailable();
  const db = await openDb();
  const item = await requestAsPromise(tx(db, 'readonly').get(batchId) as IDBRequest<ProductionBatch | undefined>);
  return item && isValidProductionBatch(item) ? item : undefined;
}

export async function putProductionBatch(batch: ProductionBatch): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').put(batch));
}

export async function deleteProductionBatch(batchId: string): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').delete(batchId) as unknown as IDBRequest<undefined>);
}

export async function clearProductionBatches(): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').clear() as unknown as IDBRequest<undefined>);
}
