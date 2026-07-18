# Backup & Restore Architecture — Portfolio Manager P3

Companion to `docs/portfolio/COLLECTION_ARCHITECTURE.md` (P2 Stage 1) and
`docs/portfolio/COLLECTION_API_FREEZE.md` (P2.5 Sprint 4). This document
covers only what P3 added — a Backup & Restore system for the Collection
subsystem (collections + membership). It builds entirely on top of the
frozen Collection API and never modifies it.

## What this is

A complete, self-contained backup and restore system for a user's
Collections and asset-to-collection memberships: build a portable archive
of the current state, validate an archive's integrity before touching
anything, preview what a restore would do, and restore it (overwrite or
merge). Service-layer only — **no UI** — mirroring P2 Stage 1's own
foundation-first precedent (`docs/portfolio/COLLECTION_ARCHITECTURE.md`:
"delivers the domain model, persistence, and business-logic layer
only — no UI").

## Layer map

```
app/src/catalog/backup/
  backupFormat.ts          Archive/payload/stats/metadata types + shape guard
  backupCodec.ts            gzip+base64 compression, checksum
  backupBuilder.ts          Full backup (read-only snapshot)
  backupValidation.ts       Pre-restore validation report (never throws)
  restoreService.ts         Preview + restore (overwrite/merge), plan engine
  backupHistoryStore.ts     localStorage-backed backup/restore activity log
  backupExportImport.ts     Download/pick-file glue (Blob <-> File)
```

No `ui/` additions. All read/write access to Collection state goes
through the already-certified, frozen functions documented in
`docs/portfolio/COLLECTION_API_FREEZE.md`:

- `loadCollections`, `putCollectionRecordsBulk` (`storage/collectionStore.ts`)
- `loadPortfolioAssets`, `putPortfolioAssetsBulk` (`storage/portfolioStore.ts`)

Nothing under `app/src/catalog/backup/` touches `storage/db.ts`'s raw
IndexedDB primitives, adds a new object store, or bumps `DB_VERSION`. The
one exception is a **read** of the `DB_VERSION` constant itself (recorded
into `BackupMetadata.dbVersion` for restore-time compatibility context) —
never a write, never a schema change.

## Why a single JSON envelope, not a ZIP

The app already has a hand-written ZIP **writer**
(`export/zip.ts`, used for portfolio asset export bundles) but no ZIP
*reader* — restore would need one. A Collection backup, unlike an asset
export, contains no binary files at all: every field (`Collection`
records, membership entries) is plain JSON. Given that, a ZIP would only
ever be used for the one thing it's good at — compression — and nothing
else it's designed for (a directory of heterogeneous binary files). The
Web Platform's native `CompressionStream`/`DecompressionStream('gzip')`
do that one job directly, with no new dependency and no hand-written
binary parser to get subtly wrong. See `BACKUP_FORMAT.md` for the exact
envelope shape.

## Request flow

```
UI action (future)                              P3 service layer (this phase)
"Back up my Collections"                  -->   backupBuilder.buildCollectionBackup()
                                                   -> loadCollections() + loadPortfolioAssets() (parallel, read-only)
                                                   -> build BackupPayload (collections + membership entries)
                                                   -> computePayloadChecksum(payload)
                                                   -> compressToBase64(JSON.stringify(payload))
                                                   -> assemble BackupArchive (header + compressed payload)
                                                 <- BackupArchive

"Download the backup"                     -->   backupExportImport.exportBackupArchiveFile(archive)
                                                   -> triggers a `.json` file download

"Pick a backup file to restore"           -->   backupExportImport.importBackupArchiveFile(file)
                                                 -> backupValidation.validateBackupArchive(parsed, {crossCheckLiveAssets:true})
                                                 <- BackupValidationReport (never throws)

"Preview what restoring would do"         -->   restoreService.previewRestore(archive, mode)
                                                   -> computeRestorePlan(archive, mode)   [same plan restore executes]
                                                 <- RestorePreview (read-only, zero writes — see RESTORE_WORKFLOW.md)

"Restore" (after reviewing the preview)   -->   restoreService.restoreBackup(archive, mode)
                                                   -> computeRestorePlan(archive, mode)   [recomputed fresh]
                                                   -> putCollectionRecordsBulk(...)        [one transaction]
                                                   -> putPortfolioAssetsBulk(...)          [one transaction]
                                                 <- RestoreResult
```

## Design principles carried over from the frozen Collection API

- **Read-only backup**: `buildCollectionBackup` takes no lock and holds
  no transaction open — it is a snapshot of whatever `loadCollections()`
  / `loadPortfolioAssets()` returned at the moment each resolved. See the
  "Consistency window" note below.
- **Never-throw validation**: `validateBackupArchive` always returns a
  `BackupValidationReport` object, even for a completely unrecognizable
  input (`undefined`, a random JSON document, a corrupted file) — every
  failure mode is a reported `issue`, not an exception a caller must
  remember to catch.
- **Preview/restore share one plan**: `previewRestore` and `restoreBackup`
  both call the same internal `computeRestorePlan` — a preview can never
  show something restore then does differently. See `RESTORE_WORKFLOW.md`.
- **Idempotent, self-healing restore**: the plan is always recomputed
  fresh against current live state, never against a stored intent — so
  restoring twice, or restoring after an interruption between the two
  bulk-write phases, converges to the same correct end state. See
  `RESTORE_WORKFLOW.md`'s "Interrupted restore" section.
- **Frozen-API-only writes**: `restoreBackup` inherits
  `putCollectionRecordsBulk`/`putPortfolioAssetsBulk`'s existing
  all-or-nothing-per-call transaction guarantee (P2.5 Sprint 3's
  atomicity fix) without needing to re-implement any transaction safety
  itself.

## Consistency window (honest caveat)

`buildCollectionBackup` reads collections and assets with two separate,
concurrent calls (`Promise.all`). If a write happens on the live database
between those two reads resolving, the archive could in principle capture
a collection created after the asset snapshot was taken (or vice versa).
This is the same class of caveat P1's own export tooling accepts for
"read while writing" scenarios, and is not a durability defect: the
archive is still fully self-consistent by construction — `backupValidation.ts`'s
count/duplicate/orphan checks operate purely on the payload as captured,
and a `missing-live-asset` cross-check at restore time is the intended
safety net for anything that changed in between.

## Explicitly out of scope for P3

- Any UI component, view, or button (service-layer only, same "no UI
  yet" scoping P2 Stage 1 used).
- Any modification to the frozen Collection API
  (`docs/portfolio/COLLECTION_API_FREEZE.md`) — none was needed; no
  production defect was found or claimed.
- Backing up portfolio asset *files* themselves (previews, source files)
  — P3 backs up Collection membership and metadata only, per the brief's
  "Backup Content" scope. Full asset-file backup remains P1's existing
  ZIP export (`services/exportAsset.ts`).
- Automatic/scheduled backups, cloud sync, or cross-device transfer —
  export/import is a manual, local file operation only.
- Commercial Workflow, Marketplace — explicitly deferred past this
  phase.
