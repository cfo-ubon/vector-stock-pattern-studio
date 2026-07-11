import type { SavedItem } from '../components/SavedPanel';
import { openDb, idbAvailable, requestAsPromise, lsLoad, lsStore, SAVED_STORE } from './db';

// IndexedDB-backed store for the saved library. localStorage caps out
// around 5MB — a few dozen dense patterns — while IndexedDB quota is
// browser-managed and typically runs to gigabytes, making the library
// effectively unlimited for SVG-sized data. Falls back to localStorage
// automatically where IndexedDB isn't available (e.g. some file:// setups
// with the offline single-file build).

const LEGACY_LS_KEY = 'vsp-saved-v1';

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(SAVED_STORE, mode).objectStore(SAVED_STORE);
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
  if (!idbAvailable()) return lsLoad<SavedItem>(LEGACY_LS_KEY).sort((a, b) => b.createdAt - a.createdAt);
  const db = await openDb();
  // Migrate legacy localStorage items (pre-v1.11) into IndexedDB once.
  const legacy = lsLoad<SavedItem>(LEGACY_LS_KEY);
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
    const items = lsLoad<SavedItem>(LEGACY_LS_KEY).filter((s) => s.id !== item.id);
    lsStore(LEGACY_LS_KEY, [item, ...items]);
    return;
  }
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').put(item));
}

export async function bulkPutSavedItems(items: SavedItem[]): Promise<void> {
  if (items.length === 0) return;
  if (!idbAvailable()) {
    const existing = lsLoad<SavedItem>(LEGACY_LS_KEY);
    const ids = new Set(items.map((i) => i.id));
    lsStore(LEGACY_LS_KEY, [...items, ...existing.filter((s) => !ids.has(s.id))]);
    return;
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(SAVED_STORE, 'readwrite');
    const store = t.objectStore(SAVED_STORE);
    items.forEach((i) => store.put(i));
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function deleteSavedItem(id: string): Promise<void> {
  if (!idbAvailable()) {
    lsStore(LEGACY_LS_KEY, lsLoad<SavedItem>(LEGACY_LS_KEY).filter((s) => s.id !== id));
    return;
  }
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').delete(id));
}

export async function clearSavedItems(): Promise<void> {
  if (!idbAvailable()) {
    lsStore(LEGACY_LS_KEY, []);
    return;
  }
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').clear());
}
