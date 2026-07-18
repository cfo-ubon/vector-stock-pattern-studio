import type { BackupArchive } from './backupFormat';

// Portfolio Manager P3 — backup history log ("Objectives: ... Backup
// history"). A `localStorage`-backed list of lightweight entries (never
// the archives themselves, which can be large — see `HISTORY_ENTRY_LIMIT`
// and `describeArchiveForHistory`'s doc comment), following the same
// `STORAGE_KEY` + JSON serialize/parse convention as
// `workbench/workspaceSettings.ts`. Chosen over a new IndexedDB object
// store specifically to avoid a `storage/db.ts` `DB_VERSION` bump for a
// feature that is purely a local activity log, not restorable state in
// its own right.

export const BACKUP_HISTORY_SCHEMA_VERSION = 1;

export type BackupHistoryEventKind = 'backup-created' | 'restore-completed' | 'restore-failed';

export interface BackupHistoryEntry {
  id: string;
  kind: BackupHistoryEventKind;
  /** `Date.now()` at the moment the event was recorded — independent of
   * `archiveCreatedAt`, which reflects when the archive itself was built
   * and may be much older for a restore performed later. */
  recordedAt: number;
  archiveCreatedAt: number;
  label: string | undefined;
  stats: { collectionCount: number; assetCount: number; membershipCount: number };
  /** Only present for `restore-completed`/`restore-failed` events. */
  restoreMode?: 'overwrite' | 'merge';
  /** Only present for `restore-failed` events — the reason the restore
   * was refused (see `restoreService.ts`'s `BackupRestoreError`). */
  failureReason?: string;
}

/** Oldest entries are dropped once history exceeds this length, so an
 * app used for years of backups never grows an unbounded `localStorage`
 * value — this is an activity log, not an archive; the archives
 * themselves are only ever downloaded files, never retained here. */
export const HISTORY_ENTRY_LIMIT = 50;

const STORAGE_KEY = 'vsp-collection-backup-history';

interface HistoryFile {
  schemaVersion: number;
  entries: BackupHistoryEntry[];
}

function isBackupHistoryEntry(value: unknown): value is BackupHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    (v.kind === 'backup-created' || v.kind === 'restore-completed' || v.kind === 'restore-failed') &&
    typeof v.recordedAt === 'number' &&
    typeof v.archiveCreatedAt === 'number' &&
    typeof v.stats === 'object' &&
    v.stats !== null
  );
}

function readHistoryFile(): HistoryFile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { schemaVersion: BACKUP_HISTORY_SCHEMA_VERSION, entries: [] };
    const parsed: unknown = JSON.parse(raw);
    const obj = parsed as Partial<HistoryFile> | null;
    const entries = Array.isArray(obj?.entries) ? obj.entries.filter(isBackupHistoryEntry) : [];
    return { schemaVersion: BACKUP_HISTORY_SCHEMA_VERSION, entries };
  } catch {
    return { schemaVersion: BACKUP_HISTORY_SCHEMA_VERSION, entries: [] };
  }
}

function writeHistoryFile(file: HistoryFile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(file));
  } catch {
    // storage unavailable/full — history just won't persist this event
  }
}

/** Newest first. Entries are stored oldest-to-newest; reversing before the
 * (stable) sort means two entries recorded in the same millisecond —
 * `recordedAt` only has millisecond resolution — still come out in true
 * insertion order (most recently appended first) instead of an
 * arbitrary tie order. */
export function loadBackupHistory(): BackupHistoryEntry[] {
  return [...readHistoryFile().entries].reverse().sort((a, b) => b.recordedAt - a.recordedAt);
}

function makeEntryId(): string {
  return `bh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function appendEntry(entry: Omit<BackupHistoryEntry, 'id' | 'recordedAt'>): BackupHistoryEntry {
  const file = readHistoryFile();
  const full: BackupHistoryEntry = { ...entry, id: makeEntryId(), recordedAt: Date.now() };
  const entries = [...file.entries, full].slice(-HISTORY_ENTRY_LIMIT);
  writeHistoryFile({ schemaVersion: BACKUP_HISTORY_SCHEMA_VERSION, entries });
  return full;
}

export function recordBackupCreated(archive: BackupArchive): BackupHistoryEntry {
  return appendEntry({ kind: 'backup-created', archiveCreatedAt: archive.createdAt, label: archive.metadata.label, stats: archive.stats });
}

export function recordRestoreCompleted(archive: BackupArchive, mode: 'overwrite' | 'merge'): BackupHistoryEntry {
  return appendEntry({ kind: 'restore-completed', archiveCreatedAt: archive.createdAt, label: archive.metadata.label, stats: archive.stats, restoreMode: mode });
}

export function recordRestoreFailed(archive: BackupArchive, mode: 'overwrite' | 'merge', reason: string): BackupHistoryEntry {
  return appendEntry({ kind: 'restore-failed', archiveCreatedAt: archive.createdAt, label: archive.metadata.label, stats: archive.stats, restoreMode: mode, failureReason: reason });
}

export function clearBackupHistory(): void {
  writeHistoryFile({ schemaVersion: BACKUP_HISTORY_SCHEMA_VERSION, entries: [] });
}
