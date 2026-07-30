// Application Backup System — Restore.
//
// Restore is deliberately conservative, per the brief: (1) the archive is
// always fully verified first (`validateAppBackupArchive`) and restore
// refuses to write anything on a FAIL verdict; (2) a Safety Backup of the
// CURRENT database is always taken before a single record is overwritten,
// so a bad restore is itself recoverable; (3) every store is restored via
// upsert (`appBackupIdb.putAllRecords`), matching `productionBackup.ts`'s
// "each record's own primary key decides create-vs-overwrite" convention
// — nothing already in the database is ever deleted by a restore, only
// added to or overwritten record-by-record.

import { sha256HexOfFile } from '../catalog/domain/hash';
import { DB_VERSION, PORTFOLIO_FILES_STORE } from '../storage/db';
import type { PortfolioFileRecord } from '../catalog/domain/types';
import { validateAppBackupArchive, type AppBackupValidationResult } from './appBackupValidation';
import { restoreAllStores, putAllRecords } from './appBackupIdb';
import { applySettingsSnapshot, type AppBackupSettingsSnapshot } from './appBackupSettingsSnapshot';
import { classifyBackupCompatibility, type MigrationCompatibilityResult } from './migrationCompatibility';
import { buildAppBackup } from './appBackupBuilder';
import { addBackupHistoryRecord } from './appBackupHistoryStore';
import { isQuotaExceededError } from '../pwa/storageQuota';
import {
  APP_BACKUP_STORE_NAMES,
  DATABASE_ENTRY_NAME,
  SETTINGS_ENTRY_PREFIX,
  type AppBackupManifest,
  type AppBackupDatabaseDump,
} from './appBackupFormat';

export class AppBackupRestoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppBackupRestoreError';
  }
}

export interface AppBackupRestorePreview {
  validation: AppBackupValidationResult;
  compatibility: MigrationCompatibilityResult | null;
  canRestore: boolean;
}

/** Read-only first step: validates the archive and reports whether
 * restore is even possible, without writing anything. The Backup Manager
 * UI always calls this first so it can show the user what they're about
 * to restore (record counts, compatibility warning, checksum status)
 * before they confirm. */
export async function previewAppBackupRestore(blob: Blob): Promise<AppBackupRestorePreview> {
  const validation = await validateAppBackupArchive(blob);
  return {
    validation,
    compatibility: validation.compatibility,
    canRestore: validation.verdict !== 'FAIL',
  };
}

export interface AppBackupRestoreOptions {
  /** Device label recorded on the Safety Backup's history entry — same
   * meaning as `appBackupBuilder.ts`'s `BuildAppBackupOptions.deviceLabel`. */
  deviceLabel?: string;
}

export interface AppBackupRestoreResult {
  manifest: AppBackupManifest;
  storeRecordCounts: Record<string, number>;
  assetFilesRestored: number;
  settingsKeysRestored: number;
  safetyBackupHistoryId: string;
  compatibility: MigrationCompatibilityResult;
}

/** Restores a `.vspsb` archive. Always re-validates internally (never
 * trusts a caller-supplied "already validated" flag — the archive could
 * have been swapped between preview and confirm) and refuses to write
 * anything if validation FAILs. Always takes a Safety Backup of the
 * current database first, recorded in Backup History with
 * `trigger: 'safety'` so it is never pruned by retention. */
