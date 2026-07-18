import { describe, it, expect, beforeEach } from 'vitest';
import {
  collectionStorageAvailable,
  loadCollections,
  getCollection,
  putCollectionRecord,
  countCollections,
  deleteCollectionRecord,
  deleteCollectionCascade,
  searchCollectionsByName,
  clearCollectionsStore,
} from './collectionStore';
import { createCollection } from '../domain/collection';
import { clearPortfolioStores, importAssetTransaction, getPortfolioAsset } from './portfolioStore';
import { createPortfolioAsset } from '../domain/asset';

beforeEach(async () => {
  await clearCollectionsStore();
  await clearPortfolioStores();
});

describe('collectionStore', () => {
  it('reports IndexedDB as available under the fake-indexeddb test polyfill', () => {
    expect(collectionStorageAvailable()).toBe(true);
  });

  it('putCollectionRecord + getCollection round-trips a record (create)', async () => {
    const c = createCollection({ name: 'Spring Florals' });
    await putCollectionRecord(c);
    const loaded = await getCollection(c.id);
    expect(loaded?.name).toBe('Spring Florals');
  });

  it('getCollection returns undefined for an unknown id', async () => {
    expect(await getCollection('COL-does-not-exist')).toBeUndefined();
  });

  it('putCollectionRecord updates an existing record in place (no duplicate row)', async () => {
    const c = createCollection({ name: 'Original' });
    await putCollectionRecord(c);
    await putCollectionRecord({ ...c, name: 'Renamed', updatedAt: c.updatedAt + 1 });
    const all = await loadCollections();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Renamed');
  });

  it('loadCollections returns every record, sorted alphabetically by name', async () => {
    await putCollectionRecord(createCollection({ name: 'Zebra Prints' }));
    await putCollectionRecord(createCollection({ name: 'Autumn Leaves' }));
    await putCollectionRecord(createCollection({ name: 'Mountain Scenes' }));
    const all = await loadCollections();
    expect(all.map((c) => c.name)).toEqual(['Autumn Leaves', 'Mountain Scenes', 'Zebra Prints']);
  });

  it('countCollections reflects the real stored count', async () => {
    expect(await countCollections()).toBe(0);
    await putCollectionRecord(createCollection({ name: 'One' }));
    await putCollectionRecord(createCollection({ name: 'Two' }));
    expect(await countCollections()).toBe(2);
  });

  it('deleteCollectionRecord removes the record (archive/unarchive/rename are single-record put updates covered by putCollectionRecord above)', async () => {
    const c = createCollection({ name: 'To delete' });
    await putCollectionRecord(c);
    await deleteCollectionRecord(c.id);
    expect(await getCollection(c.id)).toBeUndefined();
  });

  it('searchCollectionsByName matches case-insensitively on a substring', async () => {
    await putCollectionRecord(createCollection({ name: 'Spring Florals' }));
    await putCollectionRecord(createCollection({ name: 'Winter Frost' }));
    const results = await searchCollectionsByName('SPRING');
    expect(results.map((c) => c.name)).toEqual(['Spring Florals']);
  });

  it('searchCollectionsByName with an empty query returns every collection', async () => {
    await putCollectionRecord(createCollection({ name: 'A' }));
    await putCollectionRecord(createCollection({ name: 'B' }));
    expect(await searchCollectionsByName('   ')).toHaveLength(2);
  });

  it('clearCollectionsStore empties the store', async () => {
    await putCollectionRecord(createCollection({ name: 'A' }));
    await clearCollectionsStore();
    expect(await loadCollections()).toHaveLength(0);
  });

  it('persists across a fresh load (no in-memory-only state)', async () => {
    const c = createCollection({ name: 'Persisted' });
    await putCollectionRecord(c);
    // A second independent read must see the same data — this store has
    // no cache of its own, every call re-reads via `openDb()`'s shared
    // (but real, not mocked) IndexedDB connection.
    const first = await loadCollections();
    const second = await loadCollections();
    expect(first).toEqual(second);
    expect(first[0].id).toBe(c.id);
  });

  describe('deleteCollectionCascade — atomic cross-store delete + membership cleanup (Rule 8)', () => {
    it('deletes the collection record and persists the caller-supplied updated assets in one transaction', async () => {
      const collection = createCollection({ name: 'To cascade-delete' });
      await putCollectionRecord(collection);

      const asset = createPortfolioAsset({ displayName: 'Member', originalFilename: 'x.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
      const memberAsset = { ...asset, collectionIds: [collection.id] };
      await importAssetTransaction(memberAsset, []);

      const updatedAsset = { ...memberAsset, collectionIds: [] };
      await deleteCollectionCascade(collection.id, [updatedAsset]);

      expect(await getCollection(collection.id)).toBeUndefined();
      const reloaded = await getPortfolioAsset(asset.assetId);
      expect(reloaded?.collectionIds).toEqual([]);
    });

    it('does not delete the asset itself — only its collectionIds are updated (Rule 9)', async () => {
      const collection = createCollection({ name: 'Delete me' });
      await putCollectionRecord(collection);
      const asset = createPortfolioAsset({ displayName: 'Untouched asset', originalFilename: 'x.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
      const memberAsset = { ...asset, collectionIds: [collection.id] };
      await importAssetTransaction(memberAsset, []);

      await deleteCollectionCascade(collection.id, [{ ...memberAsset, collectionIds: [] }]);

      const reloaded = await getPortfolioAsset(asset.assetId);
      expect(reloaded).toBeDefined();
      expect(reloaded?.displayName).toBe('Untouched asset');
    });

    it('works with zero affected assets (a collection with no members)', async () => {
      const collection = createCollection({ name: 'Empty collection' });
      await putCollectionRecord(collection);
      await deleteCollectionCascade(collection.id, []);
      expect(await getCollection(collection.id)).toBeUndefined();
    });
  });
});
