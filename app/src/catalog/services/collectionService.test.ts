import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCollectionService,
  renameCollection,
  updateCollectionDescription,
  archiveCollection,
  unarchiveCollection,
  deleteCollectionSafely,
  setCollectionCoverAsset,
  assignAssetToCollection,
  removeAssetFromCollection,
  assignAssetsToCollections,
  removeAssetsFromCollections,
  getAssetsForCollection,
  getCollectionsForAsset,
  validateCollectionIntegrity,
  repairOrphanedCollectionIds,
  repairCoverAssetIntegrity,
  CollectionNotFoundError,
  DuplicateCollectionNameError,
  ArchivedCollectionError,
  InvalidCoverAssetError,
} from './collectionService';
import { clearCollectionsStore, getCollection } from '../storage/collectionStore';
import { clearPortfolioStores, importAssetTransaction, getPortfolioAsset } from '../storage/portfolioStore';
import { createPortfolioAsset } from '../domain/asset';
import type { PortfolioAsset } from '../domain/types';

beforeEach(async () => {
  await clearCollectionsStore();
  await clearPortfolioStores();
});

async function makeAsset(displayName: string, overrides: Partial<PortfolioAsset> = {}): Promise<PortfolioAsset> {
  const asset = { ...createPortfolioAsset({ displayName, originalFilename: `${displayName}.svg`, sourceFileReferences: [], previewReference: null, metadataReference: null }), ...overrides };
  await importAssetTransaction(asset, []);
  return asset;
}

describe('createCollectionService', () => {
  it('creates a collection with a valid name', async () => {
    const c = await createCollectionService({ name: 'Spring Florals' });
    expect(c.name).toBe('Spring Florals');
    expect(await getCollection(c.id)).toBeDefined();
  });

  it('rejects a duplicate name (case-insensitive)', async () => {
    await createCollectionService({ name: 'Spring Florals' });
    await expect(createCollectionService({ name: '  spring   florals  ' })).rejects.toBeInstanceOf(DuplicateCollectionNameError);
  });

  it('rejects an invalid coverAssetId at creation time (Rule 12)', async () => {
    await expect(createCollectionService({ name: 'Bad Cover', coverAssetId: 'VSP-does-not-exist' })).rejects.toBeInstanceOf(InvalidCoverAssetError);
  });

  it('accepts a valid coverAssetId', async () => {
    const asset = await makeAsset('Cover Source');
    const c = await createCollectionService({ name: 'Good Cover', coverAssetId: asset.assetId });
    expect(c.coverAssetId).toBe(asset.assetId);
  });
});

describe('renameCollection', () => {
  it('renames and re-normalizes', async () => {
    const c = await createCollectionService({ name: 'Old Name' });
    const renamed = await renameCollection(c.id, 'New Name');
    expect(renamed.name).toBe('New Name');
    expect(renamed.normalizedName).toBe('new name');
  });

  it('throws for an unknown id', async () => {
    await expect(renameCollection('COL-nope', 'X')).rejects.toBeInstanceOf(CollectionNotFoundError);
  });

  it('rejects renaming to a name already used by a different collection', async () => {
    await createCollectionService({ name: 'Taken' });
    const c2 = await createCollectionService({ name: 'Available' });
    await expect(renameCollection(c2.id, 'Taken')).rejects.toBeInstanceOf(DuplicateCollectionNameError);
  });

  it('allows renaming a collection to its own current name (no false-positive duplicate)', async () => {
    const c = await createCollectionService({ name: 'Same Name' });
    await expect(renameCollection(c.id, 'Same Name')).resolves.toBeDefined();
  });

  it('collection identity (id) never changes across a rename (Rule 2)', async () => {
    const c = await createCollectionService({ name: 'Identity Check' });
    const renamed = await renameCollection(c.id, 'Renamed');
    expect(renamed.id).toBe(c.id);
  });
});

