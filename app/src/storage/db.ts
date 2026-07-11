// Shared IndexedDB plumbing for every persisted store in the app (saved
// library, and now the Project System). One database, one shared version
// number: every store owns its own name/shape but the *opening* — and the
// one IDBOpenDBRequest.onupgradeneeded that's allowed to create new object
// stores — lives here, so adding a new store (as Project System does) is a
// version bump + one `createObjectStore` call, not a second competing
// `indexedDB.open(DB_NAME, ...)` call that could race/conflict with this one.

export const DB_NAME = 'vsp-db';
// v1 (v1.11): 'saved' store only. v2 (Project Studio Engine): adds
// 'projects'.
export const DB_VERSION = 2;
export const SAVED_STORE = 'saved';
export const PROJECTS_STORE = 'projects';

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(SAVED_STORE)) db.createObjectStore(SAVED_STORE, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(PROJECTS_STORE)) db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
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
