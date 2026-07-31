import { openDb, idbAvailable, requestAsPromise, DAILY_MISSIONS_STORE } from '../../storage/db';
import type { DailyMission } from '../domain/dailyMission';
import { isValidDailyMission } from '../domain/dailyMission';

export class DailyMissionStorageUnavailableError extends Error {
  constructor() {
    super('The Marketing Intelligence Center requires a browser with IndexedDB support.');
    this.name = 'DailyMissionStorageUnavailableError';
  }
}

function assertAvailable(): void {
  if (!idbAvailable()) throw new DailyMissionStorageUnavailableError();
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(DAILY_MISSIONS_STORE, mode).objectStore(DAILY_MISSIONS_STORE);
}

export async function loadDailyMissions(): Promise<DailyMission[]> {
  assertAvailable();
  const db = await openDb();
  const items = await requestAsPromise(tx(db, 'readonly').getAll() as IDBRequest<DailyMission[]>);
  return items.filter(isValidDailyMission);
}

export async function getDailyMission(id: string): Promise<DailyMission | undefined> {
  assertAvailable();
  const db = await openDb();
  const item = await requestAsPromise(tx(db, 'readonly').get(id) as IDBRequest<DailyMission | undefined>);
  return item && isValidDailyMission(item) ? item : undefined;
}

export async function putDailyMission(item: DailyMission): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').put(item));
}

export async function deleteDailyMission(id: string): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').delete(id) as unknown as IDBRequest<undefined>);
}

export async function clearDailyMissions(): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').clear() as unknown as IDBRequest<undefined>);
}

/** Section 1's "Today's Market Mission" — the most recent mission whose
 * `date` falls on the given day, or null if none has been generated yet.
 * A plain lookup, not a fabricated fallback: the caller (UI) decides what
 * to show when this returns null (an empty state, or an offer to generate
 * one from the latest saved snapshot). */
export async function getMissionForDate(date: number): Promise<DailyMission | null> {
  const all = await loadDailyMissions();
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = dayStart.getTime() + 24 * 60 * 60 * 1000;
  const matches = all.filter((m) => m.date >= dayStart.getTime() && m.date < dayEnd);
  if (matches.length === 0) return null;
  return matches.sort((a, b) => b.createdAt - a.createdAt)[0];
}
