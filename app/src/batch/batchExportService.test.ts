import { describe, it, expect, beforeEach } from 'vitest';
import { buildBatchExportZip, exportAssetsAsZip } from './batchExportService';
import { createPortfolioAsset } from '../catalog/domain/asset';
import { importAssetTransaction, clearPortfolioStores } from '../catalog/storage/portfolioStore';
import { sha256HexOfFile } from '../catalog/domain/hash';
import { generateFileId } from '../catalog/domain/id';
import { AssetExportIntegrityError } from '../catalog/services/exportAsset';
import type { PortfolioFileRecord, SourceFileReference } from '../catalog/domain/types';
// jsdom's own Blob isn't recognized by Node's `structuredClone` (used
// internally by fake-indexeddb) — see testSetup.ts's header comment and
// `catalog/services/exportAsset.test.ts`'s identical workaround.
import { Blob as NodeBlob } from 'node:buffer';

beforeEach(async () => {
  await clearPortfolioStores();
});

/** Minimal STORE-method ZIP reader, copied from
 * `catalog/services/exportAsset.test.ts`'s own identical test-only
 * helper (kept file-local there too — a test utility, not application
 * logic, so this is not a "duplicated business logic" case). */
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

async function seedAsset(displayName: string, filename: string, content: string): Promise<string> {
  const blob = new NodeBlob([content]) as unknown as Blob;
  const hash = await sha256HexOfFile(blob);
  const ref: SourceFileReference = { fileId: generateFileId(), role: 'svg', filename, mimeType: 'image/svg+xml', fileSize: blob.size, sha256: hash };
  const asset = createPortfolioAsset({ displayName, originalFilename: filename, sourceFileReferences: [ref], previewReference: ref.fileId, metadataReference: null });
  const record: PortfolioFileRecord = { fileId: ref.fileId, assetId: asset.assetId, role: 'svg', filename, mimeType: 'image/svg+xml', fileSize: blob.size, sha256: hash, blob, storedAt: Date.now() };
  await importAssetTransaction(asset, [record]);
  return asset.assetId;
}

describe('buildBatchExportZip', () => {
  it('combines every given asset into one archive, each under its own subfolder', async () => {
    const idA = await seedAsset('Pattern A', 'a.svg', '<svg>A</svg>');
    const idB = await seedAsset('Pattern B', 'b.svg', '<svg>B</svg>');

    const zip = await buildBatchExportZip([idA, idB]);
    const entries = await readStoredZipEntries(zip);
    const names = entries.map((e) => e.name);

    expect(names).toContain('manifest.json');
    expect(names.some((n) => n.endsWith('/a.svg'))).toBe(true);
    expect(names.some((n) => n.endsWith('/b.svg'))).toBe(true);
    // Different assets land in different subfolders, never the same path.
    const aFolder = names.find((n) => n.endsWith('/a.svg'))!.split('/')[0];
    const bFolder = names.find((n) => n.endsWith('/b.svg'))!.split('/')[0];
    expect(aFolder).not.toBe(bFolder);

    const manifestEntry = entries.find((e) => e.name === 'manifest.json')!;
    const manifest = JSON.parse(new TextDecoder().decode(manifestEntry.data));
    expect(manifest.assetCount).toBe(2);
    expect(manifest.assets).toHaveLength(2);
    expect(manifest.assets.map((a: { assetId: string }) => a.assetId).sort()).toEqual([idA, idB].sort());
  });

  it('preserves file bytes exactly for every asset in the combined archive', async () => {
    const idA = await seedAsset('Pattern A', 'a.svg', '<svg>content-A</svg>');
    const zip = await buildBatchExportZip([idA]);
    const entries = await readStoredZipEntries(zip);
    const aEntry = entries.find((e) => e.name.endsWith('/a.svg'))!;
    expect(new TextDecoder().decode(aEntry.data)).toBe('<svg>content-A</svg>');
  });

  it('throws AssetExportIntegrityError for an asset id that does not exist, aborting the whole export', async () => {
    const idA = await seedAsset('Pattern A', 'a.svg', '<svg>A</svg>');
    await expect(buildBatchExportZip([idA, 'VSP-00000000-NOPE00'])).rejects.toBeInstanceOf(AssetExportIntegrityError);
  });

  it('returns an empty-but-valid archive (manifest only) for an empty asset list', async () => {
    const zip = await buildBatchExportZip([]);
    const entries = await readStoredZipEntries(zip);
    expect(entries.map((e) => e.name)).toEqual(['manifest.json']);
    const manifest = JSON.parse(new TextDecoder().decode(entries[0].data));
    expect(manifest.assetCount).toBe(0);
  });
});

describe('exportAssetsAsZip', () => {
  it('returns a blob and a filename carrying the asset count', async () => {
    const idA = await seedAsset('Pattern A', 'a.svg', '<svg>A</svg>');
    const idB = await seedAsset('Pattern B', 'b.svg', '<svg>B</svg>');
    const { blob, filename } = await exportAssetsAsZip([idA, idB], 'Spring Batch');
    expect(blob.size).toBeGreaterThan(0);
    expect(filename).toBe('Spring-Batch-2-patterns.zip');
  });
});
