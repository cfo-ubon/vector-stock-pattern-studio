import { describe, it, expect, beforeEach } from 'vitest';
import { buildCollectionBackup, readBackupPayload } from './backupBuilder';
import { computePayloadChecksum } from './backupCodec';
import { BACKUP_FORMAT_ID, BACKUP_SCHEMA_VERSION, isBackupArchiveShape } from './backupFormat';
import { createCollectionService, assignAssetsToCollections } from '../services/collectionService';
import { clearCollectionsStore } from '../storage/collectionStore';
import { clearPortfolioStores, importAssetTransaction } from '../storage/portfolioStore';
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

describe('buildCollectionBackup', () => {
  it('produces a well-shaped archive from an empty database', async () => {
    const archive = await buildCollectionBackup();
    expect(isBackupArchiveShape(archive)).toBe(true);
    expect(archive.format).toBe(BACKUP_FORMAT_ID);
    expect(archive.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(archive.stats).toEqual({ collectionCount: 0, assetCount: 0, membershipCount: 0 });
  });

  it('captures real collections and membership', async () => {
    const c1 = await createCollectionService({ name: 'Spring 2026' });
    const c2 = await createCollectionService({ name: 'Summer 2026' });
    const a1 = await makeAsset('Asset One');
    const a2 = await makeAsset('Asset Two');
    await assignAssetsToCollections([a1.assetId, a2.assetId], [c1.id]);
    await assignAssetsToCollections([a1.assetId], [c2.id]);

    const archive = await buildCollectionBackup();
    expect(archive.stats.collectionCount).toBe(2);
    expect(archive.stats.membershipCount).toBe(3); // a1->c1, a1->c2, a2->c1

    const payload = await readBackupPayload(archive);
    expect(payload.collections.map((c) => c.name).sort()).toEqual(['Spring 2026', 'Summer 2026']);
    const a1Entry = payload.memberships.find((m) => m.assetId === a1.assetId);
    expect(a1Entry?.collectionIds.sort()).toEqual([c1.id, c2.id].sort());
  });

  it('omits assets with no collection membership', async () => {
    await createCollectionService({ name: 'Only Collection' });
    await makeAsset('Unassigned Asset');
    const archive = await buildCollectionBackup();
    const payload = await readBackupPayload(archive);
    expect(payload.memberships).toHaveLength(0);
  });

  it('carries an optional label into metadata', async () => {
    const archive = await buildCollectionBackup({ label: 'Before cleanup' });
    expect(archive.metadata.label).toBe('Before cleanup');
  });

  it('omits the label field entirely when none is given', async () => {
    const archive = await buildCollectionBackup();
    expect('label' in archive.metadata).toBe(false);
  });

  it('checksum matches an independently recomputed checksum of the decompressed payload', async () => {
    await createCollectionService({ name: 'Checksum Test' });
    const archive = await buildCollectionBackup();
    const payload = await readBackupPayload(archive);
    const recomputed = await computePayloadChecksum(payload);
    expect(recomputed).toBe(archive.checksum);
  });

  it('is a read-only snapshot — never mutates the live database', async () => {
    await createCollectionService({ name: 'Untouched' });
    await buildCollectionBackup();
    await buildCollectionBackup();
    const secondArchive = await buildCollectionBackup();
    expect(secondArchive.stats.collectionCount).toBe(1);
  });
});
