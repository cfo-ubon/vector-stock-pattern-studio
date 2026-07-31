import { openDb, idbAvailable, requestAsPromise, DESIGN_CONFIGURATIONS_STORE } from '../../storage/db';
import type { GeneratorHandoff } from '../domain/generatorHandoff';
import { isValidGeneratorHandoff } from '../domain/generatorHandoff';

// Build 028B — persists GeneratorHandoff records into the
// `designConfigurations` store Build 028 Phase 2 already provisioned
// (keyPath 'id', index 'briefId' — matches this domain's `briefId` field).

export class GeneratorHandoffStorageUnavailableError extends Error {
  constructor() {
    super('The AI Creative Director requires a browser with IndexedDB support.');
    this.name = 'GeneratorHandoffStorageUnavailableError';
  }
}

function assertAvailable(): void {
  if (!idbAvailable()) throw new GeneratorHandoffStorageUnavailableError();
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(DESIGN_CONFIGURATIONS_STORE, mode).objectStore(DESIGN_CONFIGURATIONS_STORE);
}

export async function loadGeneratorHandoffs(): Promise<GeneratorHandoff[]> {
  assertAvailable();
  const db = await openDb();
  const items = await requestAsPromise(tx(db, 'readonly').getAll() as IDBRequest<GeneratorHandoff[]>);
  return items.filter(isValidGeneratorHandoff);
}

export async function getGeneratorHandoff(id: string): Promise<GeneratorHandoff | undefined> {
  assertAvailable();
  const db = await openDb();
  const item = await requestAsPromise(tx(db, 'readonly').get(id) as IDBRequest<GeneratorHandoff | undefined>);
  return item && isValidGeneratorHandoff(item) ? item : undefined;
}

export async function putGeneratorHandoff(item: GeneratorHandoff): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').put(item));
}

export async function deleteGeneratorHandoff(id: string): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').delete(id) as unknown as IDBRequest<undefined>);
}

export async function clearGeneratorHandoffs(): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').clear() as unknown as IDBRequest<undefined>);
}
