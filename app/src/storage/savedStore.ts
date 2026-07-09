import type { SavedItem } from '../components/SavedPanel';

// IndexedDB-backed store for the saved library. localStorage caps out
// around 5MB — a few dozen dense patterns — while IndexedDB quota is
// browser-managed and typically runs to gigabytes, making the library
// effectively unlimited for SVG-sized data. Falls back to localStorage
// automatically where IndexedDB isn't available (e.g. some file:// setups
// with the offline single-file build).

const DB_NAME = 'vsp-db';
const STORE = 'saved';
const LEGACY_LS_KEY = 'vsp-saved-v1';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function requestAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

// --- localStorage fallback (only used when IndexedDB is unavailable) ---

function lsLoad(): SavedItem[] {
  try {
    const raw = localStorage.getItem(LEGACY_LS_KEY);
    return raw ? (JSON.parse(raw) as SavedItem[]) : [];
  } catch {
    return [];
  }
}

function lsStore(items: SavedItem[]) {
  try {
    localStorage.setItem(LEGACY_LS_KEY, JSON.stringify(items));
  } catch {
    // quota exceeded — nothing else we can do in fallback mode
  }
}

// --- public API ---

/** Load the whole library, newest first. Also performs the one-time
 * migration of any legacy localStorage library into IndexedDB. Ask the
 * browser to protect the data from storage-pressure eviction while at it. */
export async function loadSavedItems(): Promise<SavedItem[]> {
  try {
    navigator.storage?.persist?.().catch(() => {});
  } catch {
    // storage manager unavailable — non-fatal
  }
  if (!idbAvailable()) return lsLoad().sort((a, b) => b.createdAt - a.createdAt);
  const db = await openDb();
  // Migrate legacy localStorage items (pre-v1.11) into IndexedDB once.
  const legacy = lsLoad();
  if (legacy.length > 0) {
    await bulkPutSavedItems(legacy);
    try {
      localStorage.removeItem(LEGACY_LS_KEY);
    } catch {
      // ignore
    }
  }
  const items = await requestAsPromise(tx(db, 'readonly').getAll() as IDBRequest<SavedItem[]>);
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function putSavedItem(item: SavedItem): Promise<void> {
  if (!idbAvailable()) {
    const items = lsLoad().filter((s) => s.id !== item.id);
    lsStore([item, ...items]);
    return;
  }
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').put(item));
}

export async function bulkPutSavedItems(items: SavedItem[]): Promise<void> {
  if (items.length === 0) return;
  if (!idbAvailable()) {
    const existing = lsLoad();
    const ids = new Set(items.map((i) => i.id));
    lsStore([...items, ...existing.filter((s) => !ids.has(s.id))]);
    return;
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    const store = t.objectStore(STORE);
    items.forEach((i) => store.put(i));
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function deleteSavedItem(id: string): Promise<void> {
  if (!idbAvailable()) {
    lsStore(lsLoad().filter((s) => s.id !== id));
    return;
  }
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').delete(id));
}

export async function clearSavedItems(): Promise<void> {
  if (!idbAvailable()) {
    lsStore([]);
    return;
  }
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').clear());
}
