import { openDb, idbAvailable, requestAsPromise, DESIGN_BRIEFS_STORE } from '../../storage/db';
import type { CreativeBrief } from '../domain/creativeBrief';
import { isValidCreativeBrief } from '../domain/creativeBrief';

// Build 028B — persists CreativeBrief records into the `designBriefs`
// IndexedDB store Build 028 Phase 2 already provisioned (keyPath 'id',
// indexes 'status'/'sourceOpportunityId' — both match this domain's field
// names exactly, so no schema change was needed for this store).

export class CreativeBriefStorageUnavailableError extends Error {
  constructor() {
    super('The AI Creative Director requires a browser with IndexedDB support.');
    this.name = 'CreativeBriefStorageUnavailableError';
  }
}

function assertAvailable(): void {
  if (!idbAvailable()) throw new CreativeBriefStorageUnavailableError();
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(DESIGN_BRIEFS_STORE, mode).objectStore(DESIGN_BRIEFS_STORE);
}

export async function loadCreativeBriefs(): Promise<CreativeBrief[]> {
  assertAvailable();
  const db = await openDb();
  const items = await requestAsPromise(tx(db, 'readonly').getAll() as IDBRequest<CreativeBrief[]>);
  return items.filter(isValidCreativeBrief);
}

export async function getCreativeBrief(id: string): Promise<CreativeBrief | undefined> {
  assertAvailable();
  const db = await openDb();
  const item = await requestAsPromise(tx(db, 'readonly').get(id) as IDBRequest<CreativeBrief | undefined>);
  return item && isValidCreativeBrief(item) ? item : undefined;
}

export async function putCreativeBrief(item: CreativeBrief): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').put(item));
}

export async function deleteCreativeBrief(id: string): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').delete(id) as unknown as IDBRequest<undefined>);
}

export async function clearCreativeBriefs(): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').clear() as unknown as IDBRequest<undefined>);
}
