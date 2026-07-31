import { openDb, idbAvailable, requestAsPromise, SEASONAL_EVENTS_STORE } from '../../storage/db';
import type { SeasonalEvent } from '../domain/seasonalEvent';
import { isValidSeasonalEvent } from '../domain/seasonalEvent';

export class SeasonalEventStorageUnavailableError extends Error {
  constructor() {
    super('The Marketing Intelligence Center requires a browser with IndexedDB support.');
    this.name = 'SeasonalEventStorageUnavailableError';
  }
}

function assertAvailable(): void {
  if (!idbAvailable()) throw new SeasonalEventStorageUnavailableError();
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(SEASONAL_EVENTS_STORE, mode).objectStore(SEASONAL_EVENTS_STORE);
}

export async function loadSeasonalEvents(): Promise<SeasonalEvent[]> {
  assertAvailable();
  const db = await openDb();
  const items = await requestAsPromise(tx(db, 'readonly').getAll() as IDBRequest<SeasonalEvent[]>);
  return items.filter(isValidSeasonalEvent);
}

export async function putSeasonalEvent(item: SeasonalEvent): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').put(item));
}

export async function deleteSeasonalEvent(id: string): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').delete(id) as unknown as IDBRequest<undefined>);
}

export async function clearSeasonalEvents(): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').clear() as unknown as IDBRequest<undefined>);
}

/** Seeds the store with this year's + next year's global events the first
 * time it's empty — idempotent (checks emptiness first) so it never
 * duplicates entries on repeated app loads, and never overwrites a user's
 * own edited/deleted global events with a fresh copy. */
export async function ensureGlobalSeasonalEventsSeeded(now: number = Date.now()): Promise<void> {
  const existing = await loadSeasonalEvents();
  if (existing.length > 0) return;
  const { buildGlobalSeasonalEvents } = await import('../seasonal/globalCalendar');
  const year = new Date(now).getUTCFullYear();
  const events = [...buildGlobalSeasonalEvents(year, now), ...buildGlobalSeasonalEvents(year + 1, now)];
  for (const event of events) {
    await putSeasonalEvent(event);
  }
}
