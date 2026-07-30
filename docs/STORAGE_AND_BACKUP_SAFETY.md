# Storage and Backup Safety

## Storage quota management (Build 027 Phase 3)

`app/src/pwa/storageQuota.ts` provides:

- `estimateStorageUsage()` — wraps `navigator.storage.estimate()`, returning
  `null` (never a fabricated zero) when the API is unavailable, so callers
  can distinguish "no storage pressure" from "unknown."
- `requestPersistentStorage()` / `isStoragePersisted()` — wraps
  `navigator.storage.persist()`/`.persisted()`. The Offline Status bar calls
  this and offers a one-tap "ป้องกันข้อมูลถูกลบอัตโนมัติ" (prevent
  automatic data loss) button whenever persistence hasn't already been
  granted.
- `classifyStorageRisk(usageRatio)` — `ok` below 80%, `warning` from 80%,
  `critical` from 95%. The Offline Status bar surfaces a warning pill with
  current usage/quota once the ratio crosses `warning`.
- `isQuotaExceededError(error)` — a name-based check (not `instanceof`, so it
  matches both a real `DOMException` and any IndexedDB implementation that
  raises a plain error with the same `name`), used by
  `appBackupRestore.ts` to turn a raw browser exception into a clear,
  actionable message rather than an opaque failure.

## What happens on QuotaExceededError during restore

`applyAppBackupRestore` wraps its IndexedDB-writing phase (`restoreAllStores`
+ `putAllRecords` for portfolio files) in a try/catch. On a quota error, it
throws `AppBackupRestoreError` with a message that:

1. States plainly that storage ran out.
2. Notes that nothing already present was deleted — restore is upsert-only,
   so a partial write leaves the database incomplete, never corrupted.
3. Names the Safety Backup's history ID, since that Safety Backup (always
   taken before any restore write begins) is the user's actual recovery
   path back to their pre-restore state.

Verified by test (`appBackupRestore.test.ts`): a mocked quota failure mid-restore
still leaves pre-existing records intact and the Safety Backup recorded in
history.

## The user-controlled cleanup tool

`StorageCleanupPanel` (reachable from the Offline Status bar's
"🧹 ล้างพื้นที่จัดเก็บ" button) is deliberately narrow: it only prunes
**non-safety, successful Backup History entries** down to a retention count
the user picks (5/10/20) — the same logic Auto Backup's own retention
setting already uses (`pruneBackupHistory`). It never touches portfolio
projects or assets. This matches the brief's "never delete projects
automatically" rule literally: the tool only ever acts on a user's explicit
button press, and only on backup-history copies, never on primary data.

## Auto Backup — an honest, per-platform description

`autoBackupSettings.ts` supports cadences (`everyLaunch` / `daily` /
`weekly` / `monthly`) plus an optional "on exit" trigger, evaluated by
`isAutoBackupDue()` whenever the app is actually open and running.

- **On Windows desktop** (Electron), this can reasonably be described as
  "automatic" in the sense a user experiences it, since the app process can
  run for long sessions and the OS doesn't aggressively suspend it.
- **On iPad (PWA)**, iPadOS gives web apps no guarantee of background
  execution — there is no way to run a backup while the app isn't the
  active foreground app. What Auto Backup on iPad actually is: a
  **checkpoint that runs during active use** (checked against the last
  successful auto-backup time whenever the app is opened or brought to the
  foreground), not a true unattended background job. This is stated
  explicitly in the Backup Manager's Auto Backup tab and in
  `docs/OFFLINE_LIMITATIONS.md`, rather than implied to work like a
  server-side scheduled job.

## Why regular backups matter regardless of platform

Both platforms have a real, if different, path to data loss: iPadOS can
evict Safari site storage under pressure; a Windows profile could be reset
or reinstalled; a device can simply be lost or damaged. `.vspsb` backups
(see `docs/BACKUP_SYSTEM.md`, `docs/DATA_TRANSFER_PC_IPAD.md`) are the one
mechanism that survives all of these, since the file itself — not just the
in-place database — is portable off the device. The Offline Status bar's
storage-warning pill and the Backup Manager's own UI both recommend backing
up before the situation becomes urgent, not only after a warning appears.
