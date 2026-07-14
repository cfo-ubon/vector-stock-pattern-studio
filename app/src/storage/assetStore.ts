import type { Asset } from '../assets/types';
import { openDb, idbAvailable, requestAsPromise, lsLoad, lsStore, ASSETS_STORE } from './db';

// Asset Ecosystem Engine (Phase 9) — the persisted Asset Library.
// IndexedDB-backed, keyed by `metadata.id`, exactly mirroring
// `storage/savedStore.ts`'s shape (same shared `db.ts` plumbing, same
// localStorage fallback for environments without IndexedDB) — this is
// Section 7's "Libraries": the full durable store every extracted/
// decomposed/varied `Asset` record lives in, independent of any single
// Project, so it can genuinely be "reused across future collections".

const LOCAL_STORAGE_KEY = 'vsp-assets-v1';

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(ASSETS_STORE, mode).objectStore(ASSETS_STORE);
}

export async function loadAssets(): Promise<Asset[]> {
  try {
    navigator.storage?.persist?.().catch(() => {});
  } catch {
    // storage manager unavailable — non-fatal
  }
  if (!idbAvailable()) return lsLoad<Asset>(LOCAL_STORAGE_KEY).sort((a, b) => b.metadata.createdAt - a.metadata.createdAt);
  const db = await openDb();
  const items = await requestAsPromise(tx(db, 'readonly').getAll() as IDBRequest<Asset[]>);
  return items.sort((a, b) => b.metadata.createdAt - a.metadata.createdAt);
}

export async function putAsset(asset: Asset): Promise<void> {
  if (!idbAvailable()) {
    const items = lsLoad<Asset>(LOCAL_STORAGE_KEY).filter((a) => a.metadata.id !== asset.metadata.id);
    lsStore(LOCAL_STORAGE_KEY, [asset, ...items]);
    return;
  }
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').put(asset));
}

export async function bulkPutAssets(assets: Asset[]): Promise<void> {
  if (assets.length === 0) return;
  if (!idbAvailable()) {
    const existing = lsLoad<Asset>(LOCAL_STORAGE_KEY);
    const ids = new Set(assets.map((a) => a.metadata.id));
    lsStore(LOCAL_STORAGE_KEY, [...assets, ...existing.filter((a) => !ids.has(a.metadata.id))]);
    return;
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(ASSETS_STORE, 'readwrite');
    const store = t.objectStore(ASSETS_STORE);
    assets.forEach((a) => store.put(a));
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function deleteAsset(id: string): Promise<void> {
  if (!idbAvailable()) {
    lsStore(LOCAL_STORAGE_KEY, lsLoad<Asset>(LOCAL_STORAGE_KEY).filter((a) => a.metadata.id !== id));
    return;
  }
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').delete(id));
}

export async function clearAssets(): Promise<void> {
  if (!idbAvailable()) {
    lsStore(LOCAL_STORAGE_KEY, []);
    return;
  }
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').clear());
}
