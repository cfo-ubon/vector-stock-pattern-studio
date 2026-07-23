import { openDb, idbAvailable, requestAsPromise, SALES_EVENTS_STORE } from '../../storage/db';
import { isValidSalesEvent, normalizeSalesEvent } from './salesRevenue';
import type { SalesEvent } from './salesRevenue';

// Build 026 — sales/revenue IndexedDB persistence. Unlike
// `submissionStore.ts`, there is no legacy data to migrate (this domain
// did not exist before this build), so this is a plain, direct
// IndexedDB-backed store — same shape as `catalog/storage/portfolioStore.ts`.

export class SalesRevenueStorageUnavailableError extends Error {
  constructor() {
    super('Sales & revenue tracking requires a browser with IndexedDB support.');
    this.name = 'SalesRevenueStorageUnavailableError';
  }
}

function assertAvailable(): void {
  if (!idbAvailable()) throw new SalesRevenueStorageUnavailableError();
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(SALES_EVENTS_STORE, mode).objectStore(SALES_EVENTS_STORE);
}

export async function loadSalesEvents(): Promise<SalesEvent[]> {
  assertAvailable();
  const db = await openDb();
  const items = await requestAsPromise(tx(db, 'readonly').getAll() as IDBRequest<SalesEvent[]>);
  return items.filter(isValidSalesEvent).map(normalizeSalesEvent);
}

export async function putSalesEvent(event: SalesEvent): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').put(event));
}

export async function putSalesEventsBulk(events: SalesEvent[]): Promise<void> {
  assertAvailable();
  if (events.length === 0) return;
  const db = await openDb();
  const t = db.transaction(SALES_EVENTS_STORE, 'readwrite');
  const store = t.objectStore(SALES_EVENTS_STORE);
  for (const e of events) store.put(e);
  await requestAsPromise(t.objectStore(SALES_EVENTS_STORE).count());
}

export async function deleteSalesEvent(eventId: string): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').delete(eventId) as unknown as IDBRequest<undefined>);
}

export async function clearSalesEvents(): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').clear() as unknown as IDBRequest<undefined>);
}
