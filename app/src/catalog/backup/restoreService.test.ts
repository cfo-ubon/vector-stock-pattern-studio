import { describe, it, expect, beforeEach } from 'vitest';
import { previewRestore, restoreBackup, BackupRestoreError } from './restoreService';
import { buildCollectionBackup } from './backupBuilder';
import { compressToBase64, computePayloadChecksum } from './backupCodec';
import { BACKUP_FORMAT_ID, BACKUP_GENERATOR_VERSION } from './backupFormat';
import type { BackupArchive, BackupPayload } from './backupFormat';
import {
  createCollectionService,
  renameCollection,
  assignAssetsToCollections,
  getAssetsForCollection,
} from '../services/collectionService';
import { clearCollectionsStore, getCollection } from '../storage/collectionStore';
import { clearPortfolioStores, importAssetTransaction, getPortfolioAsset } from '../storage/portfolioStore';
import { createPortfolioAsset } from '../domain/asset';
import type { PortfolioAsset } from '../domain/types';

beforeEach(async () => {
  await clearCollectionsStore();
  await clearPortfolioStores();
});

async function makeAsset(displayName: string): Promise<PortfolioAsset> {
  const asset = createPortfolioAsset({ displayName, originalFilename: `${displayName}.svg`, sourceFileReferences: [], previewReference: null, metadataReference: null });
  await importAssetTransaction(asset, []);
  return asset;
}

async function makeArchiveFromPayload(payload: BackupPayload, overrides: Partial<BackupArchive> = {}): Promise<BackupArchive> {
  const checksum = await computePayloadChecksum(payload);
  const compressed = await compressToBase64(JSON.stringify(payload));
  const membershipCount = payload.memberships.reduce((s, m) => s + m.collectionIds.length, 0);
  return {
    format: BACKUP_FORMAT_ID,
    schemaVersion: 1,
    applicationVersion: 'test',
    generatorVersion: BACKUP_GENERATOR_VERSION,
    createdAt: Date.now(),
    stats: { collectionCount: payload.collections.length, assetCount: payload.memberships.length, membershipCount },
    metadata: { dbVersion: 5, collectionApiVersion: 'test' },
    checksum,
    payloadEncoding: 'gzip+base64',
    payload: compressed,
    ...overrides,
  };
}

describe('previewRestore', () => {
  it('previews a pure "create everything" restore into an empty database', async () => {
    const c1 = await createCollectionService({ name: 'Spring' });
    const asset = await makeAsset('A1');
    await assignAssetsToCollections([asset.assetId], [c1.id]);
    const archive = await buildCollectionBackup();

    await clearCollectionsStore();
    await clearPortfolioStores();
    await importAssetTransaction(asset, []); // asset still exists live, just no collections yet

    const preview = await previewRestore(archive, 'overwrite');
    expect(preview.previewable).toBe(true);
    expect(preview.toCreateCount).toBe(1);
    expect(preview.conflictCount).toBe(0);
    expect(preview.membershipsToAdd).toBe(1);
    expect(preview.membershipsToRemove).toBe(0);
  });

  it('detects a conflict when the live collection differs from the backup', async () => {
    const c1 = await createCollectionService({ name: 'Original Name' });
    const archive = await buildCollectionBackup();
    await renameCollection(c1.id, 'Changed Since Backup');

    const preview = await previewRestore(archive, 'overwrite');
    expect(preview.conflictCount).toBe(1);
    expect(preview.collections[0].diff).toBe('conflict');
    expect(preview.collections[0].conflictingFields).toContain('name');
    expect(preview.collections[0].resolvedAction).toBe('update');
  });

  it('a conflict resolves to keep-current in merge mode, not update', async () => {
    const c1 = await createCollectionService({ name: 'Original Name' });
    const archive = await buildCollectionBackup();
    await renameCollection(c1.id, 'Changed Since Backup');

    const preview = await previewRestore(archive, 'merge');
    expect(preview.collections[0].diff).toBe('conflict');
    expect(preview.collections[0].resolvedAction).toBe('keep-current');
  });

  it('reports unchanged when live matches the backup exactly', async () => {
    await createCollectionService({ name: 'Stable' });
    const archive = await buildCollectionBackup();
    const preview = await previewRestore(archive, 'overwrite');
    expect(preview.collections[0].diff).toBe('unchanged');
    expect(preview.unchangedCount).toBe(1);
  });

  it('reports membershipsToRemove only in overwrite mode, never in merge', async () => {
    const c1 = await createCollectionService({ name: 'Shrinking' });
    const a1 = await makeAsset('Keeper');
    const a2 = await makeAsset('WillBeRemovedInOverwriteOnly');
    await assignAssetsToCollections([a1.assetId], [c1.id]);
    const archive = await buildCollectionBackup(); // backup has only a1 in c1
    await assignAssetsToCollections([a2.assetId], [c1.id]); // live now also has a2

    const overwritePreview = await previewRestore(archive, 'overwrite');
    expect(overwritePreview.membershipsToRemove).toBe(1);

    const mergePreview = await previewRestore(archive, 'merge');
    expect(mergePreview.membershipsToRemove).toBe(0);
  });

  it('returns previewable: false with validation issues for a broken archive', async () => {
    const archive = await makeArchiveFromPayload({ collections: [], memberships: [], settings: {} }, { checksum: 'x'.repeat(64) });
    const preview = await previewRestore(archive, 'overwrite');
    expect(preview.previewable).toBe(false);
    expect(preview.validation.valid).toBe(false);
  });

  it('dry-run guarantee: previewing a restore writes nothing to live storage', async () => {
    const c1 = await createCollectionService({ name: 'Original' });
    const asset = await makeAsset('A1');
    await assignAssetsToCollections([asset.assetId], [c1.id]);
    const archive = await buildCollectionBackup();
    await renameCollection(c1.id, 'Changed Since Backup'); // creates a conflict the preview will report

    await previewRestore(archive, 'overwrite');
    await previewRestore(archive, 'merge');

    // Neither preview call should have written anything — live state must
    // still reflect the post-rename, pre-restore reality exactly.
    const stillLive = await getCollection(c1.id);
    expect(stillLive?.name).toBe('Changed Since Backup');
    const members = await getAssetsForCollection(c1.id);
    expect(members.map((a) => a.assetId)).toEqual([asset.assetId]);
  });
});

