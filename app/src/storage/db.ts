// Shared IndexedDB plumbing for every persisted store in the app (saved
// library, and now the Project System). One database, one shared version
// number: every store owns its own name/shape but the *opening* — and the
// one IDBOpenDBRequest.onupgradeneeded that's allowed to create new object
// stores — lives here, so adding a new store (as Project System does) is a
// version bump + one `createObjectStore` call, not a second competing
// `indexedDB.open(DB_NAME, ...)` call that could race/conflict with this one.

export const DB_NAME = 'vsp-db';
// v1 (v1.11): 'saved' store only. v2 (Project Studio Engine): adds
// 'projects'. v3 (Asset Ecosystem Engine, Phase 9): adds 'assets'. v4
// (Portfolio Manager P1): adds 'portfolioAssets' (metadata records, no
// binary bodies, keyed by `assetId` — kept small for fast list/search) and
// 'portfolioFiles' (imported source file bodies as Blobs, keyed by
// `fileId`, indexed by `assetId` and `sha256` for orphan/duplicate lookups
// without a full-store scan). v5 (Portfolio Manager P2 Stage 1): adds
// 'collections' (one row per user-defined `Collection`, keyed by `id`,
// indexed by `normalizedName` for case-insensitive duplicate-name lookups
// and `isArchived` for the active/archived filter) — asset<->collection
// *membership* is NOT a new store; it continues to live on
// `PortfolioAsset.collectionIds` (already reserved by P1), see
// `docs/portfolio/COLLECTION_ARCHITECTURE.md` / ADR-005.
//
// v6 (Build 026, Production Portfolio & Commercial Feedback Engine): adds
// 8 new stores. `submissions` REPLACES `catalog/submission/submissionStore.ts`'s
// prior localStorage-only persistence (BUILD_026_AUDIT.md Section 5's
// confirmed storage risk — a single-key JSON blob does not scale to
// thousands of patterns x multiple marketplaces); the migration that reads
// the old localStorage key and writes every record into this store runs
// once, in `submissionStore.ts`, the first time it opens after this
// upgrade — this `onupgradeneeded` handler only creates the empty store,
// it does not touch localStorage (kept deliberately separate: an
// IndexedDB schema upgrade must not depend on synchronous localStorage
// access, and the migration needs its own error handling/reporting, not a
// silent side effect of opening the database). The other 7 stores back
// entirely new Build 026 modules and have no prior data to migrate.
export const DB_VERSION = 6;
export const SAVED_STORE = 'saved';
export const PROJECTS_STORE = 'projects';
export const ASSETS_STORE = 'assets';
export const PORTFOLIO_ASSETS_STORE = 'portfolioAssets';
export const PORTFOLIO_FILES_STORE = 'portfolioFiles';
export const COLLECTIONS_STORE = 'collections';
export const SUBMISSIONS_STORE = 'submissions';
export const QUALITY_SNAPSHOTS_STORE = 'qualitySnapshots';
export const SALES_EVENTS_STORE = 'salesEvents';
export const REJECTION_RECORDS_STORE = 'rejectionRecords';
export const PRODUCTION_QUEUE_STORE = 'productionQueueItems';
export const PRODUCTION_BATCHES_STORE = 'productionBatches';
export const IMPORT_HISTORY_STORE = 'importHistory';
export const MARKETPLACE_REGISTRATIONS_STORE = 'marketplaceRegistrations';

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        // Every branch below is idempotent (`objectStoreNames.contains`
        // guarded) so this handler is safe to run on a fresh database
        // (every store created in one pass) or an upgrade from any prior
        // version (only the missing stores are created) — the normal
        // IndexedDB upgrade lifecycle already guarantees `onupgradeneeded`
        // only fires once per version increase, and re-running it against
        // an already-current database is a correct no-op, not a duplicate-
        // store error.
        if (!db.objectStoreNames.contains(SAVED_STORE)) db.createObjectStore(SAVED_STORE, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(PROJECTS_STORE)) db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(ASSETS_STORE)) db.createObjectStore(ASSETS_STORE, { keyPath: 'metadata.id' });
        if (!db.objectStoreNames.contains(PORTFOLIO_ASSETS_STORE)) {
          db.createObjectStore(PORTFOLIO_ASSETS_STORE, { keyPath: 'assetId' });
        }
        if (!db.objectStoreNames.contains(PORTFOLIO_FILES_STORE)) {
          const files = db.createObjectStore(PORTFOLIO_FILES_STORE, { keyPath: 'fileId' });
          files.createIndex('assetId', 'assetId', { unique: false });
          files.createIndex('sha256', 'sha256', { unique: false });
        }
        if (!db.objectStoreNames.contains(COLLECTIONS_STORE)) {
          const collections = db.createObjectStore(COLLECTIONS_STORE, { keyPath: 'id' });
          collections.createIndex('normalizedName', 'normalizedName', { unique: false });
          collections.createIndex('isArchived', 'isArchived', { unique: false });
        }
        if (!db.objectStoreNames.contains(SUBMISSIONS_STORE)) {
          const submissions = db.createObjectStore(SUBMISSIONS_STORE, { keyPath: 'submissionId' });
          submissions.createIndex('patternId', 'patternId', { unique: false });
          submissions.createIndex('marketplaceId', 'marketplaceId', { unique: false });
          submissions.createIndex('status', 'status', { unique: false });
          submissions.createIndex('productionAssetId', 'productionAssetId', { unique: false });
        }
        if (!db.objectStoreNames.contains(QUALITY_SNAPSHOTS_STORE)) {
          const quality = db.createObjectStore(QUALITY_SNAPSHOTS_STORE, { keyPath: 'snapshotId' });
          quality.createIndex('assetId', 'assetId', { unique: false });
          quality.createIndex('productionAssetId', 'productionAssetId', { unique: false });
        }
        if (!db.objectStoreNames.contains(SALES_EVENTS_STORE)) {
          const sales = db.createObjectStore(SALES_EVENTS_STORE, { keyPath: 'eventId' });
          sales.createIndex('productionAssetId', 'productionAssetId', { unique: false });
          sales.createIndex('marketplaceId', 'marketplaceId', { unique: false });
        }
        if (!db.objectStoreNames.contains(REJECTION_RECORDS_STORE)) {
          const rejections = db.createObjectStore(REJECTION_RECORDS_STORE, { keyPath: 'rejectionId' });
          rejections.createIndex('submissionId', 'submissionId', { unique: false });
          rejections.createIndex('normalizedReason', 'normalizedReason', { unique: false });
        }
        if (!db.objectStoreNames.contains(PRODUCTION_QUEUE_STORE)) {
          const queue = db.createObjectStore(PRODUCTION_QUEUE_STORE, { keyPath: 'queueItemId' });
          queue.createIndex('status', 'status', { unique: false });
          queue.createIndex('batchId', 'batchId', { unique: false });
        }
        if (!db.objectStoreNames.contains(PRODUCTION_BATCHES_STORE)) {
          db.createObjectStore(PRODUCTION_BATCHES_STORE, { keyPath: 'batchId' });
        }
        if (!db.objectStoreNames.contains(IMPORT_HISTORY_STORE)) {
          const importHistory = db.createObjectStore(IMPORT_HISTORY_STORE, { keyPath: 'importId' });
          importHistory.createIndex('importedAt', 'importedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(MARKETPLACE_REGISTRATIONS_STORE)) {
          db.createObjectStore(MARKETPLACE_REGISTRATIONS_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

export function idbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

export function requestAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Generic localStorage fallback (only used when IndexedDB is unavailable,
 * e.g. some file:// setups with the offline single-file build) — shared by
 * every store instead of each re-implementing the same load/store/parse
 * logic under a different key. */
export function lsLoad<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

export function lsStore<T>(key: string, items: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // quota exceeded — nothing else we can do in fallback mode
  }
}
