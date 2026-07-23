import { isValidSubmissionRecord, normalizeSubmissionRecord } from './submissionRecord';
import type { SubmissionRecord } from './submissionRecord';
import { openDb, idbAvailable, requestAsPromise, SUBMISSIONS_STORE } from '../../storage/db';

// Build 015 — isolated Submission Center storage, originally localStorage-
// backed (see git history for that version's own rationale). Build 026
// (BUILD_026_AUDIT.md Section 5's confirmed storage risk) replaces the
// backing store with IndexedDB's new `submissions` object store
// (`storage/db.ts` DB_VERSION 6) — a single localStorage key
// JSON-stringifying an ever-growing record array does not scale to
// "thousands of patterns" x 5 marketplaces x growing status history, and
// localStorage's ~5-10MB ceiling made this the audit's one confirmed
// genuine risk.
//
// Every existing call site (`submissionService.ts` and 11 existing test
// files, none of which were written expecting a Promise) keeps working
// completely unchanged: this module still exposes the exact same
// SYNCHRONOUS function signatures it always has
// (`loadSubmissions(): SubmissionRecord[]`, not
// `Promise<SubmissionRecord[]>`). This is made possible by an in-memory
// cache that IS the synchronous source of truth for every read/write
// call in this module, mirrored to IndexedDB asynchronously in the
// background on every mutation (fire-and-forget, errors surfaced via
// `getLastPersistError()` rather than thrown into a synchronous caller
// that has no way to await them). This is a deliberate, disclosed
// trade-off (documented in `docs/DATABASE_SCHEMA.md`), not an oversight:
// a page that mutates a submission and reloads within the same
// millisecond the IndexedDB write was still in flight could theoretically
// lose that one write on a hard crash — the exact same window every
// fire-and-forget persistence layer has — but this is categorically safer
// than localStorage's hard 5-10MB ceiling, which does not degrade
// gracefully, it fails outright.
//
// One-time migration: the very first time this module is used in a
// browser that still has the old `vsp-submission-center-records`
// localStorage key, every record in it is imported into the new
// `submissions` IndexedDB store — and the old localStorage key is left
// in place afterward (never deleted) so a crash mid-migration loses
// nothing; the migration is naturally idempotent (re-importing the same
// records via `putSubmission`'s upsert-by-id semantics is a no-op).

const LEGACY_LOCALSTORAGE_KEY = 'vsp-submission-center-records';

export class SubmissionStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubmissionStorageError';
  }
}

let cache: SubmissionRecord[] = [];
let lastPersistError: SubmissionStorageError | null = null;
let hydration: Promise<void> | null = null;

function submissionsTx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(SUBMISSIONS_STORE, mode).objectStore(SUBMISSIONS_STORE);
}

function readLegacyLocalStorageRecords(): SubmissionRecord[] {
  try {
    const raw = localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    const obj = parsed as { records?: unknown } | null;
    return Array.isArray(obj?.records) ? obj.records.filter(isValidSubmissionRecord).map(normalizeSubmissionRecord) : [];
  } catch {
    return [];
  }
}

