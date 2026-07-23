import { openDb, idbAvailable, requestAsPromise, IMPORT_HISTORY_STORE } from '../../storage/db';
import type { HistoricalImportReport } from './historicalPortfolioImport';

// Build 026, Phase 15 — Import History persistence. Wraps every
// `HistoricalImportReport` (`historicalPortfolioImport.ts`) with an id
// so past historical imports stay inspectable -- "producing import
// history + missing/malformed reports" (brief) means these reports
// must survive the page reload, not just live in the return value of
// one function call. Uses the `importHistory` IndexedDB store already
// created in Build 026's DB_VERSION 5->6 migration (`storage/db.ts`,
// keyPath `importId`, indexed on `importedAt`).

export const IMPORT_HISTORY_RECORD_SCHEMA_VERSION = 1;

export interface ImportHistoryRecord {
  importId: string;
  importedAt: number;
  report: HistoricalImportReport;
  schemaVersion: number;
}

function generateImportId(now: number): string {
  return `IMP-${now}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createImportHistoryRecord(report: HistoricalImportReport, now?: number): ImportHistoryRecord {
  const at = now ?? report.importedAt;
  return {
    importId: generateImportId(at),
    importedAt: at,
    report,
    schemaVersion: IMPORT_HISTORY_RECORD_SCHEMA_VERSION,
  };
}

export function isValidImportHistoryRecord(value: unknown): value is ImportHistoryRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as Partial<ImportHistoryRecord>;
  return typeof r.importId === 'string' && typeof r.importedAt === 'number' && typeof r.report === 'object' && r.report !== null;
}

export class ImportHistoryStorageUnavailableError extends Error {
  constructor() {
    super('Import history requires a browser with IndexedDB support.');
    this.name = 'ImportHistoryStorageUnavailableError';
  }
}

function assertAvailable(): void {
  if (!idbAvailable()) throw new ImportHistoryStorageUnavailableError();
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(IMPORT_HISTORY_STORE, mode).objectStore(IMPORT_HISTORY_STORE);
}

/** Sorted newest-first -- import history is always browsed as a
 * timeline, most recent import first. */
export async function loadImportHistory(): Promise<ImportHistoryRecord[]> {
  assertAvailable();
  const db = await openDb();
  const items = await requestAsPromise(tx(db, 'readonly').getAll() as IDBRequest<ImportHistoryRecord[]>);
  return items.filter(isValidImportHistoryRecord).sort((a, b) => b.importedAt - a.importedAt);
}

export async function putImportHistoryRecord(record: ImportHistoryRecord): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').put(record));
}

export async function clearImportHistory(): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').clear() as unknown as IDBRequest<undefined>);
}
