import { openDb, idbAvailable, requestAsPromise, MARKETING_DESIGN_HANDOFFS_STORE } from '../../storage/db';
import type { MarketingDesignHandoff } from '../domain/marketingDesignHandoff';
import { isValidMarketingDesignHandoff } from '../domain/marketingDesignHandoff';

// Build 028C — persists MarketingDesignHandoff records into the
// `marketingDesignHandoffs` IndexedDB store (pre-provisioned by Build 028
// Phase 2, DB_VERSION 9 -> 10 in this build only adds the `opportunityId`
// index used by `getMarketingDesignHandoffsByOpportunityId` below).

export class MarketingDesignHandoffStorageUnavailableError extends Error {
  constructor() {
    super('The AI Creative Director requires a browser with IndexedDB support.');
    this.name = 'MarketingDesignHandoffStorageUnavailableError';
  }
}

function assertAvailable(): void {
  if (!idbAvailable()) throw new MarketingDesignHandoffStorageUnavailableError();
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(MARKETING_DESIGN_HANDOFFS_STORE, mode).objectStore(MARKETING_DESIGN_HANDOFFS_STORE);
}

export async function loadMarketingDesignHandoffs(): Promise<MarketingDesignHandoff[]> {
  assertAvailable();
  const db = await openDb();
  const items = await requestAsPromise(tx(db, 'readonly').getAll() as IDBRequest<MarketingDesignHandoff[]>);
  return items.filter(isValidMarketingDesignHandoff);
}

export async function getMarketingDesignHandoff(id: string): Promise<MarketingDesignHandoff | undefined> {
  assertAvailable();
  const db = await openDb();
  const item = await requestAsPromise(tx(db, 'readonly').get(id) as IDBRequest<MarketingDesignHandoff | undefined>);
  return item && isValidMarketingDesignHandoff(item) ? item : undefined;
}

/** Every handoff record for a given Market Opportunity, newest first — used
 * to answer "has this opportunity already been sent to the Creative
 * Director?" (the button state/UI indicator requirement) without a
 * full-store scan. */
export async function getMarketingDesignHandoffsByOpportunityId(opportunityId: string): Promise<MarketingDesignHandoff[]> {
  assertAvailable();
  const db = await openDb();
  const store = tx(db, 'readonly');
  const items = store.indexNames.contains('opportunityId')
    ? await requestAsPromise(store.index('opportunityId').getAll(opportunityId) as IDBRequest<MarketingDesignHandoff[]>)
    : (await requestAsPromise(store.getAll() as IDBRequest<MarketingDesignHandoff[]>)).filter((h) => h.marketOpportunityId === opportunityId);
  return items.filter(isValidMarketingDesignHandoff).sort((a, b) => b.createdAt - a.createdAt);
}

export async function putMarketingDesignHandoff(item: MarketingDesignHandoff): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').put(item));
}

export async function deleteMarketingDesignHandoff(id: string): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').delete(id) as unknown as IDBRequest<undefined>);
}

export async function clearMarketingDesignHandoffs(): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').clear() as unknown as IDBRequest<undefined>);
}
