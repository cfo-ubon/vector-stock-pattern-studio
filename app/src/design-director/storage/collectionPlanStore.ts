import { openDb, idbAvailable, requestAsPromise, COLLECTION_PLANS_STORE } from '../../storage/db';
import type { CollectionPlan } from '../domain/collectionPlan';
import { isValidCollectionPlan } from '../domain/collectionPlan';

// Build 028B — persists CollectionPlan records into the new `collectionPlans`
// store (DB_VERSION 8 -> 9), indexed by `briefId` for the 1-brief-to-many
// (usually one)-plans lookup the Collection Planner tab needs.

export class CollectionPlanStorageUnavailableError extends Error {
  constructor() {
    super('The AI Creative Director requires a browser with IndexedDB support.');
    this.name = 'CollectionPlanStorageUnavailableError';
  }
}

function assertAvailable(): void {
  if (!idbAvailable()) throw new CollectionPlanStorageUnavailableError();
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(COLLECTION_PLANS_STORE, mode).objectStore(COLLECTION_PLANS_STORE);
}

export async function loadCollectionPlans(): Promise<CollectionPlan[]> {
  assertAvailable();
  const db = await openDb();
  const items = await requestAsPromise(tx(db, 'readonly').getAll() as IDBRequest<CollectionPlan[]>);
  return items.filter(isValidCollectionPlan);
}

export async function getCollectionPlan(id: string): Promise<CollectionPlan | undefined> {
  assertAvailable();
  const db = await openDb();
  const item = await requestAsPromise(tx(db, 'readonly').get(id) as IDBRequest<CollectionPlan | undefined>);
  return item && isValidCollectionPlan(item) ? item : undefined;
}

export async function putCollectionPlan(item: CollectionPlan): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').put(item));
}

export async function deleteCollectionPlan(id: string): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').delete(id) as unknown as IDBRequest<undefined>);
}

export async function clearCollectionPlans(): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').clear() as unknown as IDBRequest<undefined>);
}
