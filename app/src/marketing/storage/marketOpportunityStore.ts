import { openDb, idbAvailable, requestAsPromise, MARKET_OPPORTUNITIES_STORE } from '../../storage/db';
import type { MarketOpportunity } from '../domain/marketOpportunity';
import { isValidMarketOpportunity } from '../domain/marketOpportunity';

export class MarketOpportunityStorageUnavailableError extends Error {
  constructor() {
    super('The Marketing Intelligence Center requires a browser with IndexedDB support.');
    this.name = 'MarketOpportunityStorageUnavailableError';
  }
}

function assertAvailable(): void {
  if (!idbAvailable()) throw new MarketOpportunityStorageUnavailableError();
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(MARKET_OPPORTUNITIES_STORE, mode).objectStore(MARKET_OPPORTUNITIES_STORE);
}

export async function loadMarketOpportunities(): Promise<MarketOpportunity[]> {
  assertAvailable();
  const db = await openDb();
  const items = await requestAsPromise(tx(db, 'readonly').getAll() as IDBRequest<MarketOpportunity[]>);
  return items.filter(isValidMarketOpportunity);
}

export async function getMarketOpportunity(id: string): Promise<MarketOpportunity | undefined> {
  assertAvailable();
  const db = await openDb();
  const item = await requestAsPromise(tx(db, 'readonly').get(id) as IDBRequest<MarketOpportunity | undefined>);
  return item && isValidMarketOpportunity(item) ? item : undefined;
}

export async function putMarketOpportunity(item: MarketOpportunity): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').put(item));
}

export async function deleteMarketOpportunity(id: string): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').delete(id) as unknown as IDBRequest<undefined>);
}

export async function clearMarketOpportunities(): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').clear() as unknown as IDBRequest<undefined>);
}
