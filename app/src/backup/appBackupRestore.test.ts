import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { previewAppBackupRestore, applyAppBackupRestore, AppBackupRestoreError } from './appBackupRestore';
import { buildAppBackup } from './appBackupBuilder';
import { readZipArchive, buildCompressedZip } from './zipArchive';
import { clearPortfolioStores, importAssetTransaction, getPortfolioAsset, getPortfolioFile } from '../catalog/storage/portfolioStore';
import { createPortfolioAsset } from '../catalog/domain/asset';
import { generateFileId } from '../catalog/domain/id';
import type { PortfolioFileRecord } from '../catalog/domain/types';
import { clearBackupHistoryStore, listBackupHistory } from './appBackupHistoryStore';
import { DB_VERSION } from '../storage/db';
import { MANIFEST_ENTRY_NAME } from './appBackupFormat';
import type { AppBackupManifest } from './appBackupFormat';
import * as appBackupIdb from './appBackupIdb';

// `appBackupRestore.ts` reconstructs `PortfolioFileRecord.blob` from raw
// archive bytes via the global `Blob` constructor (necessarily — it has
// no way to know it's running under a test). In a real browser (or plain
// Node, as confirmed by an earlier manual round-trip script) that Blob
// survives an IndexedDB put/get correctly. jsdom's own `Blob` does not
// (see `testSetup.ts`'s header comment) — `fake-indexeddb`'s internal
// `structuredClone` reduces it to a prototype-less object with no
// `arrayBuffer()`/`size`, even though the write itself succeeds. Swapping
// in Node's spec-compliant `Blob` for just this file's `applyAppBackupRestore`
// calls exercises the exact same code path a real browser would take,
// without touching the jsdom `Blob` every other test file relies on.
const originalBlob = globalThis.Blob;
beforeEach(async () => {
  localStorage.clear();
  await clearPortfolioStores();
  await clearBackupHistoryStore();
  globalThis.Blob = NodeBlob as unknown as typeof Blob;
});
afterEach(() => {
  globalThis.Blob = originalBlob;
});

async function seedAsset(displayName: string, content: string) {
  const asset = createPortfolioAsset({ displayName, originalFilename: `${displayName}.svg`, sourceFileReferences: [], previewReference: null, metadataReference: null });
  const file: PortfolioFileRecord = {
    fileId: generateFileId(),
    assetId: asset.assetId,
    role: 'svg',
    filename: `${displayName}.svg`,
    mimeType: 'image/svg+xml',
    fileSize: content.length,
    sha256: 'deadbeef',
    blob: new NodeBlob([content], { type: 'image/svg+xml' }) as unknown as Blob,
    storedAt: Date.now(),
  };
  await importAssetTransaction(asset, [file]);
  return { asset, file };
}

describe('previewAppBackupRestore', () => {
  it('canRestore is true for a valid archive', async () => {
    const backup = await buildAppBackup();
    const preview = await previewAppBackupRestore(backup.blob);
    expect(preview.canRestore).toBe(true);
    expect(preview.validation.verdict).toBe('PASS');
  });

  it('canRestore is false for a corrupted archive', async () => {
    const preview = await previewAppBackupRestore(new Blob([new Uint8Array([1, 2, 3])]));
    expect(preview.canRestore).toBe(false);
  });

  it('does not write anything to the database (read-only preview)', async () => {
    const { asset } = await seedAsset('Original', '<svg>original</svg>');
    const backup = await buildAppBackup();
    // mutate after backup, then just preview (not apply) — mutation must survive
    await importAssetTransaction({ ...asset, displayName: 'Mutated' }, []);
    await previewAppBackupRestore(backup.blob);
    const current = await getPortfolioAsset(asset.assetId);
    expect(current?.displayName).toBe('Mutated');
  });
});

describe('applyAppBackupRestore — happy path', () => {
  it('restores portfolio asset metadata and the actual file bytes', async () => {
    const { asset, file } = await seedAsset('Original', '<svg>original-content</svg>');
    const backup = await buildAppBackup();

    // simulate the asset being modified after the backup was taken
    await importAssetTransaction({ ...asset, displayName: 'Modified After Backup' }, []);

    const result = await applyAppBackupRestore(backup.blob);
    expect(result.assetFilesRestored).toBe(1);

    const restoredAsset = await getPortfolioAsset(asset.assetId);
    expect(restoredAsset?.displayName).toBe('Original');

    const restoredFile = await getPortfolioFile(file.fileId);
    expect(restoredFile).toBeDefined();
    const text = await restoredFile!.blob.arrayBuffer();
    expect(new TextDecoder().decode(text)).toBe('<svg>original-content</svg>');
  });

  it('restores localStorage settings', async () => {
    localStorage.setItem('vsp-gallery-v1', '[{"id":"p1"}]');
    const backup = await buildAppBackup();
    localStorage.setItem('vsp-gallery-v1', '[]');

    const result = await applyAppBackupRestore(backup.blob);
    expect(result.settingsKeysRestored).toBe(1);
    expect(localStorage.getItem('vsp-gallery-v1')).toBe('[{"id":"p1"}]');
  });

  it('is upsert-only: does not delete records created after the backup was taken', async () => {
    await seedAsset('Kept', '<svg>kept</svg>');
    const backup = await buildAppBackup();
    const { asset: newerAsset } = await seedAsset('NewerAsset', '<svg>newer</svg>');

    await applyAppBackupRestore(backup.blob);

    const stillThere = await getPortfolioAsset(newerAsset.assetId);
    expect(stillThere).toBeDefined();
  });

  it('always records a Safety Backup in history before writing anything', async () => {
    await seedAsset('A', '<svg>a</svg>');
    const backup = await buildAppBackup();

    const result = await applyAppBackupRestore(backup.blob, { deviceLabel: 'Restore Test Device' });

    const history = await listBackupHistory();
    const safetyRecord = history.find((r) => r.historyId === result.safetyBackupHistoryId);
    expect(safetyRecord).toBeDefined();
    expect(safetyRecord?.trigger).toBe('safety');
    expect(safetyRecord?.blob).not.toBeNull();
  });

  it('reports compatibility info in the result', async () => {
    const backup = await buildAppBackup();
    const result = await applyAppBackupRestore(backup.blob);
    expect(result.compatibility.compatibility).toBe('same');
  });
});

