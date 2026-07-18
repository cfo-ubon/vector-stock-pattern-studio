# ADR-005: Asset<->Collection relationship — many-to-many via `PortfolioAsset.collectionIds`

## Status

Accepted — P2 Stage 1 (new decision, not retrospective).

## Context

P1 reserved a `collectionIds: string[]` field on `PortfolioAsset` but
never populated it (`createPortfolioAsset` always sets it to `[]`) or
built any collection concept. Stage 1's brief requires: a `Collection`
entity, many-to-many membership (one asset in multiple collections),
collection deletion that cleans up membership without deleting assets,
archive semantics that don't touch membership, orphan detection/repair,
and a `coverAssetId` integrity policy — while explicitly directing that
membership "should be stored through the existing `asset.collectionIds`
field unless repository evidence proves a different compatible design is
required," and prohibiting a parallel storage system.

## Decision

**Why many-to-many is required**: a stock-vector asset commercially
belongs to more than one grouping in practice (e.g. a floral SVG can
belong to both a seasonal "Spring 2026" collection and a
marketplace-target "Etsy Wall Art" collection simultaneously) — this is
a direct requirement (Rule 3: "One asset can belong to multiple
collections"), not a design preference.

**Why `collectionIds` on the asset, not a join store**: repository
evidence (P1's existing field) already provides a working many-to-many
representation with no schema change needed on the `PortfolioAsset` side.
A dedicated `collectionMembers` join object store (rows of
`{ assetId, collectionId }`) was considered and rejected — see
"Alternatives considered" — because it would require either (a) an index
scan per query in both directions (find all assets in collection X /
find all collections for asset Y) or (b) two redundant indexes, and it
would be a genuinely new storage system requiring a `DB_VERSION` bump
*and* forcing every membership read to be a two-store join, when P1
already ships a working single-array field that fits directly into
`PortfolioAsset`'s existing normalize/validate/persist path.

**Deletion cleanup strategy**: `collectionService.deleteCollectionSafely()`
reads every asset once (`loadPortfolioAssets()`), computes which ones
reference the collection being deleted, and calls
`collectionStore.deleteCollectionCascade()` — one IndexedDB transaction
spanning `collections` + `portfolioAssets` that deletes the collection
row and writes back every affected asset's updated `collectionIds` in the
same atomic unit (mirroring the exact "read outside the transaction,
write inside one transaction" shape `portfolioStore.deletePortfolioAssetAndFiles`
already established in P1 for asset+file deletion). This guarantees Rule
8 ("deleting a collection removes its ID from every affected asset") can
never leave a partially-cleaned state, and Rule 9 ("deleting a collection
must not delete assets") holds trivially since the transaction never
issues a `delete()` against `portfolioAssets`, only `put()`.

**Archive semantics**: `isArchived`/`archivedAt` live only on the
`Collection` record. Archiving/unarchiving is a single-record update
(`putCollectionRecord`) that never touches `portfolioAssets` — satisfying
Rule 6 ("archived collections may retain existing members") by
construction, not by an extra check. **New-assignment policy for archived
collections (Rule 7, this ADR's own product decision)**: `assignAssetsToCollections`
rejects (per-pair, with a structured `'collection is archived'` failure
reason in bulk mode, or a thrown `ArchivedCollectionError` in the
single-item convenience wrapper) any attempt to add a *new* member to an
archived collection — an archived collection is treated as read-only for
growth. **Removal is still allowed** from an archived collection
(`removeAssetsFromCollections` never checks `isArchived`) for two
reasons: (1) integrity repair (`repairOrphanedCollectionIds`) must be
able to shrink membership on any collection regardless of archive state,
and (2) a user correcting a mistake (removing an asset that was wrongly
in an archived collection) shouldn't require unarchiving first. This
asymmetry — block growth, allow shrinkage — is the deliberate policy
Rule 7 asked to be decided and documented.

**Consistency and integrity strategy**: rather than trying to make every
mutation transactionally perfect against both stores at once (which
`collectionIds` living on the asset side makes awkward for some
operations — e.g. deleting an asset via P1's unmodified
`deletePortfolioAssetRecordOnly`/`deletePortfolioAssetAndFiles` cannot
also clean up any collection's `coverAssetId` that happened to reference
it, without either duplicating those functions' transaction logic here or
modifying P1's stable public API), Stage 1 uses **lazy, on-demand
integrity validation and repair**:
`collectionService.validateCollectionIntegrity()` computes a
`CollectionIntegrityReport` (orphaned `collectionIds` on assets — Rule
11; stale `coverAssetId` references — Rule 13) by reading every
collection and every asset once and building two `Set`s for O(1)
membership checks (never re-querying storage per item). Two paired
repair functions (`repairOrphanedCollectionIds`,
`repairCoverAssetIntegrity`) fix what the report finds, each in one bulk
write. This mirrors P1's own `services/healthCheck.ts` pattern exactly
(a pure, read-only report function plus explicit, user/caller-triggered
repair — never automatic silent repair on write), and deliberately keeps
P1's `deletePortfolioAssetRecordOnly`/`deletePortfolioAssetAndFiles`
untouched, satisfying the architecture lock's "do not rename or move
stable P1 public APIs without a critical reason."

**Performance implications**: because membership lives on the asset
record rather than a join store, every bulk membership operation
(`assignAssetsToCollections`/`removeAssetsFromCollections`) and the
integrity scan can be expressed as exactly two full-table reads
(`loadPortfolioAssets()` + `loadCollections()`, each called once
regardless of how many assets/collections are involved) followed by
in-memory `Map`/`Set`-based computation and exactly one bulk write
transaction (`putPortfolioAssetsBulk`, a new additive function mirroring
`importAssetTransaction`'s existing atomic-multi-put shape). This is
O(assetIds x collectionIds) compute with O(1) database round-trips —
never the O(collections x assets x repeated reads) shape the brief
explicitly warned against — and is what makes the 1,000-asset-under-2-
seconds target achievable (measured: ~46ms to assign, ~32ms to remove;
see `docs/portfolio/P2_STAGE1_PERFORMANCE.md`).

## Alternatives considered

- **Dedicated `collectionMembers` join object store** — rejected (see
  "Why `collectionIds` on the asset" above): more storage-layer surface
  area, a new `DB_VERSION` bump beyond the one already needed for
  `collections` itself, and no advantage over the array field at this
  app's scale (a personal/small-team asset catalog, not a
  multi-tenant SaaS product where a join table's query-planner benefits
  would matter).
- **Immediate cascading repair on every asset deletion** (patching P1's
  delete functions to also scan/clean collection `coverAssetId`
  references synchronously) — rejected: would require modifying stable,
  already-shipped P1 storage functions for a Stage-1-only concern,
  violating the architecture lock's preference for minimal,
  backward-compatible changes; the lazy-repair alternative (health-check-
  style) achieves the same end state without that coupling.
- **IndexedDB `unique: true` index on `collections.normalizedName`** for
  duplicate-name enforcement — rejected: a hard `unique` index throws a
  raw `ConstraintError` on violation, which is a poor caller experience
  compared to `collectionService.ts`'s explicit
  `DuplicateCollectionNameError` check (load-then-compare, acceptable at
  the ~100-collection scale this feature targets — see
  `docs/portfolio/P2_STAGE1_PERFORMANCE.md`).

## Consequences

- No `PortfolioAsset` schema version bump was needed — `collectionIds`
  was already part of the P1 schema (`PORTFOLIO_ASSET_SCHEMA_VERSION`
  stays at `1`).
- `Collection.schemaVersion` (`COLLECTION_SCHEMA_VERSION = 1`) is
  introduced as its own independent record-shape version, following the
  exact convention `PORTFOLIO_ASSET_SCHEMA_VERSION` already established.
- A future desktop/SQLite backend (per P1's own storage-abstraction
  goal) would represent `collectionIds` as a `TEXT`/JSON array column or
  a real join table without any change to the domain or service layer's
  function signatures — `storage/collectionStore.ts` remains the only
  module that would need to change, same as `storage/portfolioStore.ts`.

## Migration impact

`DB_VERSION` 4 → 5: adds the `collections` object store (keyed by `id`,
indexed by `normalizedName` and `isArchived`) inside the existing shared
`onupgradeneeded` handler. No existing store's shape changes; no data
migration/transformation is needed for existing `portfolioAssets` or
`portfolioFiles` rows (their `collectionIds` field already exists and
already defaults to `[]` via `normalizePortfolioAsset`). See
`docs/portfolio/COLLECTION_DATA_MODEL.md` and
`storage/db.migration.test.ts` for the full before/after verification.

## Test evidence

- Domain: `domain/collection.test.ts` (17 tests), `domain/collectionMembership.test.ts` (13 tests).
- Repository: `storage/collectionStore.test.ts` (14 tests), `storage/db.migration.test.ts` (8 tests).
- Service: `services/collectionService.test.ts` (45 tests) — covers every rule enumerated above by name in its `describe` blocks.
- Performance: `services/collectionService.performance.test.ts` (5 tests) — measured, not asserted-only; see `docs/portfolio/P2_STAGE1_PERFORMANCE.md`.
