# Database Schema — Build 026 (DB_VERSION 6)

`app/src/storage/db.ts`

## One database, one shared version, one upgrade handler

All persistence in this app shares a single IndexedDB database
(`vsp-db`) and a single `DB_VERSION`. Every store owns its own
name/shape, but the one `IDBOpenDBRequest.onupgradeneeded` handler that's
allowed to create object stores lives in `db.ts` — adding a store is a
version bump plus one `createObjectStore` call, never a second competing
`indexedDB.open()` call that could race the first.

Every branch in `onupgradeneeded` is guarded by
`objectStoreNames.contains(...)`, so the same handler is correct whether
it's creating a brand-new database in one pass, or upgrading from any
prior version (only the missing stores get created) — re-running it
against an already-current database is a no-op, not a duplicate-store
error.

## Version history

| Version | Adds |
|---|---|
| v1 | `saved` |
| v2 (Project Studio Engine) | `projects` |
| v3 (Asset Ecosystem Engine) | `assets` |
| v4 (Portfolio Manager P1) | `portfolioAssets`, `portfolioFiles` |
| v5 (Portfolio Manager P2 Stage 1) | `collections` |
| **v6 (Build 026)** | 8 new stores — see below |

## The 8 Build 026 stores

| Store (constant) | keyPath | Indexes |
|---|---|---|
| `submissions` (`SUBMISSIONS_STORE`) | `submissionId` | `patternId`, `marketplaceId`, `status`, `productionAssetId` |
| `qualitySnapshots` (`QUALITY_SNAPSHOTS_STORE`) | `snapshotId` | `assetId`, `productionAssetId` |
| `salesEvents` (`SALES_EVENTS_STORE`) | `eventId` | `productionAssetId`, `marketplaceId` |
| `rejectionRecords` (`REJECTION_RECORDS_STORE`) | `rejectionId` | `submissionId`, `normalizedReason` |
| `productionQueueItems` (`PRODUCTION_QUEUE_STORE`) | `queueItemId` | `status`, `batchId` |
| `productionBatches` (`PRODUCTION_BATCHES_STORE`) | `batchId` | — |
| `importHistory` (`IMPORT_HISTORY_STORE`) | `importId` | `importedAt` |
| `marketplaceRegistrations` (`MARKETPLACE_REGISTRATIONS_STORE`) | `id` | — |

`qualitySnapshots` predates the store's *own* first use in this exact
form (the store was reserved ahead of this build) but is populated by
Build 026's quality-tracking flow; all 8 were created together in the
same v5→6 `onupgradeneeded` pass.

## `submissions`: the one store with a migration

Before Build 026, `submissionStore.ts` persisted `SubmissionRecord`s in a
single `localStorage` JSON blob — correct for Build 015's scope, but not
scalable to thousands of patterns × multiple marketplaces (confirmed as
a storage risk during this build's audit). The v5→6 upgrade creates the
new empty `submissions` IndexedDB store; it deliberately does **not**
read `localStorage` itself inside `onupgradeneeded` (a synchronous
IndexedDB schema upgrade must not depend on synchronous localStorage
access, which can itself throw under some storage policies). The
one-time migration that reads the old `localStorage` key and writes
every record into the new store runs in `submissionStore.ts`, the first
time it opens after the upgrade, with its own error handling — kept
separate from the schema upgrade rather than being a silent side effect
of `openDb()`.

The other 7 stores back entirely new Build 026 modules and have no prior
data to migrate.

## Compatibility guarantee

Every new field on an existing type (e.g. `SubmissionRecord`'s v2 fields,
`PortfolioAsset.productionAssetId`) is additive and defaulted in that
type's own `normalize*` function — a record written by an older build
version loads without error and without data loss. See
`app/src/storage/db.migration.test.ts` for the automated test coverage
of the v4→v6 upgrade path (fresh database creation, upgrade from a real
pre-existing v4 database, binary Blob preservation through the upgrade,
idempotent reopening).