describe('applyAppBackupRestore — never auto-restores on checksum/validation failure', () => {
  it('throws AppBackupRestoreError and writes nothing for a corrupted archive', async () => {
    const { asset } = await seedAsset('Untouched', '<svg>untouched</svg>');

    await expect(applyAppBackupRestore(new Blob([new Uint8Array([9, 9, 9, 9])]))).rejects.toThrow(AppBackupRestoreError);

    const stillOriginal = await getPortfolioAsset(asset.assetId);
    expect(stillOriginal?.displayName).toBe('Untouched');
  });

  it('throws for an archive with a tampered/wrong checksum', async () => {
    await seedAsset('X', '<svg>' + 'z'.repeat(2000) + '</svg>');
    const backup = await buildAppBackup();
    const entries = await readZipArchive(backup.blob);
    const tampered = entries.map((e) => (e.name.startsWith('assets/') ? { name: e.name, data: new TextEncoder().encode('<svg>TAMPERED</svg>') } : e));
    const { blob } = await buildCompressedZip(tampered);

    await expect(applyAppBackupRestore(blob)).rejects.toThrow(AppBackupRestoreError);
  });

  it('does not create a Safety Backup entry when validation fails before any write', async () => {
    await expect(applyAppBackupRestore(new Blob([new Uint8Array([1, 2, 3])]))).rejects.toThrow();
    const history = await listBackupHistory();
    expect(history).toHaveLength(0);
  });
});

describe('applyAppBackupRestore — version compatibility does not block restore', () => {
  async function buildArchiveWithDbVersion(dbVersion: number) {
    const backup = await buildAppBackup();
    const entries = await readZipArchive(backup.blob);
    const manifest = JSON.parse(new TextDecoder().decode(entries.find((e) => e.name === MANIFEST_ENTRY_NAME)!.data)) as AppBackupManifest;
    manifest.metadata.dbVersion = dbVersion;
    const patched = entries.map((e) => (e.name === MANIFEST_ENTRY_NAME ? { name: e.name, data: new TextEncoder().encode(JSON.stringify(manifest)) } : e));
    return buildCompressedZip(patched);
  }

  it('restores successfully from an older-version backup, flagged as olderBackup', async () => {
    await seedAsset('OldGen', '<svg>old</svg>');
    const { blob } = await buildArchiveWithDbVersion(DB_VERSION - 1);
    const result = await applyAppBackupRestore(blob);
    expect(result.compatibility.compatibility).toBe('olderBackup');
  });

  it('restores from a newer-version backup too (warned, not blocked)', async () => {
    const { blob } = await buildArchiveWithDbVersion(DB_VERSION + 1);
    const result = await applyAppBackupRestore(blob);
    expect(result.compatibility.compatibility).toBe('newerBackup');
  });
});

describe('applyAppBackupRestore — large asset library', () => {
  it('restores 30 assets correctly', async () => {
    for (let i = 0; i < 30; i++) {
      await seedAsset(`Asset${i}`, `<svg id="${i}">${'q'.repeat(100)}</svg>`);
    }
    const backup = await buildAppBackup();
    await clearPortfolioStores();

    const result = await applyAppBackupRestore(backup.blob);
    expect(result.assetFilesRestored).toBe(30);
  }, 30000);
});

describe('applyAppBackupRestore — storage quota exceeded (Build 027 Phase 3)', () => {
  it('surfaces a clear, safety-backup-referencing error instead of a raw browser exception', async () => {
    const { asset } = await seedAsset('BeforeQuota', '<svg>before</svg>');
    const backup = await buildAppBackup();

    const quotaError = new DOMException('quota', 'QuotaExceededError');
    const spy = vi.spyOn(appBackupIdb, 'putAllRecords').mockRejectedValueOnce(quotaError);

    let caught: unknown;
    try {
      await applyAppBackupRestore(backup.blob);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AppBackupRestoreError);
    expect((caught as Error).message).toMatch(/not enough free storage space/);

    spy.mockRestore();

    // Upsert-only semantics mean nothing already present was deleted by
    // the failed attempt — the pre-existing asset must still be there.
    const stillThere = await getPortfolioAsset(asset.assetId);
    expect(stillThere).not.toBeNull();

    // And the mandatory Safety Backup taken before the failed write must
    // still be recorded, since that's the user's actual recovery path.
    const history = await listBackupHistory();
    expect(history.some((h) => h.trigger === 'safety')).toBe(true);
  });

  it('re-throws non-quota errors unchanged rather than misreporting them as a storage problem', async () => {
    await seedAsset('Seed', '<svg>seed</svg>');
    const backup = await buildAppBackup();

    const spy = vi.spyOn(appBackupIdb, 'restoreAllStores').mockRejectedValueOnce(new Error('some other IDB failure'));
    await expect(applyAppBackupRestore(backup.blob)).rejects.toThrow('some other IDB failure');
    spy.mockRestore();
  });
});
