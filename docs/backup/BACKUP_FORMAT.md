# Backup Archive Format — Portfolio Manager P3

Defines the exact shape produced by `app/src/catalog/backup/backupFormat.ts`
and `backupBuilder.ts`. A backup archive is a single JSON document — not a
ZIP (see `BACKUP_ARCHITECTURE.md`'s "Why a single JSON envelope" section).

## Top-level shape (`BackupArchive`)

```jsonc
{
  "format": "vsp-collection-backup",     // fixed literal, identifies the file type
  "schemaVersion": 1,                    // BACKUP_SCHEMA_VERSION at write time
  "applicationVersion": "vector-stock-pattern-studio-portfolio-manager",
  "generatorVersion": "1.0.0",           // BACKUP_GENERATOR_VERSION at write time
  "createdAt": 1768723200000,            // Date.now() when the archive was built
  "stats": {                             // declared counts — cross-checked against
    "collectionCount": 12,               // the real payload by backupValidation.ts
    "assetCount": 340,
    "membershipCount": 512
  },
  "metadata": {
    "dbVersion": 5,                      // storage/db.ts DB_VERSION at write time
    "collectionApiVersion": "portfolio-collections-v1.0.0",
    "label": "Before bulk cleanup"       // optional, user-supplied
  },
  "checksum": "<sha256 hex>",            // of the DECOMPRESSED payload's canonical JSON
  "payloadEncoding": "gzip+base64",
  "payload": "<base64 string>"           // gzip-compressed JSON.stringify(BackupPayload)
}
```

Everything above `payload` is plain, uncompressed JSON — readable and
partially validatable (format id, schema version, declared stats) without
decompressing anything.

## Payload shape (`BackupPayload`, inside the compressed `payload` field)

```jsonc
{
  "collections": [ /* full Collection[] records, unchanged shape from domain/collection.ts */ ],
  "memberships": [
    { "assetId": "asset-123", "collectionIds": ["col-a", "col-b"] }
    // one entry per asset that belongs to at least one collection —
    // an asset with collectionIds: [] is omitted entirely
  ],
  "settings": {}   // reserved, see "Reserved settings field" below
}
```

## What's included / excluded

**Included** (per the brief's "Backup Content" scope):

- Every `Collection` record (name, description, cover asset reference,
  archived state, timestamps) — the full domain object, not a summary.
- Every asset's collection membership (which collections it belongs to).
- Collection metadata (via the `Collection` record fields above).
- Preview references — indirectly, via `Collection.coverAssetId`, which
  is an asset ID reference, not the preview image itself (see "Not
  included" below for why the underlying asset/preview files are out of
  scope).
- Validation metadata — `stats`, `metadata`, and `checksum` together give
  `backupValidation.ts` everything it needs for a full pre-restore
  integrity pass with no other input.

**Not included** (explicitly, per the brief's "Do NOT include transient
cache" instruction and P3's scope boundary):

- Any transient/derived cache (in-memory indexes, computed thumbnails,
  etc.) — none of these are persisted anywhere in the app to begin with,
  so there is nothing to exclude in practice, but the principle holds:
  only durable Collection-subsystem state is captured.
- The portfolio asset **files** themselves (source files, previews,
  metadata blobs) — those are P1's `services/exportAsset.ts` ZIP export's
  concern, not this backup's. A membership entry referencing an asset
  that no longer exists at restore time is a detected, reported
  condition (`missing-live-asset`), not silently ignored.
- Application settings unrelated to collections (workspace layout, theme,
  etc. — `workbench/workspaceSettings.ts`'s own domain, already covered
  by that module's own export/import).

## `BackupStats` — fully self-verifying by design

All three fields are independently recomputable from the decompressed
payload alone, with no external state:

- `collectionCount` = `payload.collections.length`
- `assetCount` = `payload.memberships.length` (assets **represented in
  this backup** — i.e. with at least one membership — not the live
  catalog's total asset count, which this backup does not capture)
- `membershipCount` = sum of every membership entry's `collectionIds.length`

This is what lets `backupValidation.ts` catch a header that lies about
its own contents (`collection-count-mismatch`, `asset-count-mismatch`,
`membership-count-mismatch`) using only the archive itself.

## Checksum

SHA-256 hex digest of `JSON.stringify(payload)` (no extra whitespace —
the canonical form) computed on the **decompressed** payload, using the
same `computePayloadChecksum` function on both the write side
(`backupBuilder.ts`) and the verify side (`backupValidation.ts`). A
mismatch can only mean the payload bytes themselves changed after the
archive was built (corruption, truncation, tampering) — never a
formatting difference, since both sides always serialize the same way.

## Compression

`payload` is `JSON.stringify(BackupPayload)`, gzip-compressed via the
native `CompressionStream('gzip')` Web API, then base64-encoded via
`btoa` (chunked to avoid a stack-overflow risk on large arrays). No
external dependency. See `app/src/catalog/backup/backupCodec.ts`.

## Reserved settings field

`BackupPayload.settings` is `Record<string, never>` today — always an
empty object. No collection-specific application setting exists anywhere
in the app currently (checked: no `localStorage` key, no IndexedDB field,
no settings panel touches Collections specifically). The field exists so
a *future* setting (e.g. a default sort order for the Collections tab)
has a place to live without a schema version bump — see "Schema
evolution" below.

## Schema evolution

`BACKUP_SCHEMA_VERSION` (currently `1`) is bumped only when the *shape*
of `BackupArchive`/`BackupPayload` changes in a way future restore logic
needs to branch on — for example, a new required field on `Collection`,
or a structural change to how membership is represented.
`SUPPORTED_BACKUP_SCHEMA_VERSIONS` lists every schema version this
build's restore logic can read; an archive outside that list is refused
with a clear `unsupported-schema-version` validation issue rather than
attempting a best-effort read that could silently misinterpret the data.

Two other version fields are deliberately independent of the schema
version:

- `generatorVersion` — bumped when `backupBuilder.ts`'s generation logic
  changes (e.g. a bug fix to what gets included) without the archive
  *shape* changing. Informational; never gates a restore.
- `applicationVersion` — the app build that created the archive.
  Informational only.

Planned evolution path for a hypothetical schema version 2 (e.g. adding a
real `settings` payload): add the new field(s) as optional/defaulted on
read, bump `BACKUP_SCHEMA_VERSION`, add `2` to
`SUPPORTED_BACKUP_SCHEMA_VERSIONS`, and keep `1` in that list for as long
as restoring old archives should keep working — the version check exists
specifically so that decision is explicit and testable, not implicit.

## Type guard

`isBackupArchiveShape(value: unknown): value is BackupArchive` is the
cheapest, first check `backupValidation.ts` runs — confirms the value is
even shaped like a backup archive (right `format` literal, right field
types) before touching the checksum or attempting decompression. Catches
a completely wrong file (e.g. a random JSON export from a different tool)
immediately, with a clear `invalid-shape` issue.
