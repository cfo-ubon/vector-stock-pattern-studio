import { describe, it, expect, beforeEach } from 'vitest';
import { validateBackupArchive } from './backupValidation';
import { buildCollectionBackup } from './backupBuilder';
import { compressToBase64, computePayloadChecksum } from './backupCodec';
import { BACKUP_FORMAT_ID, BACKUP_GENERATOR_VERSION } from './backupFormat';
import type { BackupArchive, BackupPayload } from './backupFormat';
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

/** Builds a syntactically valid archive around an arbitrary payload —
 * used to construct archives with deliberate internal corruption
 * (duplicate IDs, orphaned references) that `buildCollectionBackup`
 * itself would never produce, since the production code is already
 * proven correct by `backupBuilder.test.ts`. */
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

describe('validateBackupArchive — real archive from buildCollectionBackup', () => {
  it('a fresh, untampered archive is fully valid', async () => {
    await createCollectionService({ name: 'Real Collection' });
    const archive = await buildCollectionBackup();
    const report = await validateBackupArchive(archive);
    expect(report.valid).toBe(true);
    expect(report.structurallySound).toBe(true);
    expect(report.schemaVersionSupported).toBe(true);
    expect(report.checksumValid).toBe(true);
    expect(report.statsMatch).toBe(true);
    expect(report.duplicateCollectionIds).toHaveLength(0);
    expect(report.orphanedMembershipCollectionIds).toHaveLength(0);
    expect(report.issues).toHaveLength(0);
  });
});

describe('validateBackupArchive — corruption and failure scenarios', () => {
  it('rejects a completely unrecognizable value (corrupted/wrong-format archive)', async () => {
    const report = await validateBackupArchive({ some: 'random json', not: 'a backup' });
    expect(report.valid).toBe(false);
    expect(report.structurallySound).toBe(false);
    expect(report.issues[0].code).toBe('invalid-shape');
  });

  it('rejects undefined/null input', async () => {
    expect((await validateBackupArchive(undefined)).valid).toBe(false);
    expect((await validateBackupArchive(null)).valid).toBe(false);
  });

  it('detects a truncated archive (payload cut short)', async () => {
    const archive = await makeArchiveFromPayload({ collections: [], memberships: [], settings: {} });
    const truncated: BackupArchive = { ...archive, payload: archive.payload.slice(0, Math.floor(archive.payload.length / 2)) };
    const report = await validateBackupArchive(truncated);
    expect(report.valid).toBe(false);
    expect(report.structurallySound).toBe(true);
    expect(report.issues.some((i) => i.code === 'corrupted-payload')).toBe(true);
  });

  it('detects an unsupported schema version (version mismatch)', async () => {
    const archive = await makeArchiveFromPayload({ collections: [], memberships: [], settings: {} }, { schemaVersion: 999 });
    const report = await validateBackupArchive(archive);
    expect(report.valid).toBe(false);
    expect(report.schemaVersionSupported).toBe(false);
    expect(report.issues[0].code).toBe('unsupported-schema-version');
  });

  it('detects a checksum mismatch (tampered payload)', async () => {
    const archive = await makeArchiveFromPayload({ collections: [], memberships: [], settings: {} });
    const tampered: BackupArchive = { ...archive, checksum: 'a'.repeat(64) };
    const report = await validateBackupArchive(tampered);
    expect(report.valid).toBe(false);
    expect(report.checksumValid).toBe(false);
    expect(report.issues.some((i) => i.code === 'checksum-mismatch')).toBe(true);
  });

  it('detects a stats header that lies about collection/membership counts', async () => {
    const payload: BackupPayload = { collections: [{ id: 'c1', name: 'X', normalizedName: 'x', description: '', coverAssetId: null, isArchived: false, archivedAt: null, schemaVersion: 1, createdAt: 1, updatedAt: 1 }], memberships: [], settings: {} };
    const archive = await makeArchiveFromPayload(payload, { stats: { collectionCount: 99, assetCount: 0, membershipCount: 0 } });
    const report = await validateBackupArchive(archive);
    expect(report.valid).toBe(false);
    expect(report.statsMatch).toBe(false);
    expect(report.issues.some((i) => i.code === 'collection-count-mismatch')).toBe(true);
  });

  it('detects duplicate collection IDs within the archive', async () => {
    const dupeCollection = { id: 'dupe-id', name: 'A', normalizedName: 'a', description: '', coverAssetId: null, isArchived: false, archivedAt: null, schemaVersion: 1, createdAt: 1, updatedAt: 1 };
    const payload: BackupPayload = { collections: [dupeCollection, { ...dupeCollection, name: 'B', normalizedName: 'b' }], memberships: [], settings: {} };
    const archive = await makeArchiveFromPayload(payload);
    const report = await validateBackupArchive(archive);
    expect(report.valid).toBe(false);
    expect(report.duplicateCollectionIds).toEqual(['dupe-id']);
    expect(report.issues.some((i) => i.code === 'duplicate-collection-id')).toBe(true);
  });

  it('detects an orphaned membership reference (missing collection)', async () => {
    const payload: BackupPayload = { collections: [], memberships: [{ assetId: 'asset-1', collectionIds: ['ghost-collection'] }], settings: {} };
    const archive = await makeArchiveFromPayload(payload);
    const report = await validateBackupArchive(archive);
    expect(report.valid).toBe(false);
    expect(report.orphanedMembershipCollectionIds).toEqual(['ghost-collection']);
    expect(report.issues.some((i) => i.code === 'orphaned-membership-reference')).toBe(true);
  });

  it('reports multiple simultaneous issues, not just the first one found', async () => {
    const archive = await makeArchiveFromPayload({ collections: [], memberships: [{ assetId: 'x', collectionIds: ['ghost'] }], settings: {} }, { checksum: 'bad'.repeat(20) });
    const report = await validateBackupArchive(archive);
    expect(report.issues.length).toBeGreaterThanOrEqual(2);
    expect(report.issues.some((i) => i.code === 'checksum-mismatch')).toBe(true);
    expect(report.issues.some((i) => i.code === 'orphaned-membership-reference')).toBe(true);
  });
});

describe('validateBackupArchive — live asset cross-check', () => {
  it('reports missing-live-asset as a warning, not an error, and still marks the report valid', async () => {
    const collection = await createCollectionService({ name: 'Cross-check Collection' });
    const asset = await makeAsset('Will Be Deleted');
    await assignAssetsToCollections([asset.assetId], [collection.id]);
    const archive = await buildCollectionBackup();

    await clearPortfolioStores(); // simulate the asset having been deleted since the backup was taken

    const report = await validateBackupArchive(archive, { crossCheckLiveAssets: true });
    expect(report.missingLiveAssetIds).toEqual([asset.assetId]);
    expect(report.issues.find((i) => i.code === 'missing-live-asset')?.severity).toBe('warning');
    expect(report.valid).toBe(true); // a warning alone does not invalidate the archive
  });

  it('missingLiveAssetIds is null (not checked) when crossCheckLiveAssets is not requested', async () => {
    const archive = await buildCollectionBackup();
    const report = await validateBackupArchive(archive);
    expect(report.missingLiveAssetIds).toBeNull();
  });

  it('missingLiveAssetIds is an empty array (checked, found none) when every referenced asset still exists', async () => {
    const collection = await createCollectionService({ name: 'Still Here' });
    const asset = await makeAsset('Still Present');
    await assignAssetsToCollections([asset.assetId], [collection.id]);
    const archive = await buildCollectionBackup();
    const report = await validateBackupArchive(archive, { crossCheckLiveAssets: true });
    expect(report.missingLiveAssetIds).toEqual([]);
  });
});
