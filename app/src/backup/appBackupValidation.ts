// Application Backup System — Verify Backup.
//
// Two things a `.vspsb` file can fail at, checked in cheapest-first order
// (mirrors `catalog/backup/backupValidation.ts`'s "shape, then checksum"
// convention): (1) it isn't a well-formed archive with a recognizable
// manifest at all, or (2) it parses fine but its declared checksums don't
// match its actual content (corruption, truncation, or tampering). Restore
// (`appBackupRestore.ts`) always runs this first and refuses to write
// anything on FAIL — see that module for the "never auto-restore on
// checksum failure" rule from the brief.

import { sha256Hex } from '../catalog/domain/hash';
import { readZipArchive, ZipArchiveError, type ZipInputEntry } from './zipArchive';
import { classifyBackupCompatibility, type MigrationCompatibilityResult } from './migrationCompatibility';
import { DB_VERSION } from '../storage/db';
import {
  MANIFEST_ENTRY_NAME,
  CHECKSUMS_ENTRY_NAME,
  SUPPORTED_APP_BACKUP_SCHEMA_VERSIONS,
  APP_BACKUP_FORMAT_ID,
  isAppBackupManifestShape,
  type AppBackupManifest,
} from './appBackupFormat';

export type AppBackupVerdict = 'PASS' | 'WARNING' | 'FAIL';

export interface AppBackupValidationIssue {
  severity: 'warning' | 'error';
  message: string;
}

export interface AppBackupValidationResult {
  verdict: AppBackupVerdict;
  manifest: AppBackupManifest | null;
  issues: AppBackupValidationIssue[];
  entryCount: number;
  checkedFileCount: number;
  mismatchedFileCount: number;
  compatibility: MigrationCompatibilityResult | null;
  /** The archive's own already-decompressed entries — exposed so
   * `appBackupRestore.ts` can apply a validated archive without a second
   * full decompression pass (`readZipArchive` decompresses every entry
   * up front; re-running it after validation already did the same work
   * would double the cost for a large portfolio). `null` whenever the
   * archive couldn't even be read as a ZIP (nothing to expose). */
  entries: ZipInputEntry[] | null;
}

function failResult(message: string, entryCount = 0): AppBackupValidationResult {
  return {
    verdict: 'FAIL',
    manifest: null,
    issues: [{ severity: 'error', message }],
    entryCount,
    checkedFileCount: 0,
    mismatchedFileCount: 0,
    compatibility: null,
    entries: null,
  };
}

async function hashEntry(entry: ZipInputEntry): Promise<string> {
  return sha256Hex(entry.data.buffer.slice(entry.data.byteOffset, entry.data.byteOffset + entry.data.byteLength) as ArrayBuffer);
}

/** Reads and fully verifies a `.vspsb` archive: well-formed ZIP, a
 * recognizable manifest, the manifest's own `archiveChecksum` against
 * `checksums.sha256`'s actual content, and every individual file listed
 * in `checksums.sha256` against its actual archived bytes. Read-only —
 * never writes anything to the database, safe to call standalone from
 * the "Verify Backup" tab as well as from `appBackupRestore.ts` before
 * every restore. */
export async function validateAppBackupArchive(blob: Blob): Promise<AppBackupValidationResult> {
  let entries: ZipInputEntry[];
  try {
    entries = await readZipArchive(blob);
  } catch (err) {
    const detail = err instanceof ZipArchiveError ? err.message : err instanceof Error ? err.message : String(err);
    return failResult(`This file is not a valid ZIP archive, or it is corrupted/truncated: ${detail}`);
  }

  const manifestEntry = entries.find((e) => e.name === MANIFEST_ENTRY_NAME);
  if (!manifestEntry) {
    return failResult('Archive is missing manifest.json — this is not a recognizable Vector Stock Pattern Studio backup.', entries.length);
  }

  let manifest: AppBackupManifest;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(manifestEntry.data));
    if (!isAppBackupManifestShape(parsed)) {
      return failResult('manifest.json does not match the expected backup manifest shape.', entries.length);
    }
    manifest = parsed;
  } catch {
    return failResult('manifest.json could not be parsed as JSON — the archive is corrupted.', entries.length);
  }

  const issues: AppBackupValidationIssue[] = [];

  if (manifest.format !== APP_BACKUP_FORMAT_ID) {
    issues.push({ severity: 'error', message: `Unrecognized backup format "${manifest.format}".` });
  }
  if (!SUPPORTED_APP_BACKUP_SCHEMA_VERSIONS.includes(manifest.schemaVersion)) {
    issues.push({
      severity: 'error',
      message: `Backup schema version ${manifest.schemaVersion} is not supported by this build (supported: ${SUPPORTED_APP_BACKUP_SCHEMA_VERSIONS.join(', ')}).`,
    });
  }

  let checkedFileCount = 0;
  let mismatchedFileCount = 0;

  const checksumsEntry = entries.find((e) => e.name === CHECKSUMS_ENTRY_NAME);
  if (!checksumsEntry) {
    issues.push({ severity: 'error', message: 'Archive is missing checksums.sha256 — file integrity cannot be verified.' });
  } else {
    const recomputedArchiveChecksum = await hashEntry(checksumsEntry);
    if (recomputedArchiveChecksum !== manifest.archiveChecksum) {
      issues.push({ severity: 'error', message: 'Archive checksum mismatch: checksums.sha256 has been altered or the archive is corrupted.' });
    }

    const lines = new TextDecoder()
      .decode(checksumsEntry.data)
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of lines) {
      const separatorIndex = line.indexOf('  ');
      if (separatorIndex === -1) {
        issues.push({ severity: 'error', message: `checksums.sha256 has a malformed line: "${line}"` });
        continue;
      }
      const expectedHash = line.slice(0, separatorIndex);
      const name = line.slice(separatorIndex + 2);
      const entry = entries.find((e) => e.name === name);
      checkedFileCount++;
      if (!entry) {
        mismatchedFileCount++;
        issues.push({ severity: 'error', message: `File listed in checksums.sha256 is missing from the archive: ${name}` });
        continue;
      }
      const actualHash = await hashEntry(entry);
      if (actualHash !== expectedHash) {
        mismatchedFileCount++;
        issues.push({ severity: 'error', message: `Checksum mismatch for ${name} — this file's content does not match what was recorded when the backup was made.` });
      }
    }
  }

  const compatibility = classifyBackupCompatibility(manifest.metadata.dbVersion, DB_VERSION);
  if (compatibility.compatibility === 'newerBackup') {
    issues.push({ severity: 'warning', message: compatibility.message });
  }

  const hasErrors = issues.some((i) => i.severity === 'error');
  const verdict: AppBackupVerdict = hasErrors ? 'FAIL' : issues.length > 0 ? 'WARNING' : 'PASS';

  return {
    verdict,
    manifest,
    issues,
    entryCount: entries.length,
    checkedFileCount,
    mismatchedFileCount,
    compatibility,
    entries,
  };
}
