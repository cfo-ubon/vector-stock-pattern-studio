import { openDb, idbAvailable, requestAsPromise, MARKET_OBSERVATIONS_STORE } from '../../storage/db';
import type { MarketObservation } from '../domain/marketObservation';
import { isValidMarketObservation } from '../domain/marketObservation';

export class MarketObservationStorageUnavailableError extends Error {
  constructor() {
    super('The Marketing Intelligence Center requires a browser with IndexedDB support.');
    this.name = 'MarketObservationStorageUnavailableError';
  }
}

function assertAvailable(): void {
  if (!idbAvailable()) throw new MarketObservationStorageUnavailableError();
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(MARKET_OBSERVATIONS_STORE, mode).objectStore(MARKET_OBSERVATIONS_STORE);
}

export async function loadMarketObservations(): Promise<MarketObservation[]> {
  assertAvailable();
  const db = await openDb();
  const items = await requestAsPromise(tx(db, 'readonly').getAll() as IDBRequest<MarketObservation[]>);
  return items.filter(isValidMarketObservation);
}

export async function getMarketObservation(id: string): Promise<MarketObservation | undefined> {
  assertAvailable();
  const db = await openDb();
  const item = await requestAsPromise(tx(db, 'readonly').get(id) as IDBRequest<MarketObservation | undefined>);
  return item && isValidMarketObservation(item) ? item : undefined;
}

export async function putMarketObservation(item: MarketObservation): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').put(item));
}

export async function deleteMarketObservation(id: string): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').delete(id) as unknown as IDBRequest<undefined>);
}

export async function clearMarketObservations(): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').clear() as unknown as IDBRequest<undefined>);
}
