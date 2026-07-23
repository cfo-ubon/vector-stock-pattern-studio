# Production Backup & Restore — Build 026

`app/src/catalog/backup/productionBackup.ts`

## Why a second, separate backup subsystem

Build 026 does **not** extend the existing Collection-subsystem backup
(`backupFormat.ts` / `backupBuilder.ts` / `restoreService.ts`, from P3).
That subsystem's own doc comments describe it explicitly as reading
"only through the frozen Collection API" and covering "the Collection
subsystem," with a bespoke field-by-field diff/conflict/merge engine
built specifically around Collections and asset membership.

The 8 new Build 026 stores (submissions, sales events, rejection
records, quality snapshots, queue items, batches, import history,
marketplace registrations) are unrelated data with no
membership/conflict-field model of their own — every one is a flat,
keyPath-addressed record. Their backup/restore is deliberately simpler: a
full snapshot of all 8 stores, and a restore that's a plain **upsert**
(each record's own primary key decides create-vs-overwrite) rather than
a Collection-style diff-and-choose.

This module never reads or writes anything the Collection backup already
owns (`Collection`, `PortfolioAsset`), and the Collection backup never
reads or writes anything this module owns — **the two subsystems are
fully independent and can be restored in either order.**

## What's covered

`ProductionBackupPayload` — one field per store:

```ts
interface ProductionBackupPayload {
  submissions: SubmissionRecord[];
  salesEvents: SalesEvent[];
  rejectionRecords: RejectionRecord[];
  qualitySnapshots: QualitySnapshot[];
  queueItems: ProductionQueueItem[];
  batches: ProductionBatch[];
  importHistory: ImportHistoryRecord[];
  marketplaceRegistrations: MarketplaceRegistration[];
}
```

## Archive format

Reuses `backupCodec.ts`'s existing, unmodified codec functions
(`compressToBase64` / `decompressFromBase64` / `computePayloadChecksum`)
— no new compression or checksum logic was written. An archive is:

```ts
interface ProductionBackupArchive {
  format: 'vsp-production-backup';
  schemaVersion: number;         // currently 1
  applicationVersion: string;
  generatorVersion: string;
  createdAt: number;
  dbVersion: number;             // storage/db.ts's DB_VERSION at build time
  stats: ProductionBackupStats;  // per-store counts, for a human-readable summary
  checksum: string;
  payloadEncoding: 'gzip+base64';
  payload: string;               // compressed JSON of ProductionBackupPayload
  label?: string;
}
```

## Validation

`validateProductionBackupArchive(value)` runs the two cheapest,
always-run checks `backupValidation.ts` also runs first: shape, then
checksum. It deliberately does not attempt the Collection backup's
richer live cross-checks (e.g. "does this asset still exist") — these 8
domains have no equivalent question to ask, since they don't reference
`PortfolioAsset` rows by IndexedDB key.

## Restore is all-or-nothing

`restoreProductionBackup(archive)` refuses to write anything if the
archive fails validation — a broken archive must never partially apply,
matching `restoreService.ts`'s own rule for the Collection backup. On a
valid archive, every one of the 8 stores is upserted from the payload;
the function returns a per-store restored-count summary
(`RestoreProductionBackupResult`).

## What a user does with this

Both directions are exposed from the Production Center UI's "สำรอง/กู้คืน"
(Backup/Restore) tab (see `docs/PRODUCTION_PORTFOLIO.md`) — download an
archive as a JSON file, or select one to restore. Nothing here requires
network access; the entire backup/restore cycle works fully offline.
