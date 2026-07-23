import { openDb, idbAvailable, requestAsPromise, MARKETPLACE_REGISTRATIONS_STORE } from '../../storage/db';
import type { MarketplaceRegistration } from './marketplaceRegistration';
import { isValidMarketplaceRegistration } from './marketplaceRegistration';

// Build 026, Phase 5 (gap-fill) — Marketplace Registration persistence.
// Plain IndexedDB CRUD, same shape as `quality/qualitySnapshotStore.ts`.

export class MarketplaceRegistrationStorageUnavailableError extends Error {
  constructor() {
    super('Marketplace registrations require a browser with IndexedDB support.');
    this.name = 'MarketplaceRegistrationStorageUnavailableError';
  }
}

function assertAvailable(): void {
  if (!idbAvailable()) throw new MarketplaceRegistrationStorageUnavailableError();
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(MARKETPLACE_REGISTRATIONS_STORE, mode).objectStore(MARKETPLACE_REGISTRATIONS_STORE);
}

export async function loadMarketplaceRegistrations(): Promise<MarketplaceRegistration[]> {
  assertAvailable();
  const db = await openDb();
  const items = await requestAsPromise(tx(db, 'readonly').getAll() as IDBRequest<MarketplaceRegistration[]>);
  return items.filter(isValidMarketplaceRegistration);
}

export async function putMarketplaceRegistration(record: MarketplaceRegistration): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').put(record));
}

export async function deleteMarketplaceRegistration(id: string): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').delete(id) as unknown as IDBRequest<undefined>);
}

export async function clearMarketplaceRegistrations(): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').clear() as unknown as IDBRequest<undefined>);
}
