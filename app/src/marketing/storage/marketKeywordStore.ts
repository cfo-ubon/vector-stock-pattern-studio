import { openDb, idbAvailable, requestAsPromise, MARKET_KEYWORDS_STORE } from '../../storage/db';
import type { MarketKeyword } from '../domain/marketKeyword';
import { isValidMarketKeyword } from '../domain/marketKeyword';

export class MarketKeywordStorageUnavailableError extends Error {
  constructor() {
    super('The Marketing Intelligence Center requires a browser with IndexedDB support.');
    this.name = 'MarketKeywordStorageUnavailableError';
  }
}

function assertAvailable(): void {
  if (!idbAvailable()) throw new MarketKeywordStorageUnavailableError();
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(MARKET_KEYWORDS_STORE, mode).objectStore(MARKET_KEYWORDS_STORE);
}

export async function loadMarketKeywords(): Promise<MarketKeyword[]> {
  assertAvailable();
  const db = await openDb();
  const items = await requestAsPromise(tx(db, 'readonly').getAll() as IDBRequest<MarketKeyword[]>);
  return items.filter(isValidMarketKeyword);
}

export async function getMarketKeyword(id: string): Promise<MarketKeyword | undefined> {
  assertAvailable();
  const db = await openDb();
  const item = await requestAsPromise(tx(db, 'readonly').get(id) as IDBRequest<MarketKeyword | undefined>);
  return item && isValidMarketKeyword(item) ? item : undefined;
}

export async function putMarketKeyword(item: MarketKeyword): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').put(item));
}

export async function deleteMarketKeyword(id: string): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').delete(id) as unknown as IDBRequest<undefined>);
}

export async function clearMarketKeywords(): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').clear() as unknown as IDBRequest<undefined>);
}
