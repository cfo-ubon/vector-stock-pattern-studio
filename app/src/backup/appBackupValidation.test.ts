import { describe, it, expect, beforeEach } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { validateAppBackupArchive } from './appBackupValidation';
import { buildAppBackup } from './appBackupBuilder';
import { readZipArchive, buildCompressedZip } from './zipArchive';
import { clearPortfolioStores, importAssetTransaction } from '../catalog/storage/portfolioStore';
import { createPortfolioAsset } from '../catalog/domain/asset';
import { generateFileId } from '../catalog/domain/id';
import type { PortfolioFileRecord } from '../catalog/domain/types';
import { DB_VERSION } from '../storage/db';
import { MANIFEST_ENTRY_NAME } from './appBackupFormat';
import type { AppBackupManifest } from './appBackupFormat';

beforeEach(async () => {
  localStorage.clear();
  await clearPortfolioStores();
});

async function seedOneAsset(content = '<svg>test</svg>') {
  const asset = createPortfolioAsset({ displayName: 'Test Asset', originalFilename: 'test.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
  const file: PortfolioFileRecord = {
    fileId: generateFileId(),
    assetId: asset.assetId,
    role: 'svg',
    filename: 'test.svg',
    mimeType: 'image/svg+xml',
    fileSize: content.length,
    sha256: 'deadbeef',
    blob: new NodeBlob([content], { type: 'image/svg+xml' }) as unknown as Blob,
    storedAt: Date.now(),
  };
  await importAssetTransaction(asset, [file]);
}

describe('validateAppBackupArchive — a real, untampered archive', () => {
  it('PASSes with zero issues', async () => {
    await seedOneAsset();
    const backup = await buildAppBackup();
    const result = await validateAppBackupArchive(backup.blob);
    expect(result.verdict).toBe('PASS');
    expect(result.issues).toHaveLength(0);
    expect(result.mismatchedFileCount).toBe(0);
  });

  it('checks every content file listed in checksums.sha256', async () => {
    await seedOneAsset();
    const backup = await buildAppBackup();
    const result = await validateAppBackupArchive(backup.blob);
    expect(result.checkedFileCount).toBeGreaterThan(0);
  });

  it('exposes the already-decompressed entries for restore to reuse', async () => {
    const backup = await buildAppBackup();
    const result = await validateAppBackupArchive(backup.blob);
    expect(result.entries).not.toBeNull();
    expect(result.entries!.some((e) => e.name === 'manifest.json')).toBe(true);
  });
});

describe('validateAppBackupArchive — not a valid archive at all', () => {
  it('FAILs on garbage bytes', async () => {
    const result = await validateAppBackupArchive(new Blob([new Uint8Array([1, 2, 3, 4, 5])]));
    expect(result.verdict).toBe('FAIL');
    expect(result.manifest).toBeNull();
  });

  it('FAILs on a truncated archive', async () => {
    const backup = await buildAppBackup();
    const buf = new Uint8Array(await backup.blob.arrayBuffer());
    const truncated = new Blob([buf.slice(0, buf.length - 30)]);
    const result = await validateAppBackupArchive(truncated);
    expect(result.verdict).toBe('FAIL');
  });

  it('FAILs when the archive has no manifest.json (real ZIP, wrong contents)', async () => {
    const { blob } = await buildCompressedZip([{ name: 'not-a-backup.txt', data: new TextEncoder().encode('hello') }]);
    const result = await validateAppBackupArchive(blob);
    expect(result.verdict).toBe('FAIL');
    expect(result.issues[0].message).toContain('manifest.json');
  });
});

describe('validateAppBackupArchive — missing file listed in checksums', () => {
  it('FAILs and reports the missing file by name', async () => {
    await seedOneAsset();
    const backup = await buildAppBackup();
    const entries = await readZipArchive(backup.blob);
    const assetEntry = entries.find((e) => e.name.startsWith('assets/'))!;
    const withoutAsset = entries.filter((e) => e.name !== assetEntry.name);
    const { blob } = await buildCompressedZip(withoutAsset);

    const result = await validateAppBackupArchive(blob);
    expect(result.verdict).toBe('FAIL');
    expect(result.issues.some((i) => i.message.includes(assetEntry.name))).toBe(true);
  });
});

describe('validateAppBackupArchive — wrong checksum (tampered content)', () => {
  it('FAILs and reports a mismatch when a file is tampered with but the ZIP stays structurally valid', async () => {
    await seedOneAsset('<svg>' + 'y'.repeat(3000) + '</svg>');
    const backup = await buildAppBackup();
    const entries = await readZipArchive(backup.blob);
    const tamperedEntries = entries.map((e) => (e.name.startsWith('assets/') ? { name: e.name, data: new TextEncoder().encode('<svg>TAMPERED</svg>') } : e));
    const { blob } = await buildCompressedZip(tamperedEntries);

    const result = await validateAppBackupArchive(blob);
    expect(result.verdict).toBe('FAIL');
    expect(result.mismatchedFileCount).toBeGreaterThan(0);
  });
});

describe('validateAppBackupArchive — unsupported schema version', () => {
  it('FAILs with an explicit schema-version message', async () => {
    const backup = await buildAppBackup();
    const entries = await readZipArchive(backup.blob);
    const manifest = JSON.parse(new TextDecoder().decode(entries.find((e) => e.name === MANIFEST_ENTRY_NAME)!.data)) as AppBackupManifest;
    manifest.schemaVersion = 999;
    const patched = entries.map((e) => (e.name === MANIFEST_ENTRY_NAME ? { name: e.name, data: new TextEncoder().encode(JSON.stringify(manifest)) } : e));
    const { blob } = await buildCompressedZip(patched);

    const result = await validateAppBackupArchive(blob);
    expect(result.verdict).toBe('FAIL');
    expect(result.issues.some((i) => i.message.includes('schema version'))).toBe(true);
  });
});

describe('validateAppBackupArchive — version compatibility (older/newer)', () => {
  async function buildArchiveWithDbVersion(dbVersion: number) {
    const backup = await buildAppBackup();
    const entries = await readZipArchive(backup.blob);
    const manifest = JSON.parse(new TextDecoder().decode(entries.find((e) => e.name === MANIFEST_ENTRY_NAME)!.data)) as AppBackupManifest;
    manifest.metadata.dbVersion = dbVersion;
    const patched = entries.map((e) => (e.name === MANIFEST_ENTRY_NAME ? { name: e.name, data: new TextEncoder().encode(JSON.stringify(manifest)) } : e));
    return buildCompressedZip(patched);
  }

  it('an older backup restores as WARNING-free PASS (no data-loss risk)', async () => {
    const { blob } = await buildArchiveWithDbVersion(DB_VERSION - 1);
    const result = await validateAppBackupArchive(blob);
    expect(result.verdict).toBe('PASS');
    expect(result.compatibility?.compatibility).toBe('olderBackup');
  });

  it('a newer backup produces a WARNING verdict, not a FAIL (still restorable, but flagged)', async () => {
    const { blob } = await buildArchiveWithDbVersion(DB_VERSION + 1);
    const result = await validateAppBackupArchive(blob);
    expect(result.verdict).toBe('WARNING');
    expect(result.compatibility?.compatibility).toBe('newerBackup');
    expect(result.issues.some((i) => i.severity === 'warning')).toBe(true);
  });

  it('the same version reports "same" compatibility', async () => {
    const backup = await buildAppBackup();
    const result = await validateAppBackupArchive(backup.blob);
    expect(result.compatibility?.compatibility).toBe('same');
  });
});