async function persistToIndexedDb(records: SubmissionRecord[]): Promise<void> {
  if (!idbAvailable()) return;
  try {
    const db = await openDb();
    const tx = db.transaction(SUBMISSIONS_STORE, 'readwrite');
    const store = tx.objectStore(SUBMISSIONS_STORE);
    for (const record of records) store.put(record);
    await requestAsPromise(tx.objectStore(SUBMISSIONS_STORE).count());
    lastPersistError = null;
  } catch (err) {
    lastPersistError = new SubmissionStorageError(`Failed to persist submission records to IndexedDB: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function deleteFromIndexedDb(submissionId: string): Promise<void> {
  if (!idbAvailable()) return;
  try {
    const db = await openDb();
    await requestAsPromise(submissionsTx(db, 'readwrite').delete(submissionId) as unknown as IDBRequest<undefined>);
    lastPersistError = null;
  } catch (err) {
    lastPersistError = new SubmissionStorageError(`Failed to delete submission ${submissionId} from IndexedDB: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function clearIndexedDb(): Promise<void> {
  if (!idbAvailable()) return;
  try {
    const db = await openDb();
    await requestAsPromise(submissionsTx(db, 'readwrite').clear() as unknown as IDBRequest<undefined>);
    lastPersistError = null;
  } catch (err) {
    lastPersistError = new SubmissionStorageError(`Failed to clear submissions in IndexedDB: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Loads the in-memory cache from IndexedDB (if any records already exist
 * there) and, only if IndexedDB is empty, imports the legacy localStorage
 * records as the one-time migration described in the module doc comment.
 * Idempotent and safe to call more than once — subsequent calls resolve
 * the same (already-settled) promise rather than re-hydrating. */
export function whenSubmissionStoreHydrated(): Promise<void> {
  if (!hydration) {
    hydration = (async () => {
      if (!idbAvailable()) {
        cache = readLegacyLocalStorageRecords();
        return;
      }
      try {
        const db = await openDb();
        const existing = await requestAsPromise(submissionsTx(db, 'readonly').getAll() as IDBRequest<SubmissionRecord[]>);
        if (existing.length > 0) {
          cache = existing.filter(isValidSubmissionRecord).map(normalizeSubmissionRecord);
          return;
        }
        const legacy = readLegacyLocalStorageRecords();
        cache = legacy;
        if (legacy.length > 0) await persistToIndexedDb(legacy);
      } catch (err) {
        lastPersistError = new SubmissionStorageError(`Failed to hydrate submission store from IndexedDB: ${err instanceof Error ? err.message : String(err)}`);
        cache = readLegacyLocalStorageRecords();
      }
    })();
  }
  return hydration;
}

/** Surfaces the most recent background persistence failure, if any —
 * since every write in this module is synchronous-from-the-caller's-
 * perspective but persists asynchronously, a caller that wants to show
 * "your changes may not have saved" UI can poll this after a mutation
 * rather than the mutation function itself needing to be async. Cleared
 * to `null` on the next successful persist. */
export function getLastSubmissionPersistError(): SubmissionStorageError | null {
  return lastPersistError;
}

/** Test/reset-only: replaces the in-memory cache directly (bypassing
 * IndexedDB entirely) — used by this module's own test file and by
 * fixture setup elsewhere that wants deterministic, synchronous state
 * without waiting on `whenSubmissionStoreHydrated()`. */
export function seedSubmissionStoreForTest(records: SubmissionRecord[]): void {
  cache = records.map(normalizeSubmissionRecord);
  hydration = Promise.resolve();
}

/** Test-only: fully resets module state — empties the in-memory cache,
 * clears the `submissions` IndexedDB store (awaited, unlike the
 * fire-and-forget `clearSubmissionStore`), and forgets the hydration
 * promise so a subsequent `whenSubmissionStoreHydrated()` call actually
 * re-runs instead of resolving instantly against stale state. Needed
 * because `openDb()`'s connection (and this module's cache/hydration
 * promise) are module-level singletons that outlive any single `it()`
 * block within a test file. Use this between UNRELATED tests that want a
 * genuinely empty store on both sides. */
export async function resetSubmissionStoreForTest(): Promise<void> {
  cache = [];
  hydration = null;
  lastPersistError = null;
  await clearIndexedDb();
}

/** Test-only: forgets only the in-memory cache/hydration state, WITHOUT
 * touching whatever is already persisted in IndexedDB — simulates a fresh
 * page load against a database that already has real data in it (as
 * opposed to `resetSubmissionStoreForTest`, which also wipes IndexedDB
 * and is for isolating unrelated tests from each other). */
export function forgetInMemoryStateForTest(): void {
  cache = [];
  hydration = null;
}

export function loadSubmissions(): SubmissionRecord[] {
  return cache;
}

export function getSubmission(submissionId: string): SubmissionRecord | undefined {
  return cache.find((r) => r.submissionId === submissionId);
}

export function countSubmissions(): number {
  return cache.length;
}

/** Insert-or-replace by `submissionId` — the one write primitive every
 * other mutation in this module goes through, so "persist a record" has
 * exactly one implementation to get right. */
export function putSubmission(record: SubmissionRecord): void {
  const index = cache.findIndex((r) => r.submissionId === record.submissionId);
  cache = index === -1 ? [...cache, record] : cache.map((r, i) => (i === index ? record : r));
  void persistToIndexedDb([record]);
}

export function putSubmissionsBulk(records: SubmissionRecord[]): void {
  const byId = new Map(cache.map((r) => [r.submissionId, r]));
  for (const record of records) byId.set(record.submissionId, record);
  cache = [...byId.values()];
  void persistToIndexedDb(records);
}

export function deleteSubmission(submissionId: string): void {
  cache = cache.filter((r) => r.submissionId !== submissionId);
  void deleteFromIndexedDb(submissionId);
}

export function clearSubmissionStore(): void {
  cache = [];
  void clearIndexedDb();
}
