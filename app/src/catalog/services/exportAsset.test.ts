/// <reference types="node" />
import { describe, it, expect, beforeEach } from 'vitest';
import { buildAssetExportZip, exportAssetById, AssetExportIntegrityError, PORTFOLIO_EXPORT_MANIFEST_VERSION } from './exportAsset';
import { createPortfolioAsset } from '../domain/asset';
import { importAssetTransaction, clearPortfolioStores } from '../storage/portfolioStore';
import { sha256HexOfFile } from '../domain/hash';
import { generateFileId } from '../domain/id';
import type { PortfolioFileRecord, SourceFileReference } from '../domain/types';
// jsdom's own Blob isn't recognized by Node's `structuredClone` (used
// internally by fake-indexeddb) — see testSetup.ts's header comment.
// Only needed here for the `exportAssetById` test, which is the one test
// in this file that actually roundtrips a Blob through
// `importAssetTransaction`'s real IndexedDB write/read.
import { Blob as NodeBlob } from 'node:buffer';

beforeEach(async () => {
  await clearPortfolioStores();
});

/** Minimal STORE-method ZIP reader — sufficient to verify what
 * `buildZip` (`export/zip.ts`) actually wrote, since this app never
 * produces any other compression method. Test-only; not shipped. */
async function readStoredZipEntries(blob: Blob): Promise<Array<{ name: string; data: Uint8Array }>> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const entries: Array<{ name: string; data: Uint8Array }> = [];
  let offset = 0;
  const decoder = new TextDecoder();
  while (offset < buffer.length && view.getUint32(offset, true) === 0x04034b50) {
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const name = decoder.decode(buffer.slice(nameStart, nameStart + nameLength));
    const dataStart = nameStart + nameLength + extraLength;
    const data = buffer.slice(dataStart, dataStart + compressedSize);
    entries.push({ name, data });
    offset = dataStart + compressedSize;
  }
  return entries;
}

function makeRef(role: SourceFileReference['role'], sha256: string, filename: string): SourceFileReference {
  return { fileId: generateFileId(), role, filename, mimeType: 'text/plain', fileSize: 10, sha256 };
}

