import { downloadBlobFile } from '../../export/svgExporter';
import type { BackupArchive } from './backupFormat';

// Portfolio Manager P3 — Export/Import (Objectives: "Export", "Import").
// Thin file I/O glue only, matching `workbench/workbenchImportExport.ts`'s
// existing split: a backup archive is already a plain JSON-serializable
// object (`backupBuilder.ts`), so this module's entire job is turning one
// into a downloaded `.json` file and a picked/dropped `File` back into a
// parsed JSON value — it deliberately does NOT validate the parsed
// result's shape (that is `backupValidation.ts`'s job, run by the caller
// before treating the result as a trustworthy `BackupArchive`).

function safeFileNamePart(text: string): string {
  return text.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

/** `YYYY-MM-DD-HHmmss`, derived from the archive's own `createdAt` (not
 * the current time), so a filename always identifies exactly when the
 * backup was taken even if downloaded again later. */
function timestampForFilename(createdAtMs: number): string {
  const d = new Date(createdAtMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export function backupArchiveFilename(archive: BackupArchive): string {
  const labelPart = archive.metadata.label ? `${safeFileNamePart(archive.metadata.label)}-` : '';
  return `collection-backup-${labelPart}${timestampForFilename(archive.createdAt)}.json`;
}

export function buildBackupArchiveBlob(archive: BackupArchive): Blob {
  return new Blob([JSON.stringify(archive)], { type: 'application/json;charset=utf-8' });
}

/** Triggers a browser download of the archive as a `.json` file. */
export function exportBackupArchiveFile(archive: BackupArchive): void {
  downloadBlobFile(backupArchiveFilename(archive), buildBackupArchiveBlob(archive));
}

export class BackupImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupImportError';
  }
}

/** Reads a picked/dropped file and parses it as JSON. Returns `unknown`
 * deliberately — the caller must run `validateBackupArchive` (or at
 * least `isBackupArchiveShape`) on the result before treating it as a
 * real `BackupArchive`; this function only proves the file is valid JSON,
 * not that it is a Collection backup. Throws `BackupImportError` for a
 * file that isn't even parseable JSON (a genuinely different/corrupted
 * file), rather than letting a raw `SyntaxError` leak to callers. */
export async function importBackupArchiveFile(file: File | Blob): Promise<unknown> {
  const text = await file.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new BackupImportError('This file is not valid JSON and cannot be read as a Collection backup archive.');
  }
}
