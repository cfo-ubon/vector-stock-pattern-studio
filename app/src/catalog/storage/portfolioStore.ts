import { openDb, idbAvailable, requestAsPromise, PORTFOLIO_ASSETS_STORE, PORTFOLIO_FILES_STORE } from '../../storage/db';
import type { PortfolioAsset, PortfolioFileRecord } from '../domain/types';
import { normalizePortfolioAsset } from '../domain/asset';

// Portfolio Manager P1 storage layer. Per the sprint brief's explicit
// architecture instruction ("Do not use LocalStorage for asset files or
// the primary catalog") this store is IndexedDB-only — unlike every other
// `storage/*Store.ts` in the app, it does NOT fall back to localStorage,
// both because binary Blob bodies cannot survive `JSON.stringify` and
// because localStorage's ~5-10MB quota cannot hold a real asset library.
// `portfolioAvailable()` lets the UI show a clear, honest error instead of
// silently degrading.

export class PortfolioStorageUnavailableError extends Error {
  constructor() {
    super('Portfolio Manager requires a browser with IndexedDB support. This device/browser does not have it available.');
    this.name = 'PortfolioStorageUnavailableError';
  }
}

export function portfolioStorageAvailable(): boolean {
  return idbAvailable();
}

function assertAvailable(): void {
  if (!idbAvailable()) throw new PortfolioStorageUnavailableError();
}

function assetsTx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(PORTFOLIO_ASSETS_STORE, mode).objectStore(PORTFOLIO_ASSETS_STORE);
}

function filesTx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(PORTFOLIO_FILES_STORE, mode).objectStore(PORTFOLIO_FILES_STORE);
}

export async function loadPortfolioAssets(): Promise<PortfolioAsset[]> {
  assertAvailable();
  const db = await openDb();
  const items = await requestAsPromise(assetsTx(db, 'readonly').getAll() as IDBRequest<PortfolioAsset[]>);
  return items.map(normalizePortfolioAsset).sort((a, b) => b.importedAt - a.importedAt);
}

export async function getPortfolioAsset(assetId: string): Promise<PortfolioAsset | undefined> {
  assertAvailable();
  const db = await openDb();
  const item = await requestAsPromise(assetsTx(db, 'readonly').get(assetId) as IDBRequest<PortfolioAsset | undefined>);
  return item ? normalizePortfolioAsset(item) : undefined;
}

export async function putPortfolioAsset(asset: PortfolioAsset): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(assetsTx(db, 'readwrite').put(asset));
}

export async function loadFilesForAsset(assetId: string): Promise<PortfolioFileRecord[]> {
  assertAvailable();
  const db = await openDb();
  const store = filesTx(db, 'readonly');
  const index = store.index('assetId');
  return requestAsPromise(index.getAll(assetId) as IDBRequest<PortfolioFileRecord[]>);
}

export async function getPortfolioFile(fileId: string): Promise<PortfolioFileRecord | undefined> {
  assertAvailable();
  const db = await openDb();
  return requestAsPromise(filesTx(db, 'readonly').get(fileId) as IDBRequest<PortfolioFileRecord | undefined>);
}

export async function loadAllPortfolioFiles(): Promise<PortfolioFileRecord[]> {
  assertAvailable();
  const db = await openDb();
  return requestAsPromise(filesTx(db, 'readonly').getAll() as IDBRequest<PortfolioFileRecord[]>);
}

export async function findFilesByHash(sha256: string): Promise<PortfolioFileRecord[]> {
  assertAvailable();
  const db = await openDb();
  const index = filesTx(db, 'readonly').index('sha256');
  return requestAsPromise(index.getAll(sha256) as IDBRequest<PortfolioFileRecord[]>);
}

/** Atomically create one catalog record and all of its source-file bodies
 * in a single IndexedDB transaction spanning both stores — either every
 * write lands or none do (a mid-import crash/error automatically rolls
 * back via the transaction's own `onerror`/`onabort`, no partial asset
 * with missing files can ever be observed by a reader). This is the one
 * and only import write path — the import pipeline never calls
 * `putPortfolioAsset` directly for a new asset. */
export async function importAssetTransaction(asset: PortfolioAsset, files: PortfolioFileRecord[]): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction([PORTFOLIO_ASSETS_STORE, PORTFOLIO_FILES_STORE], 'readwrite');
    t.objectStore(PORTFOLIO_ASSETS_STORE).put(asset);
    const fileStore = t.objectStore(PORTFOLIO_FILES_STORE);
    for (const f of files) fileStore.put(f);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error('Import transaction aborted'));
  });
}

/** "Remove catalog record only" — the non-default, explicitly-opted-into
 * deletion mode (Section 7): keeps the stored file bodies around
 * (recoverable via a future "restore from orphans" pass) but the asset no
 * longer appears in the catalog. */
export async function deletePortfolioAssetRecordOnly(assetId: string): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(assetsTx(db, 'readwrite').delete(assetId));
}

/** "Remove catalog record and locally stored copies" — the default,
 * safer-looking-but-actually-more-destructive option is intentionally NOT
 * the default in the UI layer (see `services/deleteAsset.ts`); this
 * function is the mechanism, atomic across both stores like import. */
export async function deletePortfolioAssetAndFiles(assetId: string): Promise<void> {
  assertAvailable();
  const db = await openDb();
  const files = await loadFilesForAsset(assetId);
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction([PORTFOLIO_ASSETS_STORE, PORTFOLIO_FILES_STORE], 'readwrite');
    t.objectStore(PORTFOLIO_ASSETS_STORE).delete(assetId);
    const fileStore = t.objectStore(PORTFOLIO_FILES_STORE);
    for (const f of files) fileStore.delete(f.fileId);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error('Delete transaction aborted'));
  });
}

export async function clearPortfolioStores(): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction([PORTFOLIO_ASSETS_STORE, PORTFOLIO_FILES_STORE], 'readwrite');
    t.objectStore(PORTFOLIO_ASSETS_STORE).clear();
    t.objectStore(PORTFOLIO_FILES_STORE).clear();
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