export async function applyAppBackupRestore(blob: Blob, options: AppBackupRestoreOptions = {}): Promise<AppBackupRestoreResult> {
  const validation = await validateAppBackupArchive(blob);
  if (validation.verdict === 'FAIL' || !validation.manifest || !validation.entries) {
    const reason = validation.issues.find((i) => i.severity === 'error')?.message ?? 'Archive failed validation.';
    throw new AppBackupRestoreError(`Cannot restore this backup: ${reason}`);
  }
  const manifest = validation.manifest;
  const entries = validation.entries;

  // Safety Backup — always, before any write. Failure to build it aborts
  // the restore entirely (per the brief: "always create a Safety Backup
  // first", not "try to").
  const safetyBuildStartedAt = Date.now();
  let safetyBackup;
  try {
    safetyBackup = await buildAppBackup({ deviceLabel: options.deviceLabel, label: 'Safety Backup (automatic, before restore)' });
  } catch (err) {
    throw new AppBackupRestoreError(
      `Restore aborted: could not create the mandatory Safety Backup of your current data before restoring. Nothing was changed. (${err instanceof Error ? err.message : String(err)})`
    );
  }
  const safetyHistoryId = safetyBackup.manifest.backupId;
  await addBackupHistoryRecord({
    historyId: safetyHistoryId,
    createdAt: safetyBuildStartedAt,
    fileName: safetyBackup.fileName,
    destination: options.deviceLabel?.trim() || 'This device',
    result: 'success',
    durationMs: Date.now() - safetyBuildStartedAt,
    trigger: 'safety',
    appVersionLabel: safetyBackup.manifest.appVersionLabel,
    dbVersion: safetyBackup.manifest.metadata.dbVersion,
    fileCount: safetyBackup.manifest.stats.fileCount,
    assetFileCount: safetyBackup.manifest.stats.assetFileCount,
    originalSize: safetyBackup.manifest.stats.originalSize,
    compressedSize: safetyBackup.manifest.stats.compressedSize,
    blob: safetyBackup.blob,
  });

  // database.json — every generic store.
  const databaseEntry = entries.find((e) => e.name === DATABASE_ENTRY_NAME);
  let storeRecordCounts: Record<string, number> = {};
  const fileRecords: PortfolioFileRecord[] = [];
  try {
    if (databaseEntry) {
      const dump = JSON.parse(new TextDecoder().decode(databaseEntry.data)) as AppBackupDatabaseDump;
      storeRecordCounts = await restoreAllStores(dump, APP_BACKUP_STORE_NAMES);
    }

    // assets/ — binary portfolio files, reconstructed from manifest metadata
    // + archived bytes (portfolioFiles is deliberately not part of
    // database.json — see appBackupFormat.ts's header comment).
    for (const assetMeta of manifest.assets) {
      const entry = entries.find((e) => e.name === assetMeta.archivePath);
      if (!entry) continue; // already flagged by validation if genuinely missing; defensive skip here
      fileRecords.push({
        fileId: assetMeta.fileId,
        assetId: assetMeta.assetId,
        role: assetMeta.role as PortfolioFileRecord['role'],
        filename: assetMeta.filename,
        mimeType: assetMeta.mimeType,
        fileSize: assetMeta.fileSize,
        sha256: assetMeta.sha256,
        blob: new Blob([entry.data as BlobPart], { type: assetMeta.mimeType }),
        storedAt: assetMeta.storedAt,
      });
    }
    await putAllRecords(PORTFOLIO_FILES_STORE, fileRecords);
  } catch (err) {
    // Restore is upsert-only (nothing is ever deleted), so a write
    // failure partway through leaves the database incomplete but not
    // corrupt — records already written stay valid, records not yet
    // reached are simply unchanged. The Safety Backup taken above still
    // reflects the pre-restore state, so surface its ID here rather than
    // just the raw browser error, since that's the user's actual recovery
    // path if this partial state isn't what they want.
    if (isQuotaExceededError(err)) {
      throw new AppBackupRestoreError(
        `Restore stopped: not enough free storage space to write this backup. Some records may already be restored (nothing already in your data was deleted). Free up space (see Storage Cleanup) or restore fewer items, then try again. Your pre-restore Safety Backup is saved in Backup History (id: ${safetyHistoryId}).`
      );
    }
    throw err;
  }

  // settings/ — localStorage snapshot.
  const settingsSnapshot: AppBackupSettingsSnapshot = { values: {} };
  for (const key of manifest.settingsKeys) {
    const entryName = `${SETTINGS_ENTRY_PREFIX}${encodeURIComponent(key)}.json`;
    const entry = entries.find((e) => e.name === entryName);
    if (entry) settingsSnapshot.values[key] = new TextDecoder().decode(entry.data);
  }
  applySettingsSnapshot(settingsSnapshot);

  const compatibility = classifyBackupCompatibility(manifest.metadata.dbVersion, DB_VERSION);

  return {
    manifest,
    storeRecordCounts,
    assetFilesRestored: fileRecords.length,
    settingsKeysRestored: Object.keys(settingsSnapshot.values).length,
    safetyBackupHistoryId: safetyHistoryId,
    compatibility,
  };
}

/** Standalone helper for a UI "verify a specific restored file's bytes"
 * spot-check — not used by the main restore path (which trusts
 * `validateAppBackupArchive`'s already-verified checksums), but exposed
 * so the Backup Manager can offer a quick post-restore sanity check on
 * an individual asset without re-reading the whole archive. */
export async function verifyRestoredFileHash(record: PortfolioFileRecord): Promise<boolean> {
  const actual = await sha256HexOfFile(record.blob);
  return actual === record.sha256;
}