describe('updateCollectionDescription', () => {
  it('updates the description', async () => {
    const c = await createCollectionService({ name: 'Desc Test' });
    const updated = await updateCollectionDescription(c.id, 'A new description');
    expect(updated.description).toBe('A new description');
  });
});

describe('archive / unarchive (Rules 5, 6)', () => {
  it('archiving sets isArchived and archivedAt', async () => {
    const c = await createCollectionService({ name: 'To Archive' });
    const archived = await archiveCollection(c.id);
    expect(archived.isArchived).toBe(true);
    expect(archived.archivedAt).not.toBeNull();
  });

  it('an archived collection remains readable via getCollection', async () => {
    const c = await createCollectionService({ name: 'Readable When Archived' });
    await archiveCollection(c.id);
    const loaded = await getCollection(c.id);
    expect(loaded).toBeDefined();
    expect(loaded?.isArchived).toBe(true);
  });

  it('archived collections retain existing members', async () => {
    const asset = await makeAsset('Member');
    const c = await createCollectionService({ name: 'Has Members' });
    await assignAssetToCollection(asset.assetId, c.id);
    await archiveCollection(c.id);
    const members = await getAssetsForCollection(c.id);
    expect(members.map((a) => a.assetId)).toContain(asset.assetId);
  });

  it('unarchiving clears isArchived and archivedAt without touching members', async () => {
    const asset = await makeAsset('Member2');
    const c = await createCollectionService({ name: 'Round Trip' });
    await assignAssetToCollection(asset.assetId, c.id);
    await archiveCollection(c.id);
    const unarchived = await unarchiveCollection(c.id);
    expect(unarchived.isArchived).toBe(false);
    expect(unarchived.archivedAt).toBeNull();
    const members = await getAssetsForCollection(c.id);
    expect(members.map((a) => a.assetId)).toContain(asset.assetId);
  });
});

describe('archived-collection assignment policy (Rule 7 — documented decision: block new assignments, allow removal)', () => {
  it('blocks a new assignment to an archived collection', async () => {
    const asset = await makeAsset('Blocked Assignment');
    const c = await createCollectionService({ name: 'Locked' });
    await archiveCollection(c.id);
    await expect(assignAssetToCollection(asset.assetId, c.id)).rejects.toBeInstanceOf(ArchivedCollectionError);
  });

  it('still allows removing a member from an archived collection', async () => {
    const asset = await makeAsset('Removable While Archived');
    const c = await createCollectionService({ name: 'Locked But Removable' });
    await assignAssetToCollection(asset.assetId, c.id);
    await archiveCollection(c.id);
    await expect(removeAssetFromCollection(asset.assetId, c.id)).resolves.toBeUndefined();
    const reloaded = await getPortfolioAsset(asset.assetId);
    expect(reloaded?.collectionIds).not.toContain(c.id);
  });
});

describe('assignAssetToCollection / removeAssetFromCollection — single pair', () => {
  it('assigns and the asset shows up in getAssetsForCollection', async () => {
    const asset = await makeAsset('Single Assign');
    const c = await createCollectionService({ name: 'Single' });
    await assignAssetToCollection(asset.assetId, c.id);
    const members = await getAssetsForCollection(c.id);
    expect(members.map((a) => a.assetId)).toEqual([asset.assetId]);
  });

  it('one asset can belong to multiple collections (Rule 3)', async () => {
    const asset = await makeAsset('Multi Member');
    const c1 = await createCollectionService({ name: 'First' });
    const c2 = await createCollectionService({ name: 'Second' });
    await assignAssetToCollection(asset.assetId, c1.id);
    await assignAssetToCollection(asset.assetId, c2.id);
    const collections = await getCollectionsForAsset(asset.assetId);
    expect(collections.map((c) => c.id).sort()).toEqual([c1.id, c2.id].sort());
  });

  it('assigning twice does not create a duplicate membership (Rule 4)', async () => {
    const asset = await makeAsset('Dup Guard');
    const c = await createCollectionService({ name: 'Dup Target' });
    await assignAssetToCollection(asset.assetId, c.id);
    await assignAssetToCollection(asset.assetId, c.id);
    const reloaded = await getPortfolioAsset(asset.assetId);
    expect(reloaded?.collectionIds).toEqual([c.id]);
  });

  it('throws for a missing asset', async () => {
    const c = await createCollectionService({ name: 'Target' });
    await expect(assignAssetToCollection('VSP-missing', c.id)).rejects.toThrow();
  });

  it('throws for a missing collection', async () => {
    const asset = await makeAsset('Orphan Target');
    await expect(assignAssetToCollection(asset.assetId, 'COL-missing')).rejects.toBeInstanceOf(CollectionNotFoundError);
  });

  it('removing a non-member is a no-op, not an error', async () => {
    const asset = await makeAsset('Never Member');
    const c = await createCollectionService({ name: 'Empty' });
    await expect(removeAssetFromCollection(asset.assetId, c.id)).resolves.toBeUndefined();
  });
});

