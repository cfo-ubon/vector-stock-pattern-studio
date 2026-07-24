// Application Backup System — builds a complete `.vspsb` archive.
//
// Unlike the two pre-existing, narrower backup subsystems in this repo
// (`catalog/backup/backupBuilder.ts`'s Collection-only backup, and
// `catalog/backup/productionBackup.ts`'s 8-store Production backup —
// neither of which includes actual portfolio asset metadata or the
// binary artwork files themselves), this module captures literally
// everything the app persists: every IndexedDB store, every binary
// source file, and every localStorage setting/preset — see
// `docs/BACKUP_SYSTEM.md` for the full rationale.

import { sha256Hex } from '../catalog/domain/hash';
import { PORTFOLIO_FILES_STORE, DB_VERSION, requestAsPromise, openDb } from '../storage/db';
import type { PortfolioFileRecord } from '../catalog/domain/types';
import { compressZipEntry, assembleZip, readZipArchive, type ZipInputEntry, type ZipAssembledEntry } from './zipArchive';
import { dumpAllStores } from './appBackupIdb';
import { captureSettingsSnapshot, settingsSnapshotEntryName } from './appBackupSettingsSnapshot';
import {
  APP_BACKUP_FORMAT_ID,
  APP_BACKUP_SCHEMA_VERSION,
  APP_BACKUP_GENERATOR_VERSION,
  APP_BACKUP_APPLICATION_LABEL,
  APP_BACKUP_STORE_NAMES,
  APP_BACKUP_SETTINGS_KEYS,
  APP_BACKUP_EXTENSION,
  MANIFEST_ENTRY_NAME,
  CHECKSUMS_ENTRY_NAME,
  DATABASE_ENTRY_NAME,
  ASSETS_ENTRY_PREFIX,
  type AppBackupManifest,
  type AppBackupAssetEntry,
} from './appBackupFormat';

/** Mirrors `docs/USER_GUIDE.md`'s current "Application Version" header —
 * both are the same manually-tracked source of truth (see that doc's own
 * "Version and Build Numbering" section); update this constant whenever
 * that header changes. Purely informational on the manifest — never used
 * to gate a restore decision (`migrationCompatibility.ts` compares
 * `dbVersion`/`schemaVersion`, not this string). */
export const CURRENT_APPLICATION_VERSION_LABEL = 'v1.80';

export type AppBackupStage = 'preparing' | 'compressing' | 'verifying' | 'completed';

export interface AppBackupProgressEvent {
  stage: AppBackupStage;
  filesProcessed: number;
  totalFiles: number;
  bytesProcessed: number;
  totalBytes: number;
}

export type AppBackupProgressCallback = (event: AppBackupProgressEvent) => void;

export interface BuildAppBackupOptions {
  deviceLabel?: string;
  label?: string;
  onProgress?: AppBackupProgressCallback;
}

export interface AppBackupBuildResult {
  blob: Blob;
  manifest: AppBackupManifest;
  fileName: string;
}

function sanitizeFilenameSegment(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_');
}

