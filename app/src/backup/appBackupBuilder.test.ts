import { describe, it, expect, beforeEach } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { buildAppBackup } from './appBackupBuilder';
import { readZipArchive } from './zipArchive';
import { clearPortfolioStores, importAssetTransaction } from '../catalog/storage/portfolioStore';
import { createPortfolioAsset } from '../catalog/domain/asset';
import { generateFileId } from '../catalog/domain/id';
import type { PortfolioFileRecord } from '../catalog/domain/types';
import { APP_BACKUP_STORE_NAMES } from './appBackupFormat';

beforeEach(async () => {
  localStorage.clear();
  await clearPortfolioStores();
});

function makeFileRecord(assetId: string, content: string): PortfolioFileRecord {
  return {
    fileId: generateFileId(),
    assetId,
    role: 'svg',
    filename: `${assetId}.svg`,
    mimeType: 'image/svg+xml',
    fileSize: content.length,
    sha256: 'deadbeef',
    blob: new NodeBlob([content], { type: 'image/svg+xml' }) as unknown as Blob,
    storedAt: Date.now(),
  };
}

async function seedOneAsset(content = '<svg>test</svg>') {
  const asset = createPortfolioAsset({ displayName: 'Test Asset', originalFilename: 'test.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
  const file = makeFileRecord(asset.assetId, content);
  await importAssetTransaction(asset, [file]);
  return { asset, file };
}

describe('buildAppBackup — basic build', () => {
  it('produces a manifest with a UUID backupId', async () => {
    const result = await buildAppBackup();
    expect(result.manifest.backupId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('produces a real, readable ZIP archive containing manifest.json, database.json, and checksums.sha256', async () => {
    const result = await buildAppBackup();
    const entries = await readZipArchive(result.blob);
    expect(entries.some((e) => e.name === 'manifest.json')).toBe(true);
    expect(entries.some((e) => e.name === 'database.json')).toBe(true);
    expect(entries.some((e) => e.name === 'checksums.sha256')).toBe(true);
  });

  it('names the file with a .vspsb extension', async () => {
    const result = await buildAppBackup();
    expect(result.fileName.endsWith('.vspsb')).toBe(true);
  });

  it('fires progress events through every stage in order', async () => {
    const stages: string[] = [];
    await buildAppBackup({ onProgress: (e) => stages.push(e.stage) });
    const uniqueStages = stages.filter((s, i) => stages.indexOf(s) === i);
    expect(uniqueStages).toEqual(['preparing', 'compressing', 'verifying', 'completed']);
  });

  it('uses the provided device label, or a sensible default when omitted', async () => {
    const withLabel = await buildAppBackup({ deviceLabel: 'My Windows PC' });
    expect(withLabel.manifest.metadata.deviceLabel).toBe('My Windows PC');
    const withoutLabel = await buildAppBackup();
    expect(withoutLabel.manifest.metadata.deviceLabel.length).toBeGreaterThan(0);
  });
});

describe('buildAppBackup — portfolio asset coverage (the gap neither prior backup subsystem closed)', () => {
  it('includes the actual binary file bytes for every portfolio asset, not just metadata', async () => {
    const { file } = await seedOneAsset('<svg>unique-content-marker</svg>');
    const result = await buildAppBackup();

    expect(result.manifest.stats.assetFileCount).toBe(1);
    expect(result.manifest.assets[0].fileId).toBe(file.fileId);
    expect(result.manifest.assets[0].role).toBe('svg');

    const entries = await readZipArchive(result.blob);
    const assetEntry = entries.find((e) => e.name === result.manifest.assets[0].archivePath);
    expect(assetEntry).toBeDefined();
    expect(new TextDecoder().decode(assetEntry!.data)).toBe('<svg>unique-content-marker</svg>');
  });

  it('reports accurate storeRecordCounts.portfolioAssets in the manifest', async () => {
    await seedOneAsset();
    const result = await buildAppBackup();
    expect(result.manifest.stats.storeRecordCounts.portfolioAssets).toBe(1);
  });
});

describe('buildAppBackup — settings coverage', () => {
  it('captures a localStorage setting into the archive', async () => {
    localStorage.setItem('vsp-gallery-v1', '[{"id":"p1"}]');
    const result = await buildAppBackup();
    expect(result.manifest.settingsKeys).toContain('vsp-gallery-v1');
    const entries = await readZipArchive(result.blob);
    const entry = entries.find((e) => e.name === 'settings/vsp-gallery-v1.json');
    expect(new TextDecoder().decode(entry!.data)).toBe('[{"id":"p1"}]');
  });
});

describe('buildAppBackup — manifest stats consistency', () => {
  it('the embedded manifest.json inside the archive matches the returned manifest for backupId and content stats', async () => {
    await seedOneAsset();
    const result = await buildAppBackup();
    const entries = await readZipArchive(result.blob);
    const embedded = JSON.parse(new TextDecoder().decode(entries.find((e) => e.name === 'manifest.json')!.data));
    expect(embedded.backupId).toBe(result.manifest.backupId);
    expect(embedded.stats.fileCount).toBe(result.manifest.stats.fileCount);
    expect(embedded.stats.assetFileCount).toBe(result.manifest.stats.assetFileCount);
  });

  it('fileCount equals every content entry plus the manifest itself', async () => {
    await seedOneAsset();
    const result = await buildAppBackup();
    const entries = await readZipArchive(result.blob);
    expect(result.manifest.stats.fileCount).toBe(entries.length);
  });

  it('originalSize and compressedSize are both positive, and compressed <= original', async () => {
    await seedOneAsset('<svg>' + 'x'.repeat(5000) + '</svg>');
    const result = await buildAppBackup();
    expect(result.manifest.stats.originalSize).toBeGreaterThan(0);
    expect(result.manifest.stats.compressedSize).toBeGreaterThan(0);
    expect(result.manifest.stats.compressedSize).toBeLessThanOrEqual(result.manifest.stats.originalSize);
  });

  it('storeRecordCounts includes every store in APP_BACKUP_STORE_NAMES, even when empty', async () => {
    const result = await buildAppBackup();
    for (const name of APP_BACKUP_STORE_NAMES) {
      expect(result.manifest.stats.storeRecordCounts).toHaveProperty(name);
    }
  });
});

describe('buildAppBackup — large asset library (performance/scale)', () => {
  it('builds a correct archive for a portfolio with 50 assets', async () => {
    for (let i = 0; i < 50; i++) {
      await seedOneAsset(`<svg id="${i}">${'p'.repeat(200)}</svg>`);
    }
    const result = await buildAppBackup();
    expect(result.manifest.stats.assetFileCount).toBe(50);

    const entries = await readZipArchive(result.blob);
    const assetEntries = entries.filter((e) => e.name.startsWith('assets/'));
    expect(assetEntries).toHaveLength(50);
  }, 30000);
});
