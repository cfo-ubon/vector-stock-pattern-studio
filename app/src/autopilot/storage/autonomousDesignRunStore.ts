import { openDb, idbAvailable, requestAsPromise, AUTONOMOUS_DESIGN_RUNS_STORE } from '../../storage/db';
import type { AutonomousDesignRun } from '../domain/autonomousDesignRun';
import { isValidAutonomousDesignRun } from '../domain/autonomousDesignRun';

// Build 029, Module 10 — CRUD for `AutonomousDesignRun`, mirroring
// `design-director/storage/marketingDesignHandoffStore.ts`'s (Build 028C)
// own shape exactly: idbAvailable guard, isValid filter on load, one tx()
// helper.

export class AutonomousDesignRunStorageUnavailableError extends Error {
  constructor() {
    super('Autopilot run history requires a browser with IndexedDB support.');
    this.name = 'AutonomousDesignRunStorageUnavailableError';
  }
}

function assertAvailable(): void {
  if (!idbAvailable()) throw new AutonomousDesignRunStorageUnavailableError();
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(AUTONOMOUS_DESIGN_RUNS_STORE, mode).objectStore(AUTONOMOUS_DESIGN_RUNS_STORE);
}

export async function loadAutonomousDesignRuns(): Promise<AutonomousDesignRun[]> {
  assertAvailable();
  const db = await openDb();
  const items = await requestAsPromise(tx(db, 'readonly').getAll() as IDBRequest<AutonomousDesignRun[]>);
  return items.filter(isValidAutonomousDesignRun).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getAutonomousDesignRun(id: string): Promise<AutonomousDesignRun | undefined> {
  assertAvailable();
  const db = await openDb();
  const item = await requestAsPromise(tx(db, 'readonly').get(id) as IDBRequest<AutonomousDesignRun | undefined>);
  return item && isValidAutonomousDesignRun(item) ? item : undefined;
}

export async function putAutonomousDesignRun(run: AutonomousDesignRun): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').put(run));
}

export async function deleteAutonomousDesignRun(id: string): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').delete(id) as unknown as IDBRequest<undefined>);
}

export async function clearAutonomousDesignRuns(): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').clear() as unknown as IDBRequest<undefined>);
}

/** Runs still mid-flight after a reload (Module 12's "continue safely
 * after application reload where feasible") — never `COMPLETED`/`CANCELLED`/
 * `FAILED`. */
export async function loadResumableAutonomousDesignRuns(): Promise<AutonomousDesignRun[]> {
  const all = await loadAutonomousDesignRuns();
  return all.filter((r) => r.status === 'GENERATING' || r.status === 'PAUSED');
}
