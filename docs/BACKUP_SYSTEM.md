# Application Backup System (`.vspsb`)

`app/src/backup/` — `zipArchive.ts`, `appBackupFormat.ts`,
`appBackupSettingsSnapshot.ts`, `appBackupIdb.ts`, `appBackupBuilder.ts`,
`appBackupValidation.ts`, `appBackupRestore.ts`, `appBackupHistoryStore.ts`,
`autoBackupSettings.ts`, `migrationCompatibility.ts` — plus the UI,
`app/src/components/backup/BackupManagerView.tsx`.

## Why a third backup subsystem

Two narrower backup subsystems already existed before this one, and
neither is replaced or duplicated by it:

1. **P3 "Collection" backup** (`catalog/backup/backupFormat.ts` /
   `backupBuilder.ts` / `restoreService.ts`) — covers only
   `{ collections, memberships, settings: {} }`. Reading its own builder
   source confirms it does **not** include `PortfolioAsset` records or
   the binary `PortfolioFiles` (the actual SVG/PNG/EPS artwork).
2. **Build 026 "Production" backup** (`catalog/backup/productionBackup.ts`,
   see `docs/BACKUP_AND_RESTORE.md`) — covers only its own 8 stores
   (submissions, sales events, rejections, quality snapshots, queue
   items, batches, import history, marketplace registrations).

**Neither system backs up the actual pattern artwork files.** That gap —
not a redundant third copy of the same idea — is what this system closes:
a single portable archive of *everything* the app persists, so a user can
move their whole working state (every design, every setting, every
production record) between a Windows PC, a laptop, an iPad, an external
SSD, or a USB drive.

This system, the Collection backup, and the Production backup are fully
independent and can be restored in any order — none of them reads or
writes data another one owns.

## What's covered

- **Every IndexedDB store** listed in `APP_BACKUP_STORE_NAMES`
  (`appBackupFormat.ts`): `saved`, `projects`, `assets`,
  `portfolioAssets`, `collections`, `submissions`, `qualitySnapshots`,
  `salesEvents`, `rejectionRecords`, `productionQueueItems`,
  `productionBatches`, `importHistory`, `marketplaceRegistrations`,
  `researchSources`, `marketObservations`, `marketSnapshots`,
  `marketKeywords`, `seasonalEvents`, `scoringProfiles`,
  `marketOpportunities`, `dailyMissions` (Build 028 Marketing
  Intelligence), and `designBriefs`, `designConfigurations`,
  `collectionPlans` (Build 028B AI Creative Director). `designStrategies`,
  `marketingDesignHandoffs`, `commercialFeedbackSignals`, and
  `recommendationHistory` are pre-provisioned in `storage/db.ts`'s schema
  but stay unregistered here until a store module actually writes to them
  — see `appBackupFormat.ts`'s own comment for this list's "register only
  once real data exists" convention. `appBackupHistory` (the backup
  history store, holding this system's own past archives) is
  deliberately never included — backing it up inside itself would be
  self-referential and would bloat every future backup with copies of
  prior backups.
- **Every portfolio source file's actual bytes** (`portfolioFiles` —
  SVG/PNG/EPS/AI/etc.), captured as individual `assets/<fileId>__<name>`
  archive entries rather than JSON, since Blobs don't serialize into
  `database.json`. This is the gap neither prior system closed.
- **Every localStorage setting/preset** listed in
  `APP_BACKUP_SETTINGS_KEYS`: Style DNA presets/favorites, workbench
  settings/favorites, asset favorites, the saved-pattern gallery,
  knowledge-engine learning history, and the Auto Backup settings
  themselves. Deliberately excludes IndexedDB-unavailable-only
  localStorage fallback keys (already covered by the IndexedDB stores
  above) and the stale pre-Build-026 submission-center cache (fully
  migrated into the `submissions` store already).

## Archive format

