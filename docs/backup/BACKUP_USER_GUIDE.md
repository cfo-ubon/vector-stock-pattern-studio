# Backup & Restore User Guide — Portfolio Manager P3

## Status: service layer only, no UI yet

This phase delivers the backup/restore **engine** — no screen, button, or
dialog was built in the app yet, matching P2 Stage 1's own "foundation
first" precedent (`docs/portfolio/COLLECTION_ARCHITECTURE.md`). This
guide documents the functions a future UI (or a developer working
directly in the browser console) uses to back up and restore Collections
today. The Thai end-user guide (`docs/USER_GUIDE.md`) records this same
"no new screen yet" status in its changelog, as it did for P2 Stage 1.

Everything below is real, working, fully-tested code — just not wired to
a button yet.

## Creating a backup

```ts
import { buildCollectionBackup } from './catalog/backup/backupBuilder';
import { exportBackupArchiveFile } from './catalog/backup/backupExportImport';
import { recordBackupCreated } from './catalog/backup/backupHistoryStore';

const archive = await buildCollectionBackup({ label: 'Before bulk cleanup' }); // label is optional
exportBackupArchiveFile(archive); // triggers a browser download, e.g. collection-backup-Before-bulk-cleanup-2026-07-18-093005.json
recordBackupCreated(archive);     // logs the event to the local backup history
```

The backup captures every Collection and every asset's membership in it,
as of the moment `buildCollectionBackup` was called. It does **not**
include the asset files themselves (previews, source files) — see
`BACKUP_FORMAT.md`'s "What's included / excluded" section. To back up the
files too, use the existing per-asset export
(`services/exportAsset.ts`'s `exportAssetById`).

## Checking a backup file before restoring

Always validate a picked/dropped file before trusting it — never call
`restoreBackup` on a raw, unvalidated file:

```ts
import { importBackupArchiveFile } from './catalog/backup/backupExportImport';
import { validateBackupArchive } from './catalog/backup/backupValidation';
import { isBackupArchiveShape } from './catalog/backup/backupFormat';

const parsed = await importBackupArchiveFile(pickedFile); // throws BackupImportError only if the file isn't valid JSON at all
if (!isBackupArchiveShape(parsed)) {
  // not a Collection backup file at all — show an error, stop here
}
const report = await validateBackupArchive(parsed, { crossCheckLiveAssets: true });
if (!report.valid) {
  // report.issues lists every problem (checksum mismatch, unsupported
  // schema version, corrupted payload, duplicate/orphaned IDs, ...) —
  // show these to the user before proceeding
}
// report.issues may still contain warning-severity entries
// (missing-live-asset) even when report.valid is true — worth surfacing
// but not blocking.
```

## Previewing a restore (always do this before restoring)

```ts
import { previewRestore } from './catalog/backup/restoreService';

const preview = await previewRestore(archive, 'overwrite'); // or 'merge'
if (!preview.previewable) {
  // archive failed validation — see preview.validation.issues
}
console.log(preview.toCreateCount, preview.toUpdateCount, preview.conflictCount);
console.log(preview.membershipsToAdd, preview.membershipsToRemove);
for (const entry of preview.collections) {
  // entry.diff: 'create' | 'unchanged' | 'conflict'
  // entry.resolvedAction: what restoring with this exact mode will do to this collection
}
```

`previewRestore` never writes anything — it is always safe to call, as
many times as needed, with either mode, to help the user decide. See
`RESTORE_WORKFLOW.md`'s "Dry-run guarantee" section.

## Restoring

```ts
import { restoreBackup, BackupRestoreError } from './catalog/backup/restoreService';
import { recordRestoreCompleted, recordRestoreFailed } from './catalog/backup/backupHistoryStore';

try {
  const result = await restoreBackup(archive, 'overwrite'); // or 'merge'
  recordRestoreCompleted(archive, 'overwrite');
  console.log(result.collectionsCreated, result.collectionsUpdated, result.membershipsAdded, result.membershipsRemoved);
  if (result.skippedMissingAssetIds.length > 0) {
    // some membership entries referenced assets that no longer exist — not an error, just informational
  }
} catch (err) {
  if (err instanceof BackupRestoreError) {
    recordRestoreFailed(archive, 'overwrite', err.message);
    // err.validation has the full report — nothing was written
  }
}
```

### Choosing a mode

- **Overwrite** — use when the backup should become the new source of
  truth for everything it covers: conflicting collection metadata is
  replaced, and membership in backup-covered collections is set to
  exactly what the backup says (removing anything added since). Good for
  "restore to this known-good point," e.g. after unwanted bulk changes.
- **Merge** — use when you want to bring back what's missing without
  losing anything done since the backup: only creates collections that
  don't already exist, and only adds memberships, never removes or
  overwrites. Good for combining an old backup with ongoing work.

There is no third "resolve each conflict individually" mode — conflict
resolution is deterministic per mode, by design (see
`RESTORE_WORKFLOW.md`'s "Conflict detection" section).

### Cancel

There is no `cancelRestore` function. "Cancel" means: call
`previewRestore`, look at the result, and simply never call
`restoreBackup`. Nothing is written until `restoreBackup` is called.

## Viewing backup/restore history

```ts
import { loadBackupHistory, clearBackupHistory } from './catalog/backup/backupHistoryStore';

const history = loadBackupHistory(); // newest first, up to the last 50 events
```

History is stored locally (`localStorage`) and lists lightweight event
metadata only — never the archive contents themselves. It is a local
activity log, not a way to recover a lost backup file; the actual backup
data only ever exists in the downloaded `.json` file.

## What happens if something goes wrong

- **A corrupted or tampered backup file**: `validateBackupArchive` and
  `restoreBackup` both catch this — `restoreBackup` throws
  `BackupRestoreError` and writes nothing.
- **The browser/tab closes mid-restore**: safe. Re-running
  `restoreBackup` with the same archive and mode will finish the job
  correctly — see `RESTORE_WORKFLOW.md`'s "Interrupted restore" section.
- **An asset the backup references was deleted since the backup was
  taken**: that one membership is skipped and reported; the rest of the
  restore proceeds normally.

## Explicitly not supported yet

- No in-app UI (button, dialog, drag-and-drop zone) — this phase is
  service-layer only.
- No scheduled/automatic backups.
- No cloud sync or cross-device transfer — export/import is a manual
  local file operation.
- No backup of the underlying asset files (previews, source files) — use
  the existing per-asset ZIP export for that.
