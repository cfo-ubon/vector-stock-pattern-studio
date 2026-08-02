import { openDb, idbAvailable, requestAsPromise, FACTORY_DAILY_KPI_STORE } from '../../storage/db';
import type { FactoryDailyKpi } from '../domain/types';

// Mission 2, Part 10 — Factory Daily KPI storage. Keyed by `dateKey`
// (`YYYY-MM-DD`), not `id` — a day's snapshot is captured at most once
// per day (an upsert via `put`, not an append), so this store stays
// bounded and the Trend Engine (Part 6) never needs to recompute
// history, only look a specific day up (Part 11).

export class FactoryDailyKpiStorageUnavailableError extends Error {
  constructor() {
    super('Factory Daily KPI storage requires a browser with IndexedDB support.');
    this.name = 'FactoryDailyKpiStorageUnavailableError';
  }
}

function assertAvailable(): void {
  if (!idbAvailable()) throw new FactoryDailyKpiStorageUnavailableError();
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(FACTORY_DAILY_KPI_STORE, mode).objectStore(FACTORY_DAILY_KPI_STORE);
}

function isValidFactoryDailyKpi(value: unknown): value is FactoryDailyKpi {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.dateKey === 'string' && typeof v.capturedAt === 'number' && typeof v.metrics === 'object';
}

export async function loadFactoryDailyKpiHistory(): Promise<FactoryDailyKpi[]> {
  assertAvailable();
  const db = await openDb();
  const items = await requestAsPromise(tx(db, 'readonly').getAll() as IDBRequest<FactoryDailyKpi[]>);
  return items.filter(isValidFactoryDailyKpi);
}

export async function getFactoryDailyKpi(dateKey: string): Promise<FactoryDailyKpi | undefined> {
  assertAvailable();
  const db = await openDb();
  const item = await requestAsPromise(tx(db, 'readonly').get(dateKey) as IDBRequest<FactoryDailyKpi | undefined>);
  return item && isValidFactoryDailyKpi(item) ? item : undefined;
}

export async function putFactoryDailyKpi(snapshot: FactoryDailyKpi): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').put(snapshot));
}

export async function clearFactoryDailyKpiForTest(): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').clear() as unknown as IDBRequest<undefined>);
}
