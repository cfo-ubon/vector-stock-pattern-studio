# Portfolio Manager P2 Stage 1 — Test Report

## New tests: 102 across 6 files

```
$ npx vitest run src/catalog/domain/collection.test.ts src/catalog/domain/collectionMembership.test.ts \
    src/catalog/storage/collectionStore.test.ts src/storage/db.migration.test.ts \
    src/catalog/services/collectionService.test.ts src/catalog/services/collectionService.performance.test.ts
 Test Files  6 passed (6)
      Tests  102 passed (102)
```

| File | Tests | Category |
|---|---|---|
| `domain/collection.test.ts` | 19 | Domain |
| `domain/collectionMembership.test.ts` | 11 | Domain |
| `storage/collectionStore.test.ts` | 14 | Repository |
| `storage/db.migration.test.ts` | 8 | Migration |
| `services/collectionService.test.ts` | 45 | Service |
| `services/collectionService.performance.test.ts` | 5 | Performance |

## Coverage by required category (brief Section 9)

### Domain — validation, normalization, identity, timestamps, archive state, coverAssetId rules

`domain/collection.test.ts`: empty/whitespace-only name rejection (Rule
1), max-length rejection/boundary acceptance, whitespace trim+collapse,
case-insensitive `normalizeCollectionName`, unique `COL-` id generation
(`isValidCollectionId`), default `coverAssetId`/`description`/`isArchived`/`archivedAt`,
injectable deterministic `now` for timestamps, `schemaVersion` default,
`normalizeCollection`'s defensive fallback on a partial/older record,
`isValidCollection` type guard. `domain/collectionMembership.test.ts`:
add/remove/dedupe on `collectionIds`, no-duplicate guarantee (Rule 4),
same-array-reference no-op detection, `removeInvalidMemberships`.

### Repository — CRUD, archive/unarchive, delete, search, persistence across reopen, transaction failure behavior

`storage/collectionStore.test.ts`: create (`putCollectionRecord` +
`getCollection` round-trip), read (`getCollection` unknown-id → `undefined`),
update-in-place (no duplicate row), `loadCollections` full-list +
alphabetical ordering, `countCollections`, `deleteCollectionRecord`,
`searchCollectionsByName` (case-insensitive substring + empty-query
returns all), `clearCollectionsStore`, persistence-across-reads (two
independent `loadCollections()` calls agree), and the atomic
`deleteCollectionCascade` primitive (record deleted + supplied asset
updates persisted in one transaction; zero-affected-assets case; asset
itself never deleted). Archive/unarchive as *repository* operations are
plain `putCollectionRecord` calls (covered by the update-in-place test);
their *policy* (Rules 5-7) is service-layer behavior, tested in
`collectionService.test.ts` instead — see "Service" below.

### Migration — all 8 required cases

`storage/db.migration.test.ts`, one test per required case:

1. Fresh database creation — every store (including `collections`) created in one pass.
2. Upgrade from a real, manually-seeded P1 (v4) schema.
3. Existing assets retained through the upgrade.
4. Existing binary Blobs retained (verified byte-for-byte via `arrayBuffer()`).
5. Existing `collectionIds` retained on a migrated asset.
6. New `collections` store available (and correctly empty) after the upgrade.
7. Reopening the already-upgraded database succeeds (fresh module instance, fresh `dbPromise` memo).
8. Idempotent within the normal upgrade lifecycle — `openDb()` never throws.

DB_VERSION before/after: **4 → 5** (see `storage/db.ts`).

### Service — single/bulk membership, duplicate prevention, missing refs, archived-collection policy, deletion cleanup, orphan detect/repair, cover-asset cleanup

`services/collectionService.test.ts` (45 tests), by `describe` block:
`createCollectionService` (name validation, duplicate-name rejection,
invalid/valid `coverAssetId`), `renameCollection` (re-normalization,
unknown-id error, duplicate-name rejection excluding self, identity
never changes), `updateCollectionDescription`, `archive`/`unarchive`
(sets/clears fields, archived collection stays readable, retains
members, unarchive doesn't touch membership), **archived-assignment
policy** (blocks new assignment, still allows removal — Rule 7's
documented decision), single assign/remove (multi-collection membership
— Rule 3, duplicate-assignment guard — Rule 4, missing-asset/missing-
collection errors, removing a non-member is a no-op), **bulk**
assign/remove (accurate `requestedCount`/`changedCount`/`skippedCount`/`failedCount`,
mixed-batch structured failures for missing asset + missing collection
in the same call, archived-collection pairs fail without blocking other
pairs, empty-request zeroed result), `deleteCollectionSafely` (Rules 8/9:
removes the id from every affected asset, never deletes the assets,
leaves unrelated memberships untouched, unknown-id error), **"deleting
an asset must not delete collections"** (Rule 10, verified against the
real unmodified P1 `deletePortfolioAssetAndFiles`), `setCollectionCoverAsset`
+ integrity (Rules 12/13: valid/invalid cover assignment, clearing to
null, clean-catalog report, orphaned-`collectionId` detection and repair,
stale-`coverAssetId` detection — via a real asset deletion — and repair),
and query functions (`getAssetsForCollection`/`getCollectionsForAsset`
empty-result cases).

### Performance — see `docs/portfolio/P2_STAGE1_PERFORMANCE.md`

5 tests, measured (not asserted-only) at 100 collections, 1,000 assets
(bulk assign/remove), and 20,000 assets × 100 collections (integrity
scan + collection-membership query).

## Full existing suite (regression)

Full command and results, run alongside every pre-existing test in the
repository (not just the new Stage 1 files), to confirm zero regressions
from: `storage/db.ts`'s `DB_VERSION` bump (4 → 5) and new `collections`
store; `storage/portfolioStore.ts`'s additive `putPortfolioAssetsBulk`
function (no existing signature changed); every P1 catalog/UI module
(untouched by Stage 1).

```
$ npx vitest run
 Test Files  1 failed | 197 passed (198)
      Tests  1 failed | 2457 passed (2458)
```

2,458 total = 2,356 (P1 baseline) + 102 (this stage's new tests). The one
failure is the pre-existing `src/collection/collectionGenerator.test.ts`
15-second timeout flake (unrelated: zero diff in `src/collection/`,
passes cleanly in isolation at 14.14s in a clean environment) — full
analysis in `docs/build_reports/P2_STAGE1_REPORT.md`'s Section 14.

## TypeScript / lint

```
$ npx tsc -b --noEmit
(clean, no output)

$ npm run lint     # oxlint
(clean, no output)
```