function timestampForFilename(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/** Builds a complete `.vspsb` archive of everything the app persists:
 * every IndexedDB store's records (as `database.json`), every portfolio
 * source file's actual bytes (as individual `assets/<fileId>__<name>`
 * entries — the gap neither existing backup subsystem closes), and every
 * localStorage setting/preset key (as individual `settings/<key>.json`
 * entries). Read-only against the database — safe to run alongside
 * normal app usage, same as the two existing backup subsystems. */
export async function buildAppBackup(options: BuildAppBackupOptions = {}): Promise<AppBackupBuildResult> {
  const onProgress = options.onProgress ?? (() => {});
  const createdAt = Date.now();

  onProgress({ stage: 'preparing', filesProcessed: 0, totalFiles: 0, bytesProcessed: 0, totalBytes: 0 });

  const [databaseDump, fileRecords] = await Promise.all([
    dumpAllStores(APP_BACKUP_STORE_NAMES),
    dumpPortfolioFiles(),
  ]);
  const settingsSnapshot = captureSettingsSnapshot(APP_BACKUP_SETTINGS_KEYS);
  const settingsKeys = Object.keys(settingsSnapshot.values);

  const assetEntries: AppBackupAssetEntry[] = [];
  const zipInputs: ZipInputEntry[] = [];
  let totalOriginalAssetBytes = 0;

  for (const record of fileRecords) {
    const archivePath = `${ASSETS_ENTRY_PREFIX}${record.fileId}__${sanitizeFilenameSegment(record.filename)}`;
    const buffer = await record.blob.arrayBuffer();
    const data = new Uint8Array(buffer);
    zipInputs.push({ name: archivePath, data });
    assetEntries.push({
      fileId: record.fileId,
      assetId: record.assetId,
      archivePath,
      role: record.role,
      filename: record.filename,
      mimeType: record.mimeType,
      fileSize: record.fileSize,
      sha256: record.sha256,
      storedAt: record.storedAt,
    });
    totalOriginalAssetBytes += record.fileSize;
  }

  for (const [key, raw] of Object.entries(settingsSnapshot.values)) {
    zipInputs.push({ name: settingsSnapshotEntryName(key), data: new TextEncoder().encode(raw) });
  }

  const databaseJson = JSON.stringify(databaseDump);
  const databaseBytes = new TextEncoder().encode(databaseJson);
  zipInputs.push({ name: DATABASE_ENTRY_NAME, data: databaseBytes });

  const totalBytes = totalOriginalAssetBytes + databaseBytes.length;

  // checksums.sha256 — one line per content entry (everything except the
  // manifest itself, which does not exist yet — and except this file).
  const checksumLines: string[] = [];
  for (const entry of zipInputs) {
    const hash = await sha256Hex(entry.data.buffer.slice(entry.data.byteOffset, entry.data.byteOffset + entry.data.byteLength) as ArrayBuffer);
    checksumLines.push(`${hash}  ${entry.name}`);
  }
  const checksumsContent = checksumLines.join('\n') + '\n';
  const checksumsBytes = new TextEncoder().encode(checksumsContent);
  const archiveChecksum = await sha256Hex(checksumsBytes.buffer as ArrayBuffer);
  zipInputs.push({ name: CHECKSUMS_ENTRY_NAME, data: checksumsBytes });

  // Compress every content entry (everything except manifest.json) ONCE
  // here, so its exact compressed size is known BEFORE manifest.json is
  // serialized — manifest.json's own `stats` fields need those numbers,
  // but manifest.json's bytes must exist before it can be compressed and
  // appended to the archive, so this order avoids the only alternative
  // (compressing every asset a second time just to learn sizes a small
  // metadata file wants to report) — see `zipArchive.ts`'s
  // `compressZipEntry`/`assembleZip` split for why this is possible
  // without re-paying compression cost on potentially large files.
  const contentAssembled: ZipAssembledEntry[] = [];
  let bytesProcessed = 0;
  const totalFilesIncludingManifest = zipInputs.length + 1;
  for (let i = 0; i < zipInputs.length; i++) {
    const entry = zipInputs[i];
    contentAssembled.push(await compressZipEntry(entry));
    bytesProcessed += entry.data.length;
    onProgress({ stage: 'compressing', filesProcessed: i + 1, totalFiles: totalFilesIncludingManifest, bytesProcessed, totalBytes });
  }
  const contentOriginalSize = contentAssembled.reduce((s, e) => s + e.originalData.length, 0);
  const contentCompressedSize = contentAssembled.reduce((s, e) => s + e.compressedData.length, 0);

  const storeRecordCounts: Record<string, number> = {};
  for (const name of APP_BACKUP_STORE_NAMES) storeRecordCounts[name] = (databaseDump[name] ?? []).length;

  const manifest: AppBackupManifest = {
    format: APP_BACKUP_FORMAT_ID,
    schemaVersion: APP_BACKUP_SCHEMA_VERSION,
    applicationVersion: APP_BACKUP_APPLICATION_LABEL,
    appVersionLabel: CURRENT_APPLICATION_VERSION_LABEL,
    generatorVersion: APP_BACKUP_GENERATOR_VERSION,
    backupId: crypto.randomUUID(),
    createdAt,
    stats: {
      storeRecordCounts,
      assetFileCount: assetEntries.length,
      settingsKeyCount: settingsKeys.length,
      // Deliberately describes the backup CONTENT (database + assets +
      // settings + checksums.sha256), not including manifest.json's own
      // (typically well under 1KB) contribution — a file cannot know its
      // own final compressed size before it is compressed. The archive's
      // actual total size (`AppBackupBuildResult.blob.size`) is always
      // available separately and is what the Backup Manager UI displays.
      fileCount: contentAssembled.length + 1,
      originalSize: contentOriginalSize,
      compressedSize: contentCompressedSize,
    },
    metadata: {
      dbVersion: DB_VERSION,
      deviceLabel: options.deviceLabel?.trim() || defaultDeviceLabel(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
      ...(options.label ? { label: options.label } : {}),
    },
    assets: assetEntries,
    settingsKeys,
    archiveChecksum,
  };

  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
  const manifestAssembled = await compressZipEntry({ name: MANIFEST_ENTRY_NAME, data: manifestBytes });
  onProgress({
    stage: 'compressing',
    filesProcessed: totalFilesIncludingManifest,
    totalFiles: totalFilesIncludingManifest,
    bytesProcessed: bytesProcessed + manifestBytes.length,
    totalBytes: totalBytes + manifestBytes.length,
  });

  const zipResult = assembleZip([manifestAssembled, ...contentAssembled]);

  onProgress({ stage: 'verifying', filesProcessed: totalFilesIncludingManifest, totalFiles: totalFilesIncludingManifest, bytesProcessed: totalBytes, totalBytes });

  // Cheap self-check: read the archive's own central directory back
  // immediately after building, before handing the blob back to the
  // caller — catches a build-time bug producing a malformed archive
  // right away rather than only at the next restore.
  const readBack = await readZipArchive(zipResult.blob);
  const expectedEntryCount = contentAssembled.length + 1;
  if (readBack.length !== expectedEntryCount) {
    throw new Error(`Backup self-verification failed: archive has ${readBack.length} entries, expected ${expectedEntryCount}.`);
  }

  onProgress({ stage: 'completed', filesProcessed: totalFilesIncludingManifest, totalFiles: totalFilesIncludingManifest, bytesProcessed: totalBytes, totalBytes });

  const fileName = `vector-stock-pattern-studio-backup-${timestampForFilename(new Date(createdAt))}${APP_BACKUP_EXTENSION}`;

  return { blob: zipResult.blob, manifest, fileName };
}

async function dumpPortfolioFiles(): Promise<PortfolioFileRecord[]> {
  const db = await openDb();
  const tx = db.transaction(PORTFOLIO_FILES_STORE, 'readonly');
  const store = tx.objectStore(PORTFOLIO_FILES_STORE);
  return requestAsPromise(store.getAll()) as Promise<PortfolioFileRecord[]>;
}

function defaultDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Unknown Device';
  const ua = navigator.userAgent;
  if (/iPad/.test(ua)) return 'iPad';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Android/.test(ua)) return 'Android Device';
  if (/Linux/.test(ua)) return 'Linux PC';
  return 'Unknown Device';
}