describe('assignAssetsToCollections / removeAssetsFromCollections — bulk many-to-many', () => {
  it('assigns every asset to every collection and reports accurate counts', async () => {
    const a1 = await makeAsset('Bulk A1');
    const a2 = await makeAsset('Bulk A2');
    const c1 = await createCollectionService({ name: 'Bulk C1' });
    const c2 = await createCollectionService({ name: 'Bulk C2' });

    const result = await assignAssetsToCollections([a1.assetId, a2.assetId], [c1.id, c2.id]);
    expect(result.requestedCount).toBe(4);
    expect(result.changedCount).toBe(4);
    expect(result.skippedCount).toBe(0);
    expect(result.failedCount).toBe(0);

    expect((await getAssetsForCollection(c1.id)).map((a) => a.assetId).sort()).toEqual([a1.assetId, a2.assetId].sort());
    expect((await getAssetsForCollection(c2.id)).map((a) => a.assetId).sort()).toEqual([a1.assetId, a2.assetId].sort());
  });

  it('a repeated bulk assignment reports skipped, not changed, for already-member pairs', async () => {
    const a1 = await makeAsset('Repeat A1');
    const c1 = await createCollectionService({ name: 'Repeat C1' });
    await assignAssetsToCollections([a1.assetId], [c1.id]);
    const second = await assignAssetsToCollections([a1.assetId], [c1.id]);
    expect(second.changedCount).toBe(0);
    expect(second.skippedCount).toBe(1);
  });

  it('reports structured failures for a missing asset and a missing collection within the same batch', async () => {
    const a1 = await makeAsset('Present Asset');
    const c1 = await createCollectionService({ name: 'Present Collection' });
    const result = await assignAssetsToCollections([a1.assetId, 'VSP-missing'], [c1.id, 'COL-missing']);
    expect(result.requestedCount).toBe(4);
    expect(result.failedCount).toBe(3); // (a1,missing-col) + (missing-asset,c1) + (missing-asset,missing-col)
    expect(result.changedCount).toBe(1); // (a1, c1)
    expect(result.failures.some((f) => f.reason === 'asset not found')).toBe(true);
    expect(result.failures.some((f) => f.reason === 'collection not found')).toBe(true);
  });

  it('bulk assign fails archived-collection pairs with a clear reason, without blocking other pairs', async () => {
    const a1 = await makeAsset('Mixed A1');
    const activeCollection = await createCollectionService({ name: 'Mixed Active' });
    const archivedCollection = await createCollectionService({ name: 'Mixed Archived' });
    await archiveCollection(archivedCollection.id);

    const result = await assignAssetsToCollections([a1.assetId], [activeCollection.id, archivedCollection.id]);
    expect(result.changedCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.failures[0].reason).toBe('collection is archived');
  });

  it('bulk remove clears membership and reports accurate counts', async () => {
    const a1 = await makeAsset('Remove A1');
    const c1 = await createCollectionService({ name: 'Remove C1' });
    await assignAssetsToCollections([a1.assetId], [c1.id]);

    const result = await removeAssetsFromCollections([a1.assetId], [c1.id]);
    expect(result.changedCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(await getAssetsForCollection(c1.id)).toHaveLength(0);
  });

  it('an empty request returns a zeroed result without touching storage', async () => {
    const result = await assignAssetsToCollections([], []);
    expect(result).toEqual({ requestedCount: 0, changedCount: 0, skippedCount: 0, failedCount: 0, failures: [] });
  });
});

describe('deleteCollectionSafely (Rules 8, 9)', () => {
  it('removes the collection id from every affected asset', async () => {
    const a1 = await makeAsset('Del A1');
    const a2 = await makeAsset('Del A2');
    const c = await createCollectionService({ name: 'To Delete' });
    await assignAssetsToCollections([a1.assetId, a2.assetId], [c.id]);

    await deleteCollectionSafely(c.id);

    expect(await getCollection(c.id)).toBeUndefined();
    expect((await getPortfolioAsset(a1.assetId))?.collectionIds).toEqual([]);
    expect((await getPortfolioAsset(a2.assetId))?.collectionIds).toEqual([]);
  });

  it('does not delete the member assets themselves (Rule 9)', async () => {
    const a1 = await makeAsset('Survives Deletion');
    const c = await createCollectionService({ name: 'Deleted Container' });
    await assignAssetToCollection(a1.assetId, c.id);
    await deleteCollectionSafely(c.id);
    expect(await getPortfolioAsset(a1.assetId)).toBeDefined();
  });

  it('leaves assets in unrelated collections untouched', async () => {
    const a1 = await makeAsset('Multi Collection Asset');
    const cDelete = await createCollectionService({ name: 'Delete This One' });
    const cKeep = await createCollectionService({ name: 'Keep This One' });
    await assignAssetsToCollections([a1.assetId], [cDelete.id, cKeep.id]);

    await deleteCollectionSafely(cDelete.id);

    const reloaded = await getPortfolioAsset(a1.assetId);
    expect(reloaded?.collectionIds).toEqual([cKeep.id]);
  });

  it('throws for an unknown collection id', async () => {
    await expect(deleteCollectionSafely('COL-missing')).rejects.toBeInstanceOf(CollectionNotFoundError);
  });
});

describe('deleting an asset must not delete collections (Rule 10)', () => {
  it('the collection still exists after its only member is deleted from the catalog', async () => {
    const { deletePortfolioAssetAndFiles } = await import('../storage/portfolioStore');
    const a1 = await makeAsset('Deleted From Catalog');
    const c = await createCollectionService({ name: 'Survives Asset Deletion' });
    await assignAssetToCollection(a1.assetId, c.id);

    await deletePortfolioAssetAndFiles(a1.assetId);

    expect(await getCollection(c.id)).toBeDefined();
  });
});

describe('setCollectionCoverAsset + integrity validation/repair (Rules 12, 13)', () => {
  it('sets a valid cover asset', async () => {
    const asset = await makeAsset('Valid Cover');
    const c = await createCollectionService({ name: 'Cover Target' });
    const updated = await setCollectionCoverAsset(c.id, asset.assetId);
    expect(updated.coverAssetId).toBe(asset.assetId);
  });

  it('rejects setting a cover asset that does not exist', async () => {
    const c = await createCollectionService({ name: 'Bad Cover Target' });
    await expect(setCollectionCoverAsset(c.id, 'VSP-missing')).rejects.toBeInstanceOf(InvalidCoverAssetError);
  });

  it('accepts clearing the cover asset back to null', async () => {
    const asset = await makeAsset('Clearable Cover');
    const c = await createCollectionService({ name: 'Clear Target' });
    await setCollectionCoverAsset(c.id, asset.assetId);
    const cleared = await setCollectionCoverAsset(c.id, null);
    expect(cleared.coverAssetId).toBeNull();
  });

  it('validateCollectionIntegrity finds no issues in a clean catalog', async () => {
    const asset = await makeAsset('Clean');
    const c = await createCollectionService({ name: 'Clean Collection' });
    await assignAssetToCollection(asset.assetId, c.id);
    const report = await validateCollectionIntegrity();
    expect(report.orphanedMemberships).toEqual([]);
    expect(report.invalidCoverAssetReferences).toEqual([]);
  });

  it('validateCollectionIntegrity detects an orphaned collectionId (Rule 11)', async () => {
    // Simulate drift: an asset references a collection id that was never
    // created (or was deleted via the raw repository, bypassing the
    // service's cascade) — importAssetTransaction bypasses collectionService.
    const asset = await makeAsset('Has Orphan', { collectionIds: ['COL-ghost'] });
    const report = await validateCollectionIntegrity();
    expect(report.orphanedMemberships).toEqual([{ assetId: asset.assetId, invalidCollectionIds: ['COL-ghost'] }]);
  });

  it('repairOrphanedCollectionIds removes the invalid id and leaves valid ones intact', async () => {
    const c = await createCollectionService({ name: 'Still Valid' });
    const asset = await makeAsset('Mixed Membership', { collectionIds: [c.id, 'COL-ghost'] });
    const result = await repairOrphanedCollectionIds();
    expect(result.changedCount).toBe(1);
    const reloaded = await getPortfolioAsset(asset.assetId);
    expect(reloaded?.collectionIds).toEqual([c.id]);
  });

  it('repairOrphanedCollectionIds is a no-op on a clean catalog', async () => {
    const result = await repairOrphanedCollectionIds();
    expect(result).toEqual({ requestedCount: 0, changedCount: 0, skippedCount: 0, failedCount: 0, failures: [] });
  });

  it('validateCollectionIntegrity detects a stale coverAssetId (Rule 13 drift)', async () => {
    const asset = await makeAsset('Will Be Deleted');
    const c = await createCollectionService({ name: 'Stale Cover' });
    await setCollectionCoverAsset(c.id, asset.assetId);

    const { deletePortfolioAssetAndFiles } = await import('../storage/portfolioStore');
    await deletePortfolioAssetAndFiles(asset.assetId);

    const report = await validateCollectionIntegrity();
    expect(report.invalidCoverAssetReferences).toEqual([{ collectionId: c.id, coverAssetId: asset.assetId }]);
  });

  it('repairCoverAssetIntegrity clears a stale coverAssetId to null', async () => {
    const asset = await makeAsset('Will Also Be Deleted');
    const c = await createCollectionService({ name: 'Repairable Cover' });
    await setCollectionCoverAsset(c.id, asset.assetId);

    const { deletePortfolioAssetAndFiles } = await import('../storage/portfolioStore');
    await deletePortfolioAssetAndFiles(asset.assetId);

    const result = await repairCoverAssetIntegrity();
    expect(result.changedCount).toBe(1);
    const reloaded = await getCollection(c.id);
    expect(reloaded?.coverAssetId).toBeNull();
  });
});

describe('getAssetsForCollection / getCollectionsForAsset', () => {
  it('getAssetsForCollection returns an empty array for a collection with no members', async () => {
    const c = await createCollectionService({ name: 'Empty Collection' });
    expect(await getAssetsForCollection(c.id)).toEqual([]);
  });

  it('getCollectionsForAsset returns an empty array for an asset in no collections', async () => {
    const asset = await makeAsset('No Collections');
    expect(await getCollectionsForAsset(asset.assetId)).toEqual([]);
  });

  it('getCollectionsForAsset returns an empty array for a missing asset', async () => {
    expect(await getCollectionsForAsset('VSP-missing')).toEqual([]);
  });
});
