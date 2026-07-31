import { openDb, idbAvailable, requestAsPromise, RESEARCH_SOURCES_STORE } from '../../storage/db';
import type { ResearchSource } from '../domain/researchSource';
import { isValidResearchSource } from '../domain/researchSource';

// Build 028 — plain IndexedDB CRUD, same shape as
// `catalog/queue/productionQueueStore.ts`: no in-memory cache layer, since
// nothing needs synchronous reads of research sources.

export class ResearchSourceStorageUnavailableError extends Error {
  constructor() {
    super('The Marketing Intelligence Center requires a browser with IndexedDB support.');
    this.name = 'ResearchSourceStorageUnavailableError';
  }
}

function assertAvailable(): void {
  if (!idbAvailable()) throw new ResearchSourceStorageUnavailableError();
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(RESEARCH_SOURCES_STORE, mode).objectStore(RESEARCH_SOURCES_STORE);
}

export async function loadResearchSources(): Promise<ResearchSource[]> {
  assertAvailable();
  const db = await openDb();
  const items = await requestAsPromise(tx(db, 'readonly').getAll() as IDBRequest<ResearchSource[]>);
  return items.filter(isValidResearchSource);
}

export async function getResearchSource(id: string): Promise<ResearchSource | undefined> {
  assertAvailable();
  const db = await openDb();
  const item = await requestAsPromise(tx(db, 'readonly').get(id) as IDBRequest<ResearchSource | undefined>);
  return item && isValidResearchSource(item) ? item : undefined;
}

export async function putResearchSource(item: ResearchSource): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').put(item));
}

export async function deleteResearchSource(id: string): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').delete(id) as unknown as IDBRequest<undefined>);
}

export async function clearResearchSources(): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').clear() as unknown as IDBRequest<undefined>);
}