A `.vspsb` file is a genuine, standard ZIP archive — openable by
Windows Explorer, macOS Archive Utility, 7-Zip, or `unzip` if its
extension is changed to `.zip` (verified during development against the
system `unzip`/`zipinfo` tools, not just this app's own reader). Every
entry name is a relative, forward-slash path — no absolute paths appear
anywhere, so the archive is byte-identical regardless of which
machine/OS/drive it was built or restored on.

```
manifest.json           this file's shape — see below
checksums.sha256        one line per content file: "<sha256>  <path>"
database.json           every generic store's records, as plain JSON,
                         keyed by store name (AppBackupDatabaseDump)
assets/<fileId>__<name> every PortfolioFileRecord's binary bytes
settings/<key>.json     one file per backed-up localStorage key
```

`portfolioFiles` is deliberately **not** part of `database.json` — its
records contain a Blob field, which JSON can't represent — it's captured
as its own binary archive entries instead, with the metadata needed to
reconstruct each `PortfolioFileRecord` (role, filename, mimeType,
fileSize, sha256, storedAt) living in the manifest's `assets[]` array.

### Manifest (`manifest.json`)

```ts
interface AppBackupManifest {
  format: 'vsp-app-backup';
  schemaVersion: number;          // this archive format's own version
  applicationVersion: string;     // fixed app-identity label
  appVersionLabel?: string;       // e.g. "v1.80" — docs/USER_GUIDE.md's
                                   // Application Version at build time
  generatorVersion: string;
  backupId: string;               // crypto.randomUUID()
  createdAt: number;
  stats: {
    storeRecordCounts: Record<string, number>;
    assetFileCount: number;
    settingsKeyCount: number;
    fileCount: number;            // content entries + manifest itself
    originalSize: number;         // content only — see note below
    compressedSize: number;       // content only — see note below
  };
  metadata: {
    dbVersion: number;            // storage/db.ts's DB_VERSION at build time
    deviceLabel: string;          // user-editable, or a UA-derived default
    userAgent: string;
    platform: string;
    label?: string;
  };
  assets: AppBackupAssetEntry[];  // one per portfolioFiles record
  settingsKeys: string[];
  archiveChecksum: string;        // sha256 of checksums.sha256's content
}
```

**Why `originalSize`/`compressedSize` describe content, not the whole
archive:** a file cannot know its own final compressed size before it is
compressed, and manifest.json's bytes must exist (to be compressed and
appended) before the archive is complete. Rather than pay the cost of
compressing every asset file *twice* just so a metadata field could
include its own few-hundred-byte contribution, these two stats cover
everything except `manifest.json` itself — negligible for any real
backup. `AppBackupBuildResult.blob.size` (the actual archive file size)
is always available separately and is what the Backup Manager UI shows.

This is made possible without re-compressing large content by splitting
`zipArchive.ts`'s ZIP writer into two steps: `compressZipEntry()`
(compress one entry, independent of every other) and `assembleZip()`
(pure header/central-directory framing, no compression). `appBackupBuilder.ts`
compresses every content entry once, reads back their exact compressed
sizes to build an accurate manifest, *then* assembles the final archive
— `manifest.json` is compressed exactly once too, just last.

### Checksums

Every content file gets a SHA-256 line in `checksums.sha256`
(`<hash>  <path>`, mirroring the standard `sha256sum` output format).
`manifest.json`'s own `archiveChecksum` is the SHA-256 of
`checksums.sha256`'s content — the single "whole archive" checksum,
verified first (cheapest, catches most corruption) before per-file
checksums are individually re-checked. `catalog/domain/hash.ts`'s
existing `sha256Hex`/`sha256HexOfFile` (Web Crypto `crypto.subtle`, no
dependency added) is the only hashing primitive used anywhere in this
system.

### Compression

Real DEFLATE per entry (`CompressionStream('deflate-raw')`/
`DecompressionStream('deflate-raw')` — the same Web Streams approach
`catalog/backup/backupCodec.ts` already established for gzip, just a
different, ZIP-native compression format). An entry falls back to STORE
(uncompressed) only if DEFLATE didn't actually shrink it — this can
happen for already-compressed formats like PNG/EPS, where storing the
larger DEFLATE result would be strictly worse than the original bytes.

## Verify Backup