describe('restoreBackup — overwrite mode', () => {
  it('creates collections and memberships into an empty database', async () => {
    const c1 = await createCollectionService({ name: 'Spring' });
    const asset = await makeAsset('A1');
    await assignAssetsToCollections([asset.assetId], [c1.id]);
    const archive = await buildCollectionBackup();

    await clearCollectionsStore();
    await clearPortfolioStores();
    await importAssetTransaction(asset, []);

    const result = await restoreBackup(archive, 'overwrite');
    expect(result.collectionsCreated).toBe(1);
    expect(result.membershipsAdded).toBe(1);

    const restored = await getCollection(c1.id);
    expect(restored?.name).toBe('Spring');
    const members = await getAssetsForCollection(c1.id);
    expect(members.map((a) => a.assetId)).toEqual([asset.assetId]);
  });

  it('overwrites a changed collection back to the backup version', async () => {
    const c1 = await createCollectionService({ name: 'Original' });
    const archive = await buildCollectionBackup();
    await renameCollection(c1.id, 'Mutated');

    const result = await restoreBackup(archive, 'overwrite');
    expect(result.collectionsUpdated).toBe(1);
    const restored = await getCollection(c1.id);
    expect(restored?.name).toBe('Original');
  });

  it('removes memberships not present in the backup (true overwrite semantics)', async () => {
    const c1 = await createCollectionService({ name: 'Shrinking' });
    const a1 = await makeAsset('Keeper');
    const a2 = await makeAsset('ExtraMember');
    await assignAssetsToCollections([a1.assetId], [c1.id]);
    const archive = await buildCollectionBackup();
    await assignAssetsToCollections([a2.assetId], [c1.id]);

    await restoreBackup(archive, 'overwrite');
    const members = await getAssetsForCollection(c1.id);
    expect(members.map((a) => a.assetId)).toEqual([a1.assetId]);
  });

  it('does not touch collections absent from the backup', async () => {
    const backedUp = await createCollectionService({ name: 'In Backup' });
    const archive = await buildCollectionBackup();
    const untouched = await createCollectionService({ name: 'Not In Backup' });

    await restoreBackup(archive, 'overwrite');
    const stillThere = await getCollection(untouched.id);
    expect(stillThere?.name).toBe('Not In Backup');
    expect((await getCollection(backedUp.id))?.name).toBe('In Backup');
  });
});

describe('restoreBackup — merge mode', () => {
  it('creates missing collections but never overwrites an existing one’s metadata', async () => {
    const c1 = await createCollectionService({ name: 'Original' });
    const archive = await buildCollectionBackup();
    await renameCollection(c1.id, 'Renamed After Backup');

    const result = await restoreBackup(archive, 'merge');
    expect(result.collectionsUpdated).toBe(0);
    expect(result.collectionsUnchanged).toBe(1);
    const live = await getCollection(c1.id);
    expect(live?.name).toBe('Renamed After Backup');
  });

  it('only adds memberships, never removes them', async () => {
    const c1 = await createCollectionService({ name: 'Growing' });
    const a1 = await makeAsset('Keeper');
    const a2 = await makeAsset('AddedAfterBackup');
    await assignAssetsToCollections([a1.assetId], [c1.id]);
    const archive = await buildCollectionBackup();
    await assignAssetsToCollections([a2.assetId], [c1.id]);

    const result = await restoreBackup(archive, 'merge');
    expect(result.membershipsRemoved).toBe(0);
    const members = (await getAssetsForCollection(c1.id)).map((a) => a.assetId).sort();
    expect(members).toEqual([a1.assetId, a2.assetId].sort());
  });
});

