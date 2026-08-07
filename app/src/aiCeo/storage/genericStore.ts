import { openDb, idbAvailable, requestAsPromise } from '../../storage/db';

// Build 030 Part 2 — every one of this build's 8 new stores is a flat,
// keyPath-'id' object store with identical CRUD needs (mirrors
// `autopilot/storage/autonomousDesignRunStore.ts`'s own shape), so one
// generic factory replaces 8 near-identical hand-written store modules —
// the same "no per-store domain types needed for a plain getAll/put" reuse
// `backup/appBackupIdb.ts` already relies on for the whole database dump.

export class AiCeoStorageUnavailableError extends Error {
  constructor(label: string) {
    super(`${label} requires a browser with IndexedDB support.`);
    this.name = 'AiCeoStorageUnavailableError';
  }
}

export interface GenericStore<T> {
  loadAll(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  put(record: T): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

export function createGenericStore<T extends { id: string }>(storeName: string, label: string, isValid: (value: unknown) => value is T): GenericStore<T> {
  function assertAvailable(): void {
    if (!idbAvailable()) throw new AiCeoStorageUnavailableError(label);
  }
  function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
    return db.transaction(storeName, mode).objectStore(storeName);
  }
  return {
    async loadAll(): Promise<T[]> {
      assertAvailable();
      const db = await openDb();
      const items = await requestAsPromise(tx(db, 'readonly').getAll() as IDBRequest<T[]>);
      return items.filter(isValid);
    },
    async get(id: string): Promise<T | undefined> {
      assertAvailable();
      const db = await openDb();
      const item = await requestAsPromise(tx(db, 'readonly').get(id) as IDBRequest<T | undefined>);
      return item && isValid(item) ? item : undefined;
    },
    async put(record: T): Promise<void> {
      assertAvailable();
      const db = await openDb();
      await requestAsPromise(tx(db, 'readwrite').put(record));
    },
    async remove(id: string): Promise<void> {
      assertAvailable();
      const db = await openDb();
      await requestAsPromise(tx(db, 'readwrite').delete(id) as unknown as IDBRequest<undefined>);
    },
    async clear(): Promise<void> {
      assertAvailable();
      const db = await openDb();
      await requestAsPromise(tx(db, 'readwrite').clear() as unknown as IDBRequest<undefined>);
    },
  };
}
