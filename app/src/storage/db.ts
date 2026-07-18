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
export const DB_VERSION = 5;
export const SAVED_STORE = 'saved';
export const PROJECTS_STORE = 'projects';
export const ASSETS_STORE = 'assets';
export const PORTFOLIO_ASSETS_STORE = 'portfolioAssets';
export const PORTFOLIO_FILES_STORE = 'portfolioFiles';
export const COLLECTIONS_STORE = 'collections';

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
