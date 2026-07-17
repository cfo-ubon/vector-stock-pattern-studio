# Collection Architecture — Portfolio Manager P2 Stage 1

Companion to `docs/portfolio/PORTFOLIO_MANAGER_ARCHITECTURE.md` (P1).
This document covers only what Stage 1 added — the Collection domain
model, storage, and service layer. See `docs/architecture/ADR-005-collection-relationship.md`
for the full reasoning behind the many-to-many design; this document is
the "where things live and how they fit" companion.

## What this is

A **Collection** is a user-defined, named grouping of catalog assets
(`PortfolioAsset`) — e.g. "Spring 2026 Florals". Stage 1 delivers the
domain model, persistence, and business-logic (service) layer only —
**no UI**. A future Stage 2 will build the browsing/management screens
on top of this foundation.

## Layer map (extends P1's existing `domain -> storage -> services` layers)

```
app/src/catalog/
  domain/
    collection.ts              Collection type, factory, validation, normalization
    collectionMembership.ts    pure add/remove/dedupe helpers for PortfolioAsset.collectionIds
  storage/
    collectionStore.ts         IndexedDB repository for the `collections` object store
    portfolioStore.ts          (extended — see "Extensions to P1" below)
  services/
    collectionService.ts       business logic: CRUD, membership, bulk ops, integrity
```

No `ui/` additions — Stage 2 scope, explicitly not implemented here.

## Extensions to existing P1 modules

- **`storage/db.ts`**: `DB_VERSION` 4 → 5, adds the `collections` object
  store to the existing shared `onupgradeneeded` handler. See
  `docs/portfolio/COLLECTION_DATA_MODEL.md`'s "Database" section.
- **`storage/portfolioStore.ts`**: one new additive function,
  `putPortfolioAssetsBulk(assets: PortfolioAsset[])` — writes many asset
  records in a single IndexedDB transaction. No existing function's
  signature or behavior changed. Used by `collectionService.ts`'s bulk
  membership operations and integrity repair, for both atomicity and
  performance (see ADR-005's "Performance implications").

Nothing in P1's `import/` layer, `services/dashboard.ts`,
`services/healthCheck.ts`, or `services/exportAsset.ts` was touched.

## Why collections live under `src/catalog/`, not a new top-level module

Same rationale as P1's own placement decision
(`docs/portfolio/PORTFOLIO_MANAGER_ARCHITECTURE.md`'s "Naming collision"
section): Collections are a first-class part of the *same* catalog
domain as `PortfolioAsset` — a Collection has no meaning independent of
the assets it groups — so it belongs in the same module tree, not a
sibling one. There is no naming collision to route around here (unlike
P1's `src/catalog/` vs `src/portfolio/` decision).

## Request flow (illustrative, no UI yet)

```
A future Stage 2 UI action                     Stage 1 (this sprint)
"Add 3 selected assets to Spring 2026"    -->   collectionService.assignAssetsToCollections(
                                                   [assetId1, assetId2, assetId3],
                                                   [springCollectionId]
                                                 )
                                                 -> loadPortfolioAssets() (once)
                                                 -> loadCollections() (once)
                                                 -> compute updated collectionIds in memory
                                                 -> portfolioStore.putPortfolioAssetsBulk(...)
                                                    (one atomic transaction)
                                                 -> BulkMembershipResult returned
```

## Public API surface (Stage 1)

### `domain/collection.ts`

`Collection`, `createCollection`, `normalizeCollection`,
`validateCollectionName`, `normalizeCollectionName`, `isValidCollection`,
`InvalidCollectionNameError`, `COLLECTION_SCHEMA_VERSION`,
`COLLECTION_NAME_MAX_LENGTH`, `COLLECTION_DESCRIPTION_MAX_LENGTH`.

### `domain/collectionMembership.ts`

`addCollectionMembership`, `removeCollectionMembership`,
`dedupeCollectionIds`, `removeInvalidMemberships` — all pure,
synchronous, operate on `string[]`.

### `storage/collectionStore.ts`

`collectionStorageAvailable`, `loadCollections`, `getCollection`,
`putCollectionRecord`, `putCollectionRecordsBulk`, `countCollections`,
`deleteCollectionRecord`, `deleteCollectionCascade`,
`searchCollectionsByName`, `clearCollectionsStore`,
`CollectionStorageUnavailableError`.

### `services/collectionService.ts`

CRUD: `createCollectionService`, `renameCollection`,
`updateCollectionDescription`, `archiveCollection`,
`unarchiveCollection`, `setCollectionCoverAsset`,
`deleteCollectionSafely`.

Membership: `assignAssetToCollection`, `removeAssetFromCollection`,
`assignAssetsToCollections`, `removeAssetsFromCollections` (bulk, return
`BulkMembershipResult`), `getAssetsForCollection`,
`getCollectionsForAsset`.

Integrity: `validateCollectionIntegrity` (returns
`CollectionIntegrityReport`), `repairOrphanedCollectionIds`,
`repairCoverAssetIntegrity`.

Errors: `CollectionNotFoundError`, `DuplicateCollectionNameError`,
`ArchivedCollectionError`, `InvalidCoverAssetError`.

## Explicitly out of scope for Stage 1

- Any UI component, view, or button.
- Full-library backup/restore.
- Marketplace/SEO/revenue/cloud-sync/AI features.
- Folder import.
- Changes to the Generator, Evaluation Engine, or Portfolio Intelligence Engine.
