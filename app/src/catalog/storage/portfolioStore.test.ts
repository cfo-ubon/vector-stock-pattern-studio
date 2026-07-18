/// <reference types="node" />
import { describe, it, expect, beforeEach } from 'vitest';
import {
  portfolioStorageAvailable,
  loadPortfolioAssets,
  getPortfolioAsset,
  putPortfolioAsset,
  importAssetTransaction,
  loadFilesForAsset,
  getPortfolioFile,
  findFilesByHash,
  deletePortfolioAssetRecordOnly,
  deletePortfolioAssetAndFiles,
  clearPortfolioStores,
} from './portfolioStore';
import { createPortfolioAsset } from '../domain/asset';
import type { PortfolioFileRecord, SourceFileReference } from '../domain/types';
import { generateFileId } from '../domain/id';
// jsdom's own Blob isn't recognized by Node's `structuredClone` (used
// internally by fake-indexeddb) — see testSetup.ts's header comment.
// Node's real Blob roundtrips correctly, so these storage tests build
// file bodies with it explicitly rather than the jsdom-global `Blob`.
import { Blob as NodeBlob } from 'node:buffer';

function makeFileRef(role: SourceFileReference['role'], sha256: string, size = 100): SourceFileReference {
  return { fileId: generateFileId(), role, filename: `file.${role}`, mimeType: 'text/plain', fileSize: size, sha256 };
}

function makeFileRecord(assetId: string, ref: SourceFileReference): PortfolioFileRecord {
  return {
    fileId: ref.fileId,
    assetId,
    role: ref.role,
    filename: ref.filename,
    mimeType: ref.mimeType,
    fileSize: ref.fileSize,
    sha256: ref.sha256,
    blob: new NodeBlob(['x'.repeat(ref.fileSize)]) as unknown as Blob,
    storedAt: Date.now(),
  };
}

beforeEach(async () => {
  // `storage/db.ts` memoizes one shared connection promise at module
  // scope (by design — see its header comment), so every test in this
  // file runs against the same fake-indexeddb database rather than a
  // fresh one; clearing both stores between tests gives the same
  // isolation without fighting that memoization.
  await clearPortfolioStores();
});

describe('portfolioStore', () => {
  it('reports IndexedDB as available under the fake-indexeddb test polyfill', () => {
    expect(portfolioStorageAvailable()).toBe(true);
  });

  it('importAssetTransaction atomically writes the asset record and every file record', async () => {
    const ref = makeFileRef('svg', 'hash-1');
    const asset = createPortfolioAsset({
      displayName: 'Spring Garden',
      originalFilename: 'spring-garden-001.svg',
      sourceFileReferences: [ref],
      previewReference: null,
      metadataReference: null,
    });
    await importAssetTransaction(asset, [makeFileRecord(asset.assetId, ref)]);

    const loaded = await getPortfolioAsset(asset.assetId);
    expect(loaded?.displayName).toBe('Spring Garden');
    const files = await loadFilesForAsset(asset.assetId);
    expect(files).toHaveLength(1);
    expect(files[0].sha256).toBe('hash-1');
  });

  it('loadPortfolioAssets returns newest-imported-first', async () => {
    const a = createPortfolioAsset({ displayName: 'A', originalFilename: 'a.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
    await new Promise((r) => setTimeout(r, 2));
    const b = createPortfolioAsset({ displayName: 'B', originalFilename: 'b.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
    await importAssetTransaction(a, []);
    await importAssetTransaction(b, []);
    const all = await loadPortfolioAssets();
    expect(all.map((x) => x.displayName)).toEqual(['B', 'A']);
  });

  it('putPortfolioAsset updates an existing record in place (no duplicate row)', async () => {
    const asset = createPortfolioAsset({ displayName: 'Original', originalFilename: 'x.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
    await importAssetTransaction(asset, []);
    await putPortfolioAsset({ ...asset, displayName: 'Renamed', updatedAt: Date.now() });
    const all = await loadPortfolioAssets();
    expect(all).toHaveLength(1);
    expect(all[0].displayName).toBe('Renamed');
  });

  it('findFilesByHash finds a stored file by its content hash (duplicate lookup)', async () => {
    const ref = makeFileRef('svg', 'shared-hash');
    const asset = createPortfolioAsset({ displayName: 'A', originalFilename: 'a.svg', sourceFileReferences: [ref], previewReference: null, metadataReference: null });
    await importAssetTransaction(asset, [makeFileRecord(asset.assetId, ref)]);
    const found = await findFilesByHash('shared-hash');
    expect(found).toHaveLength(1);
    expect(found[0].assetId).toBe(asset.assetId);
    expect(await findFilesByHash('no-such-hash')).toHaveLength(0);
  });

  it('deletePortfolioAssetRecordOnly removes the catalog record but keeps stored files', async () => {
    const ref = makeFileRef('svg', 'h');
    const asset = createPortfolioAsset({ displayName: 'A', originalFilename: 'a.svg', sourceFileReferences: [ref], previewReference: null, metadataReference: null });
    await importAssetTransaction(asset, [makeFileRecord(asset.assetId, ref)]);
    await deletePortfolioAssetRecordOnly(asset.assetId);
    expect(await getPortfolioAsset(asset.assetId)).toBeUndefined();
    expect(await getPortfolioFile(ref.fileId)).toBeDefined();
  });

  it('deletePortfolioAssetAndFiles removes both the record and every stored file', async () => {
    const ref = makeFileRef('svg', 'h');
    const asset = createPortfolioAsset({ displayName: 'A', originalFilename: 'a.svg', sourceFileReferences: [ref], previewReference: null, metadataReference: null });
    await importAssetTransaction(asset, [makeFileRecord(asset.assetId, ref)]);
    await deletePortfolioAssetAndFiles(asset.assetId);
    expect(await getPortfolioAsset(asset.assetId)).toBeUndefined();
    expect(await getPortfolioFile(ref.fileId)).toBeUndefined();
  });

  it('clearPortfolioStores empties both stores', async () => {
    const asset = createPortfolioAsset({ displayName: 'A', originalFilename: 'a.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
    await importAssetTransaction(asset, []);
    await clearPortfolioStores();
    expect(await loadPortfolioAssets()).toHaveLength(0);
  });
});
