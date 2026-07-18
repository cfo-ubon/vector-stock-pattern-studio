# Portfolio Manager — Data Model (P1)

Source of truth: `app/src/catalog/domain/types.ts`. This document explains
the *why* behind each field/decision; read the source for the exact current
shape.

## `PortfolioAsset`

One catalog entry — a logical "design" that may be backed by several
physical source files (an SVG + a PNG preview + a JSON settings export, for
instance). Identity, metadata, and workflow state live on this record;
file *bytes* never do (see `PortfolioFileRecord` below).

| Field | Type | Notes |
|---|---|---|
| `assetId` | `string` | `VSP-YYYYMMDD-XXXXXX`, see "Asset identity" below. |
| `displayName` | `string` | User-editable; defaults to the import basename. |
| `originalFilename` | `string` | The first source file's original name, preserved as-imported. |
| `assetType` | `SourceFileRole` | The dominant *sellable* role among this asset's source files — `pickAssetType()` priority: `svg > eps > ai > png > jpg > json > preview > other`. |
| `createdAt` | `number` | When the underlying design was created, if recoverable from imported JSON (`jsonCompat.ts`); falls back to `importedAt`. |
| `importedAt` | `number` | When this asset entered the catalog. Never changes after creation. |
| `updatedAt` | `number` | Bumped on any metadata edit. |
| `generatorVersion` | `string \| null` | From imported JSON metadata, if present. |
| `schemaVersion` | `number` | Currently `1` (`PORTFOLIO_ASSET_SCHEMA_VERSION`). See "Schema versioning" below. |
| `styleDna` / `presetId` / `compositionType` / `patternType` | `string \| null` | Extracted from imported JSON when recognizable (`jsonCompat.ts`); otherwise `null`, never guessed. |
| `generatorSeed` | `string \| null` | The generator's own RNG seed if recoverable — the strongest "possible duplicate" signal independent of file bytes (see `import/duplicates.ts`). |
| `productTargets` | `string[]` | From imported JSON. |
| `collectionIds` | `string[]` | Reserved for a later sprint (P1 has no collection-linking UI); always `[]` today. |
| `tags` | `string[]` | User-editable, freeform. |
| `rating` | `number` | `0` = unrated, else `1`–`5`. |
| `workflowStatus` | `WorkflowStatus` | See below. |
| `isArchived` / `archivedAt` / `archiveReason` | `boolean` / `number \| null` / `string \| null` | Orthogonal to `workflowStatus` — see "Archiving vs workflow" below. |
| `previewReference` | `string \| null` | `fileId` of the file used as this asset's thumbnail/preview source, chosen by `import/previewSelection.ts`'s priority order. |
| `sourceFileReferences` | `SourceFileReference[]` | Every physically-stored source file's pointer + cheap metadata (role, filename, mimeType, fileSize, sha256) — *not* the Blob body. |
| `metadataReference` | `string \| null` | `fileId` of the raw source JSON, if one was imported. |
| `sourceHashes` | `string[]` | Denormalized `sourceFileReferences[].sha256` — fast duplicate/health-check queries without touching Blob bodies. |
| `fileSizes` | `Record<string, number>` | Denormalized `fileId -> fileSize` map, same rationale. |
| `dimensions` | `{ width, height } \| null` | Reserved; P1's import pipeline does not parse SVG viewBox/PNG headers to populate this automatically (see Known Limitations in the P1 build report). |
| `colorPalette` | `string[]` | From imported JSON. |
| `notes` | `string` | User-editable freeform text. |
| `parentAssetId` / `variationGroupId` | `string \| null` | Set when an asset was explicitly imported "as new" over a possible-duplicate warning, or grouped as a deliberate variation. |

## `SourceFileReference` (embedded in `PortfolioAsset.sourceFileReferences`)

```ts
interface SourceFileReference {
  fileId: string;
  role: SourceFileRole;     // 'preview' | 'svg' | 'json' | 'eps' | 'ai' | 'png' | 'jpg' | 'other'
  filename: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
}
```

A pointer + the metadata cheap enough to keep inline for list/search/
health-check queries. The actual bytes live in a separate object store
(`PortfolioFileRecord`, below) precisely so that loading/searching/
filtering the whole catalog never has to touch Blob bodies — `loadPortfolioAssets()`
only reads the `portfolioAssets` store.

## `PortfolioFileRecord` (separate object store: `portfolioFiles`)

```ts
interface PortfolioFileRecord {
  fileId: string;
  assetId: string;
  role: SourceFileRole;
  filename: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
  blob: Blob;       // the actual, unmodified file bytes
  storedAt: number;
}
```

`sha256`/`role`/`filename`/`fileSize` are duplicated here (not just on the
asset's `SourceFileReference`) so this store is self-describing — orphan-
file detection (`services/healthCheck.ts`) and duplicate-hash lookup
(`findFilesByHash`) never need to join back to `portfolioAssets`.

## Asset identity: `VSP-YYYYMMDD-XXXXXX`

`domain/id.ts`'s `generateAssetId()`. Date-stamped for human scanability in
exported filenames and ZIP manifests, with a 6-character base36 random
suffix (~2.1 billion possible values per day) to avoid collisions within
the same import batch. This ID is **not** derived from file content —
collision-avoidance for *identity* is the random suffix; collision-
avoidance for *duplicate detection* is the separate SHA-256 content hash.
`isValidAssetId()` validates the format everywhere the UI accepts/displays
an ID (e.g. the ZIP export filename, the "copy Asset ID" action).

## Workflow status vs archiving — two orthogonal axes

```ts
type WorkflowStatus = 'DRAFT' | 'READY_FOR_REVIEW' | 'READY_TO_UPLOAD'
                     | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'NEEDS_REVISION';
```

`workflowStatus` never includes an `ARCHIVED` value — archiving is the
separate `isArchived` / `archivedAt` / `archiveReason` triple. This means an
asset can be simultaneously `REJECTED` **and** archived, or `APPROVED`
**and still active** (not yet archived), without the two concepts fighting
over one enum slot — a design constraint the sprint brief stated explicitly
("Do not use ARCHIVED as the ordinary workflow status"). The default
catalog filter (`archived: 'active'` in `PortfolioFilterQuery`) hides
archived assets regardless of their `workflowStatus`; the sidebar's
"เก็บถาวร" (archived) filter select switches between active-only/archived-
only/all.

## Schema versioning

`PORTFOLIO_ASSET_SCHEMA_VERSION = 1` today. When this shape changes in a
future sprint: bump the constant, and extend
`domain/asset.ts`'s `normalizePortfolioAsset()` with a migration branch for
the old shape — the same convention `project/projectManager.ts`'s
`normalizeProject()` already uses elsewhere in this app. `normalizePortfolioAsset()`
runs on every record loaded from storage (`loadPortfolioAssets`,
`getPortfolioAsset`), so a schema-version bump never crashes on old
records; it defensively fills in any field that might be missing on a
pre-migration record with `??` fallbacks. `services/healthCheck.ts`'s
`migrationStatus` field reports how many stored records are at the current
schema version vs. need migration, without performing the migration itself
(read-only, per "Do not silently repair destructive issues").

This is a record-shape version, deliberately independent from
`storage/db.ts`'s `DB_VERSION` (currently `4`), which versions the
IndexedDB *database schema* (which object stores/indexes exist) — a
`PortfolioAsset` schema bump does not require a new object store, so it
does not need a `DB_VERSION` bump.