`validateAppBackupArchive(blob)` — read-only, never writes anything —
checks, cheapest first: (1) the file is a well-formed ZIP; (2) it has a
recognizable `manifest.json` matching `AppBackupManifest`'s shape; (3)
the declared `schemaVersion` is supported; (4) `archiveChecksum` matches
the actual `checksums.sha256` content; (5) every individual file listed
in `checksums.sha256` matches its actual archived bytes. Returns a
verdict:

- **PASS** — no issues at all.
- **WARNING** — restorable, but flagged (currently: the backup is from a
  *newer* app database version than the one restoring it — see
  Migration Compatibility below).
- **FAIL** — corrupted, tampered, unrecognized, or an unsupported schema
  version. `appBackupRestore.ts` refuses to write anything on FAIL.

Exposed standalone from the Backup Manager's "ตรวจสอบไฟล์สำรอง" tab, and
internally by every restore (never skipped, never trusted from a
caller-supplied "already validated" flag — the file on disk could have
changed between preview and confirm).

## Restore

Two-step API, matching the brief's "never immediately overwrite" rule:

1. **`previewAppBackupRestore(blob)`** — runs full validation, reports
   whether restore is even possible (`canRestore`), with the
   compatibility classification for the UI to show before the user
   confirms anything.
2. **`applyAppBackupRestore(blob, options)`** — re-validates
   independently (defensive: never trusts step 1's result was still
   accurate), then:
   - **Always** builds a Safety Backup of the *current* database first
     — via `buildAppBackup()` itself — and records it in Backup History
     with `trigger: 'safety'`, before a single record is written. If the
     Safety Backup itself fails to build, the restore aborts entirely
     and nothing changes.
   - Restores every generic store via **upsert** (`putAllRecords` — each
     record's own keyPath decides create-vs-overwrite), matching
     `productionBackup.ts`'s established "plain upsert" restore model.
     Nothing already in the database that isn't in the backup is ever
     deleted.
   - Reconstructs every `PortfolioFileRecord` from the manifest's
     `assets[]` metadata plus the matching `assets/` archive entry's
     bytes, and upserts them into `portfolioFiles`.
   - Restores every localStorage key present in the archive
     (`applySettingsSnapshot`) — again additive/overwrite-only, never
     removing a key the archive doesn't mention (it might belong to a
     feature added after the backup was taken).

Restore never deletes existing data — it is add-and-overwrite only, with
a mandatory pre-restore safety net.

## Migration Compatibility

