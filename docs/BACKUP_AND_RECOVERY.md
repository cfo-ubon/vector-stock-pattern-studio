# Backup and Recovery (Desktop)

## What already existed vs. what this migration added

The web app already ships a full, tested, documented Backup & Restore
subsystem for Portfolio/Collection data (`app/src/catalog/backup/*`,
Portfolio Manager P3 — see `docs/portfolio/` for its own 5 docs). That
subsystem is untouched by this migration and keeps working exactly as
before, entirely inside IndexedDB.

This migration adds the desktop-only concept the web app never needed: a
**currently-open `.vsps` project file on disk**, and the OS-level
mechanics of backing that file up, autosaving it, and recovering it after
a crash.

## Backup

**Manual**: File menu → Tools → "Backup Data" (or the `backup:runManual`
IPC channel) copies the current `.vsps` file, unmodified, to:

```
Documents\Vector Stock Pattern Studio\Backups\<project-name>.<timestamp>.vsps
```

**Automatic**: a timer in `electron/main.ts` (interval from the
`backupIntervalMinutes` setting, default 30 minutes) runs the same copy
whenever a project is open.

**Rotation**: at most 10 backups are kept per project (oldest deleted
first) — `rotateBackupsFor()` in `electron/ipc/backupHandlers.ts`.

**Storage location**: per the brief, always outside the install
directory (`app.getPath('documents')`, never inside `Program Files` or
the app's own resources folder) — so an uninstall never touches backups,
and a fresh reinstall sees the same backup history.

Every backup is recorded in the SQLite `backup_log` table
(`electron/db/appDb.ts`) with its trigger (`manual`/`automatic`), size,
and timestamp — surfaced via `backup:list`.

## Restore

`backup:restore` (given a backup's id) returns the backup file's path;
the renderer then opens it through the normal `.vsps` open flow
(`project:openPath`) — restoring is "open this specific backup file," not
a separate code path, so it gets the exact same validation
(`vspsReader.ts`'s `VspsFormatError` handling) as opening any other
project.

**Before overwriting current data**: opening a project (backup or not)
never silently discards unsaved work in the currently-open project — the
existing unsaved-changes-before-close confirmation
(`electron/main.ts`'s `close` handler) applies equally to switching
projects, per the brief's "clear explanation before overwriting existing
local data" requirement.

## Autosave

`electron/main.ts` runs an autosave timer (interval from the
`autosaveIntervalMinutes` setting, default 5 minutes). When it fires and
the renderer has reported unsaved changes (`app:reportState`), main sends
`app:requestAutosave` to the renderer, which is expected to save silently
(no dialog) to the current file path.

Every successful autosave also updates `recovery.json` in the Electron
`userData` directory (`electron/ipc/recoveryHandlers.ts`'s
`writeRecoveryMarker()`) with the project name, current file path, and
timestamp.

## Crash recovery

`recovery.json` is only ever deleted on a **clean** shutdown (the
renderer confirms it has no unsaved changes, or the user chose "close
without saving," and main's `close` handler calls
`clearRecoveryMarker()`). If the app starts and finds `recovery.json` still
present, the previous session did not shut down cleanly — `recovery:check`
returns `{ hasRecoveryData: true, projectName, filePath, recoveredAt }`
for the renderer to offer recovery on launch.

## Known limitation (documented, not hidden)

The autosave/crash-recovery **mechanism** (timers, IPC round trip, marker
file lifecycle) is fully implemented and code-complete. The renderer-side
"what counts as unsaved" decision is intentionally left for the caller to
wire (see `src/desktop/useDesktopIntegration.ts`'s own doc comment) — the
existing `App.tsx` has no centralized dirty-state flag today, and
guessing one during a mechanical migration risked being wrong. Until a
caller supplies a real `hasUnsavedChanges` boolean, the close-confirmation
dialog and autosave trigger are wired but will not yet fire on real edits.
This is listed as a known follow-up in
`DESKTOP_OFFLINE_BUILD_REPORT.md`, not silently left out of scope.