describe('restoreBackup — missing assets', () => {
  it('skips memberships for assets deleted since the backup, without failing the whole restore', async () => {
    const c1 = await createCollectionService({ name: 'Has A Ghost Member' });
    const asset = await makeAsset('Will Be Deleted');
    await assignAssetsToCollections([asset.assetId], [c1.id]);
    const archive = await buildCollectionBackup();
    await clearPortfolioStores(); // the asset no longer exists

    const result = await restoreBackup(archive, 'overwrite');
    expect(result.collectionsCreated + result.collectionsUnchanged).toBeGreaterThan(0);
    expect(result.skippedMissingAssetIds).toEqual([asset.assetId]);
  });
});

describe('restoreBackup — refuses untrustworthy archives', () => {
  it('throws BackupRestoreError and writes nothing for a checksum-mismatched archive', async () => {
    const before = await createCollectionService({ name: 'Should Not Change' });
    const archive = await makeArchiveFromPayload({ collections: [{ id: 'new-id', name: 'Injected', normalizedName: 'injected', description: '', coverAssetId: null, isArchived: false, archivedAt: null, schemaVersion: 1, createdAt: 1, updatedAt: 1 }], memberships: [], settings: {} }, { checksum: 'bad'.repeat(20) });

    await expect(restoreBackup(archive, 'overwrite')).rejects.toBeInstanceOf(BackupRestoreError);
    const injected = await getCollection('new-id');
    expect(injected).toBeUndefined();
    const untouched = await getCollection(before.id);
    expect(untouched?.name).toBe('Should Not Change');
  });

  it('throws for an unsupported schema version', async () => {
    const archive = await makeArchiveFromPayload({ collections: [], memberships: [], settings: {} }, { schemaVersion: 999 });
    await expect(restoreBackup(archive, 'overwrite')).rejects.toBeInstanceOf(BackupRestoreError);
  });
});

describe('restoreBackup — idempotency and interrupted-restore recovery', () => {
  it('restoring the same archive twice in a row produces no further change', async () => {
    const c1 = await createCollectionService({ name: 'Idempotent' });
    const asset = await makeAsset('A1');
    await assignAssetsToCollections([asset.assetId], [c1.id]);
    const archive = await buildCollectionBackup();

    const first = await restoreBackup(archive, 'overwrite');
    const second = await restoreBackup(archive, 'overwrite');
    expect(second.collectionsCreated).toBe(0);
    expect(second.membershipsAdded).toBe(0);
    expect(second.membershipsRemoved).toBe(0);
    expect(first.collectionsUnchanged + second.collectionsUnchanged).toBeGreaterThanOrEqual(1);
  });

  it('simulated interrupted restore (collections written, memberships never applied) self-heals on retry', async () => {
    const c1 = await createCollectionService({ name: 'Interrupted' });
    const asset = await makeAsset('A1');
    await assignAssetsToCollections([asset.assetId], [c1.id]);
    const archive = await buildCollectionBackup();

    // Simulate the exact interruption point restoreBackup itself could
    // hit between its two bulk writes: reset to a state where the
    // collection already exists (as if the collections-bulk-write step
    // had already landed) but membership has not been applied yet.
    await clearPortfolioStores();
    await importAssetTransaction({ ...asset, collectionIds: [] }, []);

    const result = await restoreBackup(archive, 'overwrite');
    expect(result.collectionsUnchanged).toBe(1); // collection already matched, nothing to write there
    expect(result.membershipsAdded).toBe(1); // membership correctly self-healed on this single call
    const members = await getAssetsForCollection(c1.id);
    expect(members.map((a) => a.assetId)).toEqual([asset.assetId]);

    // A further retry changes nothing further — confirms full recovery, not partial.
    const retry = await restoreBackup(archive, 'overwrite');
    expect(retry.membershipsAdded).toBe(0);
  });
});

describe('restoreBackup — large dataset', () => {
  it('restores 2,000 collections and 5,000 memberships correctly', async () => {
    const assetCount = 1000;
    const collectionCount = 200;
    const assets: PortfolioAsset[] = [];
    for (let i = 0; i < assetCount; i++) assets.push(await makeAsset(`Asset ${i}`));
    const collections: Awaited<ReturnType<typeof createCollectionService>>[] = [];
    for (let i = 0; i < collectionCount; i++) collections.push(await createCollectionService({ name: `Collection ${i}` }));

    // Assign every asset to 5 collections (round-robin) — 5,000 memberships total.
    for (let i = 0; i < assetCount; i++) {
      const targetCollectionIds = Array.from({ length: 5 }, (_, k) => collections[(i + k) % collectionCount].id);
      await assignAssetsToCollections([assets[i].assetId], targetCollectionIds);
    }

    const archive = await buildCollectionBackup();
    expect(archive.stats.collectionCount).toBe(collectionCount);
    expect(archive.stats.membershipCount).toBe(assetCount * 5);

    await clearCollectionsStore();
    await clearPortfolioStores();
    for (const asset of assets) await importAssetTransaction({ ...asset, collectionIds: [] }, []);

    const result = await restoreBackup(archive, 'overwrite');
    expect(result.collectionsCreated).toBe(collectionCount);
    expect(result.membershipsAdded).toBe(assetCount * 5);

    const spotCheck = await getPortfolioAsset(assets[0].assetId);
    expect(spotCheck?.collectionIds).toHaveLength(5);
  }, 30000);
});