describe('buildAssetExportZip', () => {
  it('produces a ZIP with manifest.json plus every source file, byte-for-byte', async () => {
    const svgBlob = new Blob(['<svg>content</svg>']);
    const svgHash = await sha256HexOfFile(svgBlob);
    const ref = makeRef('svg', svgHash, 'flower.svg');
    ref.fileSize = svgBlob.size;
    const asset = createPortfolioAsset({
      displayName: 'Flower',
      originalFilename: 'flower.svg',
      sourceFileReferences: [ref],
      previewReference: ref.fileId,
      metadataReference: null,
    });
    const record: PortfolioFileRecord = {
      fileId: ref.fileId,
      assetId: asset.assetId,
      role: 'svg',
      filename: 'flower.svg',
      mimeType: 'image/svg+xml',
      fileSize: svgBlob.size,
      sha256: svgHash,
      blob: svgBlob,
      storedAt: Date.now(),
    };

    const zip = await buildAssetExportZip(asset, [record]);
    expect(zip.type).toBe('application/zip');
    const entries = await readStoredZipEntries(zip);
    const names = entries.map((e) => e.name);
    expect(names).toContain('manifest.json');
    expect(names).toContain('flower.svg');

    const manifestEntry = entries.find((e) => e.name === 'manifest.json')!;
    const manifest = JSON.parse(new TextDecoder().decode(manifestEntry.data));
    expect(manifest.manifestVersion).toBe(PORTFOLIO_EXPORT_MANIFEST_VERSION);
    expect(manifest.asset.assetId).toBe(asset.assetId);
    expect(manifest.files).toHaveLength(1);
    expect(manifest.files[0].sha256).toBe(svgHash);

    const svgEntry = entries.find((e) => e.name === 'flower.svg')!;
    expect(new TextDecoder().decode(svgEntry.data)).toBe('<svg>content</svg>');
  });

  it('throws AssetExportIntegrityError when a referenced file body is missing from storage', async () => {
    const ref = makeRef('svg', 'some-hash', 'missing.svg');
    const asset = createPortfolioAsset({ displayName: 'X', originalFilename: 'missing.svg', sourceFileReferences: [ref], previewReference: null, metadataReference: null });
    await expect(buildAssetExportZip(asset, [])).rejects.toBeInstanceOf(AssetExportIntegrityError);
  });

  it('throws AssetExportIntegrityError when a stored file body does not match its recorded hash', async () => {
    const ref = makeRef('svg', 'recorded-hash-does-not-match', 'tampered.svg');
    const asset = createPortfolioAsset({ displayName: 'X', originalFilename: 'tampered.svg', sourceFileReferences: [ref], previewReference: null, metadataReference: null });
    const record: PortfolioFileRecord = {
      fileId: ref.fileId,
      assetId: asset.assetId,
      role: 'svg',
      filename: 'tampered.svg',
      mimeType: 'image/svg+xml',
      fileSize: 10,
      sha256: 'recorded-hash-does-not-match',
      blob: new Blob(['actual different content']),
      storedAt: Date.now(),
    };
    await expect(buildAssetExportZip(asset, [record])).rejects.toBeInstanceOf(AssetExportIntegrityError);
  });

  it('dedupes two same-named files instead of overwriting one another in the archive', async () => {
    const blobA = new Blob(['A']);
    const blobB = new Blob(['B']);
    const hashA = await sha256HexOfFile(blobA);
    const hashB = await sha256HexOfFile(blobB);
    const refA = makeRef('svg', hashA, 'same.svg');
    const refB = makeRef('png', hashB, 'same.svg');
    const asset = createPortfolioAsset({ displayName: 'X', originalFilename: 'same.svg', sourceFileReferences: [refA, refB], previewReference: null, metadataReference: null });
    const records: PortfolioFileRecord[] = [
      { fileId: refA.fileId, assetId: asset.assetId, role: 'svg', filename: 'same.svg', mimeType: 'image/svg+xml', fileSize: 1, sha256: hashA, blob: blobA, storedAt: Date.now() },
      { fileId: refB.fileId, assetId: asset.assetId, role: 'png', filename: 'same.svg', mimeType: 'image/png', fileSize: 1, sha256: hashB, blob: blobB, storedAt: Date.now() },
    ];
    const zip = await buildAssetExportZip(asset, records);
    const entries = await readStoredZipEntries(zip);
    const names = entries.map((e) => e.name).filter((n) => n !== 'manifest.json');
    expect(new Set(names).size).toBe(2);
  });
});

describe('exportAssetById', () => {
  it('exports a real stored asset end-to-end', async () => {
    const svgBlob = new NodeBlob(['<svg/>']) as unknown as Blob;
    const svgHash = await sha256HexOfFile(svgBlob);
    const ref = makeRef('svg', svgHash, 'a.svg');
    ref.fileSize = svgBlob.size;
    const asset = createPortfolioAsset({ displayName: 'A Design', originalFilename: 'a.svg', sourceFileReferences: [ref], previewReference: ref.fileId, metadataReference: null });
    const record: PortfolioFileRecord = { fileId: ref.fileId, assetId: asset.assetId, role: 'svg', filename: 'a.svg', mimeType: 'image/svg+xml', fileSize: svgBlob.size, sha256: svgHash, blob: svgBlob, storedAt: Date.now() };
    await importAssetTransaction(asset, [record]);

    const { blob, filename } = await exportAssetById(asset.assetId);
    expect(blob.size).toBeGreaterThan(0);
    expect(filename).toContain(asset.assetId);
    expect(filename.endsWith('.zip')).toBe(true);
  });

  it('throws for an asset ID that does not exist', async () => {
    await expect(exportAssetById('VSP-00000000-NOPE00')).rejects.toBeInstanceOf(AssetExportIntegrityError);
  });
});
