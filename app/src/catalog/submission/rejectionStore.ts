import { openDb, idbAvailable, requestAsPromise, REJECTION_RECORDS_STORE } from '../../storage/db';
import { isValidRejectionRecord, normalizeRejectionRecord } from './rejectionIntelligence';
import type { RejectionRecord } from './rejectionIntelligence';

export class RejectionStorageUnavailableError extends Error {
  constructor() {
    super('Rejection tracking requires a browser with IndexedDB support.');
    this.name = 'RejectionStorageUnavailableError';
  }
}

function assertAvailable(): void {
  if (!idbAvailable()) throw new RejectionStorageUnavailableError();
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(REJECTION_RECORDS_STORE, mode).objectStore(REJECTION_RECORDS_STORE);
}

export async function loadRejectionRecords(): Promise<RejectionRecord[]> {
  assertAvailable();
  const db = await openDb();
  const items = await requestAsPromise(tx(db, 'readonly').getAll() as IDBRequest<RejectionRecord[]>);
  return items.filter(isValidRejectionRecord).map(normalizeRejectionRecord);
}

export async function putRejectionRecord(record: RejectionRecord): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').put(record));
}

export async function deleteRejectionRecord(rejectionId: string): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').delete(rejectionId) as unknown as IDBRequest<undefined>);
}

export async function clearRejectionRecords(): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').clear() as unknown as IDBRequest<undefined>);
}
