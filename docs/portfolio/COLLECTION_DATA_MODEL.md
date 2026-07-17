# Collection Data Model — Portfolio Manager P2 Stage 1

Source of truth: `app/src/catalog/domain/collection.ts`. Companion to
`docs/portfolio/PORTFOLIO_MANAGER_DATA_MODEL.md` (P1's `PortfolioAsset`
model, unchanged by Stage 1 except that its already-reserved
`collectionIds` field is now actually populated).

## `Collection`

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | `COL-YYYYMMDD-XXXXXX`, see `domain/id.ts`'s `generateCollectionId`. Immutable after creation (Rule 2) — no operation changes it. |
| `name` | `string` | User-editable, trimmed + whitespace-collapsed, max `COLLECTION_NAME_MAX_LENGTH` (120) chars. Cannot be empty/whitespace-only (Rule 1). |
| `normalizedName` | `string` | Lowercased, whitespace-collapsed form of `name` — the case-insensitive duplicate-detection/search key. Not a URL slug (this app has no per-collection routes). |
| `description` | `string` | Freeform, trimmed, truncated to `COLLECTION_DESCRIPTION_MAX_LENGTH` (2000) chars. Defaults to `''`. |
| `coverAssetId` | `string \| null` | `assetId` of the asset used as this collection's thumbnail, or `null`. Must reference an existing asset or be `null` (Rule 12) — validated synchronously at write time by `collectionService.setCollectionCoverAsset`/`createCollectionService`; drift after the referenced asset is later deleted (Rule 13) is caught and repaired by `validateCollectionIntegrity`/`repairCoverAssetIntegrity`. |
| `isArchived` | `boolean` | Orthogonal to deletion — same "archive separate from deletion" convention `PortfolioAsset.isArchived` already established in P1. |
| `archivedAt` | `number \| null` | Set when `isArchived` becomes `true`, cleared on unarchive. |
| `schemaVersion` | `number` | Currently `COLLECTION_SCHEMA_VERSION = 1`. Independent of `PORTFOLIO_ASSET_SCHEMA_VERSION` and of `storage/db.ts`'s `DB_VERSION` — same three-tier versioning convention P1 established (record shape / other record shape / database schema, each versioned separately). |
| `createdAt` | `number` | Set once at creation; injectable via `CreateCollectionInput.now` for deterministic tests, mirroring `generateAssetId`'s `now: Date` parameter pattern. |
| `updatedAt` | `number` | Bumped on every mutation (`renameCollection`, `updateCollectionDescription`, `archiveCollection`, `unarchiveCollection`, `setCollectionCoverAsset`, and every membership change that touches an asset also bumps *that asset's* `updatedAt`, not the collection's — a collection's `updatedAt` reflects changes to the collection record itself). |

No `PortfolioAsset` field changes — `collectionIds: string[]` was already
part of the P1 shape and needed no schema bump.

## Membership: `PortfolioAsset.collectionIds`

Many-to-many, stored entirely on the asset side (see
`docs/architecture/ADR-005-collection-relationship.md` for the full
reasoning). No join table, no new field. Invariants enforced by
`domain/collectionMembership.ts` + `services/collectionService.ts`:

- **No duplicates** (Rule 4) — `addCollectionMembership` is a no-op
  (returns the same array reference) if the ID is already present.
- **Order** — first-seen/insertion order, not sorted; not semantically
  meaningful (membership is a set, not a sequence).
- **Referential integrity is eventually-consistent, not enforced at
  write time** for the "collection was deleted out from under an asset"
  direction — `deleteCollectionSafely` proactively cleans up every
  affected asset in the same transaction as the delete, so this
  situation should not normally occur; `validateCollectionIntegrity`
  exists to detect and `repairOrphanedCollectionIds` to fix it if it
  ever does (e.g. a record written by a future direct-repository call
  that bypasses the service layer).

## Database (`storage/db.ts`)

`DB_VERSION`: **4 → 5**.

New object store: **`collections`**
- `keyPath: 'id'`
- Index `normalizedName` (`unique: false` — duplicate-name enforcement is
  a service-level check, not an IndexedDB constraint; see ADR-005's
  "Alternatives considered")
- Index `isArchived` (`unique: false`) — reserved for a future Stage 2
  UI filter; Stage 1's own `loadCollections()`/`searchCollectionsByName`
  do an in-memory filter instead, since the collection count target
  (~100) doesn't need an indexed query to stay fast (measured: `loadCollections()`
  over 100 records completes in ~1ms — see
  `docs/portfolio/P2_STAGE1_PERFORMANCE.md`).

No existing store's `keyPath`/indexes changed. No data migration
transform is applied to existing rows — `portfolioAssets` records already
have a `collectionIds` array (defaulting to `[]` via
`normalizePortfolioAsset`), so the v4 → v5 upgrade only needs to *add* the
new store, never touch existing rows. See `storage/db.migration.test.ts`.

## Schema versioning summary (three independent version numbers, all documented in the codebase)

| Version | Constant | Current value | Governs |
|---|---|---|---|
| Database schema | `storage/db.ts`'s `DB_VERSION` | 5 | Which object stores/indexes exist |
| `PortfolioAsset` record shape | `domain/types.ts`'s `PORTFOLIO_ASSET_SCHEMA_VERSION` | 1 (unchanged) | Migration branches in `normalizePortfolioAsset` |
| `Collection` record shape | `domain/collection.ts`'s `COLLECTION_SCHEMA_VERSION` | 1 (new) | Migration branches in `normalizeCollection` |