`migrationCompatibility.ts`'s `classifyBackupCompatibility(backupDbVersion,
currentDbVersion)` compares the backup's recorded IndexedDB schema
version against the current app's `storage/db.ts` `DB_VERSION`:

- **`same`** — no special handling.
- **`olderBackup`** — restores normally. `storage/db.ts`'s
  `onupgradeneeded` handler is already additive-only and idempotent
  (every store creation is `contains()`-guarded), so an older backup's
  stores always already exist in a newer database — there is no separate
  "migration" step beyond the upsert restore already performs.
- **`newerBackup`** — a WARNING, not a FAIL: restoring a backup taken by
  a newer app version *could* lose data that only that newer version
  understood, so the UI surfaces this explicitly rather than silently
  proceeding, but does not block the user (they may still want it).

There is no real SQLite involved anywhere — this app persists via
IndexedDB (`storage/db.ts`), not SQLite; `database.json`'s per-store
JSON dump is the honest replacement for the brief's generic
"database.sqlite" expectation.

## Auto Backup

`autoBackupSettings.ts` stores user preferences (frequency, backup-on-exit,
retention) under its own localStorage key, itself included in every
backup (so preferences travel with the archive). `isAutoBackupDue(settings,
now)` is a pure cadence function — `off` never triggers, `everyLaunch`
always triggers when checked, and `daily`/`weekly`/`monthly` compare
elapsed time against `lastAutoBackupAt`. "Before restore" and "before
migration" triggers from the original brief are **not** configurable
here — `applyAppBackupRestore` unconditionally takes a Safety Backup
before every restore, so there is nothing to toggle for that case.
"Before application update" has no real hook in a browser-hosted SPA
with no update-lifecycle event to listen to, and is intentionally not
implemented as a fabricated no-op.

## Backup History

`appBackupHistoryStore.ts` — a new IndexedDB store (`appBackupHistory`,
`storage/db.ts` `DB_VERSION` 6→7, additive-only) holding one record per
backup ever created *or* taken as a pre-restore safety net, **including
the archive's own Blob** — so "Restore from history" in the UI works
directly without the user re-locating the original file.
`pruneBackupHistory(retention)` deletes the oldest successful
`manual`/`auto` records beyond the configured limit (5/10/20/Unlimited);
`safety`-trigger and failed-attempt records are never auto-pruned, since
the user didn't choose to create them and may still need them.

## Portability and honest brief adaptations

- **No absolute paths anywhere** in the archive — confirmed by the ZIP
  format itself (relative entry names only) and by the format being
  built/restored identically regardless of OS.
- **iPad** — no native filesystem API exists in a browser; "iPad
  compatibility" here means the ordinary browser download flow (the
  `.vspsb` file lands wherever iOS Safari puts downloads, from which
  Files/iCloud Drive/AirDrop/a cloud drive app can move it anywhere —
  the same flow every other file this app already produces uses).
- **"Open folder" action** — not implemented; a web page cannot open the
  host OS's file manager. The Backup History table offers Restore/
  Download/Delete instead.
- **Machine Name/OS** — a browser cannot report a real hostname or OS
  build (no such API is exposed to web pages by design).
  `metadata.deviceLabel`/`userAgent`/`platform` in the manifest are the
  honest closest equivalent: a user-editable label plus
  `navigator.userAgent`/`navigator.platform`, clearly informational only
  and never used to gate a restore decision.
- **"database.sqlite"** — see Migration Compatibility above;
  `database.json` is the accurate replacement for how this app actually
  persists data.

## Performance

Large-portfolio backups stream: `buildCompressedZip`/`compressZipEntry`
process and append one entry's bytes at a time rather than holding every
entry's compressed *and* original copy in memory simultaneously, so peak
memory stays roughly one entry's size above the final archive size, not
a multiple of the whole portfolio's size. `appBackupBuilder.test.ts`
includes a 50-asset build test as a scale check; the split
compress/assemble design (see the manifest-stats note above) means a
large asset library's binary content is compressed exactly once per
backup, never twice.

## UI

`components/backup/BackupManagerView.tsx` — reachable from the top
project bar ("💾 Backup Manager"), five tabs matching the brief's
File-menu-style navigation: **สำรองข้อมูล** (Backup, with a live
Preparing/Compressing/Verifying/Completed progress bar and % complete),
**กู้คืนข้อมูล** (Restore, preview-then-confirm), **สำรองอัตโนมัติ** (Auto
Backup settings), **ประวัติการสำรอง** (Backup History, with
Restore/Download/Delete per row), **ตรวจสอบไฟล์สำรอง** (standalone Verify
Backup). This is the first UI for a full-application backup in this
repo — distinct from, and does not replace, `App.tsx`'s existing
"library-backup.json" saved-pattern flow or `ProductionCenterView.tsx`'s
narrower "สำรอง/กู้คืน" tab for the 8 Build 026 stores.

## Tests

`app/src/backup/*.test.ts` (92 tests across 9 files) cover: ZIP
round-trip/compression/corruption detection (`zipArchive.test.ts`);
settings snapshot capture/restore (`appBackupSettingsSnapshot.test.ts`);
auto-backup cadence and retention logic (`autoBackupSettings.test.ts`);
version compatibility classification (`migrationCompatibility.test.ts`);
generic IndexedDB dump/restore (`appBackupIdb.test.ts`); backup history
CRUD and retention pruning (`appBackupHistoryStore.test.ts`); full
backup builds including portfolio asset coverage, settings coverage,
manifest-stats consistency, and a 50-asset scale test
(`appBackupBuilder.test.ts`); validation covering PASS/WARNING/FAIL,
corrupted archives, missing files, wrong checksums, unsupported schema
versions, and older/newer database versions (`appBackupValidation.test.ts`);
and the full restore lifecycle — happy path, upsert-only semantics,
mandatory Safety Backup creation, refusal to write on validation
failure, older/newer-version restores, and a 30-asset restore
(`appBackupRestore.test.ts`).
