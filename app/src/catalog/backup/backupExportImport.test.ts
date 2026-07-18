import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  backupArchiveFilename,
  buildBackupArchiveBlob,
  exportBackupArchiveFile,
  importBackupArchiveFile,
  BackupImportError,
} from './backupExportImport';
import { buildCollectionBackup } from './backupBuilder';
import { isBackupArchiveShape } from './backupFormat';
import { validateBackupArchive } from './backupValidation';
import { clearCollectionsStore } from '../storage/collectionStore';
import { clearPortfolioStores } from '../storage/portfolioStore';
import { createCollectionService } from '../services/collectionService';

beforeEach(async () => {
  await clearCollectionsStore();
  await clearPortfolioStores();
  URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('backupArchiveFilename', () => {
  it('embeds the archive createdAt timestamp, not the current time', async () => {
    const archive = await buildCollectionBackup();
    const fixed = { ...archive, createdAt: new Date(2026, 0, 15, 9, 30, 5).getTime() };
    expect(backupArchiveFilename(fixed)).toBe('collection-backup-2026-01-15-093005.json');
  });

  it('includes a sanitized label when present', async () => {
    const archive = await buildCollectionBackup({ label: 'Before Bulk Cleanup!' });
    const fixed = { ...archive, createdAt: new Date(2026, 0, 15, 9, 30, 5).getTime() };
    expect(backupArchiveFilename(fixed)).toBe('collection-backup-Before-Bulk-Cleanup-2026-01-15-093005.json');
  });

  it('omits the label segment entirely when no label was set', async () => {
    const archive = await buildCollectionBackup();
    expect(backupArchiveFilename(archive).startsWith('collection-backup-')).toBe(true);
    expect(backupArchiveFilename(archive).includes('--')).toBe(false);
  });
});

describe('buildBackupArchiveBlob / exportBackupArchiveFile', () => {
  it('produces a JSON blob that round-trips into an equivalent archive', async () => {
    await createCollectionService({ name: 'Export Round-trip' });
    const archive = await buildCollectionBackup();
    const blob = buildBackupArchiveBlob(archive);
    expect(blob.type).toContain('application/json');
    const text = await blob.text();
    expect(JSON.parse(text)).toEqual(archive);
  });

  it('exportBackupArchiveFile triggers a download without throwing', async () => {
    const archive = await buildCollectionBackup();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    expect(() => exportBackupArchiveFile(archive)).not.toThrow();
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});

describe('importBackupArchiveFile', () => {
  it('round-trips a real exported archive back into a validatable shape', async () => {
    await createCollectionService({ name: 'Import Round-trip' });
    const archive = await buildCollectionBackup();
    const file = new File([buildBackupArchiveBlob(archive)], 'backup.json', { type: 'application/json' });

    const parsed = await importBackupArchiveFile(file);
    expect(isBackupArchiveShape(parsed)).toBe(true);
    const report = await validateBackupArchive(parsed);
    expect(report.valid).toBe(true);
    expect(report.checksumValid).toBe(true);
  });

  it('rejects a file that is not valid JSON with BackupImportError', async () => {
    const file = new File(['not json at all {{{'], 'broken.json', { type: 'application/json' });
    await expect(importBackupArchiveFile(file)).rejects.toBeInstanceOf(BackupImportError);
  });

  it('parses valid JSON that is not a backup archive — caller must validate the shape', async () => {
    const file = new File([JSON.stringify({ hello: 'world' })], 'other.json', { type: 'application/json' });
    const parsed = await importBackupArchiveFile(file);
    expect(parsed).toEqual({ hello: 'world' });
    expect(isBackupArchiveShape(parsed)).toBe(false);
  });
});
