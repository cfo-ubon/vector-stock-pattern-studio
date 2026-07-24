// Application Backup System — restore-time version compatibility.
//
// Compares a backup archive's recorded `dbVersion` (the IndexedDB schema
// version active when the backup was taken, see `storage/db.ts`'s
// `DB_VERSION`) against the CURRENT app's `DB_VERSION`. This app's own
// `onupgradeneeded` handler (`storage/db.ts`) is already additive-only and
// idempotent (every store creation is `contains()`-guarded), so an older
// backup's stores always exist in a newer database — no separate data
// migration step is needed beyond the upsert restore `appBackupRestore.ts`
// already performs. This module exists purely to classify the situation
// so the Backup Manager UI can show an honest, specific message instead
// of silently restoring across a version gap.

export type MigrationCompatibility = 'same' | 'olderBackup' | 'newerBackup';

export interface MigrationCompatibilityResult {
  compatibility: MigrationCompatibility;
  backupDbVersion: number;
  currentDbVersion: number;
  message: string;
}

export function classifyBackupCompatibility(backupDbVersion: number, currentDbVersion: number): MigrationCompatibilityResult {
  if (backupDbVersion === currentDbVersion) {
    return {
      compatibility: 'same',
      backupDbVersion,
      currentDbVersion,
      message: 'This backup was taken from the same database version as the app you are restoring into.',
    };
  }
  if (backupDbVersion < currentDbVersion) {
    return {
      compatibility: 'olderBackup',
      backupDbVersion,
      currentDbVersion,
      message: `This backup is from an older version of the app (database v${backupDbVersion}, current is v${currentDbVersion}). It will restore normally — every store this backup knows about still exists in the current database, and newer stores this backup never had are left untouched.`,
    };
  }
  return {
    compatibility: 'newerBackup',
    backupDbVersion,
    currentDbVersion,
    message: `This backup is from a NEWER version of the app (database v${backupDbVersion}) than the one you are restoring into (v${currentDbVersion}). Restoring it here may lose data that only the newer app version understands — update the app before restoring if possible.`,
  };
}
