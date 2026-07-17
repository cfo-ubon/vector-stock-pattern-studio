import { openDb, idbAvailable, requestAsPromise, COLLECTIONS_STORE, PORTFOLIO_ASSETS_STORE } from '../../storage/db';
import type { Collection } from '../domain/collection';
import { normalizeCollection } from '../domain/collection';
import type { PortfolioAsset } from '../domain/types';

// Portfolio Manager P2 Stage 1 storage layer for `Collection` records —
// same IndexedDB-only convention as `portfolioStore.ts` (see that file's
// header comment for the rationale; unchanged here). This module is the
// only place that opens a raw `IDBTransaction` against `COLLECTIONS_STORE`
// or spans it together with `PORTFOLIO_ASSETS_STORE` — `services/
// collectionService.ts` never touches `indexedDB` directly, matching the
// existing domain -> storage -> import -> services -> UI layering.

export class CollectionStorageUnavailableError extends Error {
  constructor() {
    super('Portfolio Manager requires a browser with IndexedDB support. This device/browser does not have it available.');
    this.name = 'CollectionStorageUnavailableError';
  }
}

export function collectionStorageAvailable(): boolean {
  return idbAvailable();
}

function assertAvailable(): void {
  if (!idbAvailable()) throw new CollectionStorageUnavailableError();
}

function collectionsTx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(COLLECTIONS_STORE, mode).objectStore(COLLECTIONS_STORE);
}

/** Alphabetical by name — the sensible default browsing order for a
 * folder-like list of collections (unlike `loadPortfolioAssets`'s
 * newest-imported-first, which suits a growing catalog of individual
 * files better than a comparatively small, stable set of named
 * collections). `services/collectionService.ts` re-sorts when a caller
 * needs a different order (e.g. `searchByName` relevance). */
export async function loadCollections(): Promise<Collection[]> {
  assertAvailable();
  const db = await openDb();
  const items = await requestAsPromise(collectionsTx(db, 'readonly').getAll() as IDBRequest<Collection[]>);
  return items.map(normalizeCollection).sort((a, b) => a.normalizedName.localeCompare(b.normalizedName));
}

export async function getCollection(id: string): Promise<Collection | undefined> {
  assertAvailable();
  const db = await openDb();
  const item = await requestAsPromise(collectionsTx(db, 'readonly').get(id) as IDBRequest<Collection | undefined>);
  return item ? normalizeCollection(item) : undefined;
}

/** Single-record create-or-update — used by every `collectionService.ts`
 * operation that only touches the `collections` store (create, rename,
 * update description, archive, unarchive, cover-asset repair). Callers
 * are responsible for bumping `updatedAt` before calling this (kept here
 * as a pure persistence primitive, mirroring `portfolioStore.putPortfolioAsset`). */
export async function putCollectionRecord(collection: Collection): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(collectionsTx(db, 'readwrite').put(collection));
}

/** Same rationale as `portfolioStore.putPortfolioAssetsBulk` — one
 * transaction for many records, used by
 * `collectionService.repairCoverAssetIntegrity()` so a repair pass
 * touching several collections at once is atomic. */
export async function putCollectionRecordsBulk(collections: Collection[]): Promise<void> {
  assertAvailable();
  if (collections.length === 0) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(COLLECTIONS_STORE, 'readwrite');
    const store = t.objectStore(COLLECTIONS_STORE);
    for (const collection of collections) store.put(collection);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error('Bulk collection write transaction aborted'));
  });
}

export async function countCollections(): Promise<number> {
  assertAvailable();
  const db = await openDb();
  return requestAsPromise(collectionsTx(db, 'readonly').count() as IDBRequest<number>);
}

/** Raw record delete — does NOT cascade into `PortfolioAsset.collectionIds`
 * (Rule 8 requires that cascade, but it spans two stores and needs the
 * caller to have already computed which assets are affected — see
 * `deleteCollectionCascade` below, which `collectionService.deleteCollectionSafely`
 * actually calls). Exposed separately because the repository contract
 * (Section 4 of the brief) asks for a plain `delete`, and a raw,
 * non-cascading delete is occasionally the correct primitive on its own
 * (e.g. deleting a collection already known to have zero members). */
export async function deleteCollectionRecord(id: string): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(collectionsTx(db, 'readwrite').delete(id));
}

/** Atomically deletes one collection record and writes back every
 * already-updated asset that referenced it, in a single transaction
 * spanning `collections` + `portfolioAssets` — the same "read outside the
 * transaction, write inside one atomic transaction" shape as
 * `portfolioStore.deletePortfolioAssetAndFiles`. `updatedAssets` must
 * already have `collectionId` removed from their `collectionIds` (the
 * caller, `collectionService.deleteCollectionSafely`, computes this via
 * `domain/collectionMembership.ts`'s `removeCollectionMembership`) — this
 * function only persists, it does not compute membership changes, keeping
 * IndexedDB-specific code and domain logic separated. */
export async function deleteCollectionCascade(collectionId: string, updatedAssets: PortfolioAsset[]): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction([COLLECTIONS_STORE, PORTFOLIO_ASSETS_STORE], 'readwrite');
    t.objectStore(COLLECTIONS_STORE).delete(collectionId);
    const assetsStore = t.objectStore(PORTFOLIO_ASSETS_STORE);
    for (const asset of updatedAssets) assetsStore.put(asset);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error('Collection delete-cascade transaction aborted'));
  });
}

/** In-memory case-insensitive substring search — collections are a small,
 * bounded set (P1's own `searchPortfolioAssets` uses the same "load then
 * `.filter()`" convention for the much larger asset catalog; a ~100-row
 * collection list has no need for an IndexedDB range query). */
export async function searchCollectionsByName(query: string): Promise<Collection[]> {
  const all = await loadCollections();
  const needle = query.trim().toLowerCase();
  if (!needle) return all;
  return all.filter((c) => c.normalizedName.includes(needle));
}

/** Test/reset-only — mirrors `portfolioStore.clearPortfolioStores`'s
 * explicit "only for explicit test/reset contexts" convention. */
export async function clearCollectionsStore(): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(collectionsTx(db, 'readwrite').clear());
}
