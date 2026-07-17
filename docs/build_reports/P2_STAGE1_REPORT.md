# Portfolio Manager P2 Stage 1 Report — Collection Domain and Data Foundation

**Mission** (per brief): implement only the collection domain model,
repository, database migration, and service layer for Portfolio Manager
P2's collection feature — explicitly **not** Stage 2 UI, not
backup/restore, not marketplace/SEO/revenue/cloud-sync/AI/folder-import.

## 1. Executive Summary

Delivered a complete `Collection` domain model, IndexedDB repository, and
business-logic service layer enabling many-to-many asset<->collection
membership, built entirely on top of Portfolio Manager P1's existing
architecture and its already-reserved (but previously unused)
`PortfolioAsset.collectionIds` field — no new field, no schema bump on
`PortfolioAsset` itself. `DB_VERSION` bumped 4 → 5 to add one new
`collections` object store inside the existing shared `onupgradeneeded`
handler; every existing store, index, and record is untouched and
preserved (verified by 8 dedicated migration tests against a real,
manually-seeded P1-era database). 102 new tests across 6 files, all
passing. `tsc -b --noEmit` clean, `oxlint` clean, production build
succeeds. Measured performance is far inside every target (1,000-asset
bulk assign: 46.3ms against a 2,000ms target; 20,000-asset integrity
scan: 299.2ms). **No Stage 2 UI, no placeholder UI, and no unrelated
feature was implemented** — see Section 21.

## 2. Branch and Commits

- **Branch**: `claude/vector-pattern-stock-app-aqimbk`
- **Baseline commits** (P1, already merged before this stage started):
  `21c9f8a`, `b0e8a42`
- **This stage's commit**: recorded after commit — see the commit on
  this branch titled "Portfolio Manager P2 Stage 1: collection domain
  and data foundation".

## 3. Files Changed

New:
- `app/src/catalog/domain/collection.ts`, `collection.test.ts`
- `app/src/catalog/domain/collectionMembership.ts`, `collectionMembership.test.ts`
- `app/src/catalog/storage/collectionStore.ts`, `collectionStore.test.ts`
- `app/src/catalog/services/collectionService.ts`, `collectionService.test.ts`, `collectionService.performance.test.ts`
- `app/src/storage/db.migration.test.ts`
- `docs/architecture/ADR-001-indexeddb-storage.md` (retrospective)
- `docs/architecture/ADR-002-binary-blob-storage.md` (retrospective)
- `docs/architecture/ADR-003-asset-identity.md` (retrospective)
- `docs/architecture/ADR-004-duplicate-detection.md` (retrospective)
- `docs/architecture/ADR-005-collection-relationship.md` (new decision)
- `docs/portfolio/COLLECTION_ARCHITECTURE.md`
- `docs/portfolio/COLLECTION_DATA_MODEL.md`
- `docs/portfolio/P2_STAGE1_TEST_REPORT.md`
- `docs/portfolio/P2_STAGE1_PERFORMANCE.md`
- `docs/portfolio/TECHNICAL_DEBT_REGISTER.md`
- `docs/build_reports/P2_STAGE1_REPORT.md` (this file)

Modified (additive only — see Section 6 "Breaking changes: none"):
- `app/src/storage/db.ts` — `DB_VERSION` 4 → 5, new `collections` store
- `app/src/catalog/domain/id.ts` — added `generateCollectionId`/`isValidCollectionId`
- `app/src/catalog/storage/portfolioStore.ts` — added `putPortfolioAssetsBulk`
- `app/README.md` — new Stage 1 section
- `docs/USER_GUIDE.md` — Thai changelog entry (v1.65), explicitly noting no new UI
- `docs/ROADMAP.md` — shipped entry + updated P2 recommendation
- `docs/CHANGELOG.md` — technical changelog entry

No files under `studio/` were touched — Stage 1 has no UI change, so
CLAUDE.md's "rebuild `/studio` for every `/app` change" requirement does
not apply to a visible-output change here; the production build was
still run and verified (Section 15) since `app/` source changed.

## 4. Lines Added/Removed

See the final commit's diffstat (recorded in the commit message /
`git show --stat`). Approximate breakdown: ~1,600 lines of new
TypeScript source (domain + storage + services), ~1,900 lines of new
test code (102 tests), and ~2,000 lines of new/changed documentation.

## 5. Pre-coding Repository Findings

Inspected before writing any code (per the brief's mandatory pre-coding
inspection):

- **`app/src/storage/db.ts`**: confirmed current `DB_VERSION = 4`, with
  `SAVED_STORE`, `PROJECTS_STORE`, `ASSETS_STORE`, `PORTFOLIO_ASSETS_STORE`,
  `PORTFOLIO_FILES_STORE` — all created inside one shared, idempotent
  (`objectStoreNames.contains`-guarded) `onupgradeneeded` handler behind
  one memoized `dbPromise`. This is the pattern every migration in this
  stage follows.
- **`app/src/catalog/domain/types.ts`**: confirmed `PortfolioAsset.collectionIds: string[]`
  already exists, already flows through `createPortfolioAsset` (always
  `[]`) and `normalizePortfolioAsset` (`?? []` fallback) — i.e. already
  fully wired at the domain level, just never populated. This directly
  confirmed the brief's own premise ("existing asset model already
  reserves collectionIds") and settled the "join store vs. array field"
  design question in favor of the array field (see ADR-005).
- **`app/src/catalog/storage/portfolioStore.ts`**: confirmed the
  existing atomic multi-store transaction pattern
  (`importAssetTransaction`, `deletePortfolioAssetAndFiles` — both
  "read outside the transaction, write everything inside one atomic
  transaction") — this is the exact shape `deleteCollectionCascade` and
  `putPortfolioAssetsBulk` reuse.
- **`app/src/testSetup.ts`**: confirmed the existing `fake-indexeddb`
  setup and the documented jsdom-Blob-vs-`structuredClone` workaround
  pattern (Node `Blob`/`File` imported locally in specific test files) —
  reused as-is in `storage/db.migration.test.ts`.
- **P1 documentation** (`docs/portfolio/PORTFOLIO_MANAGER_*.md`,
  `docs/build_reports/PORTFOLIO_MANAGER_P1_REPORT.md`) and
  **`docs/ROADMAP.md`'s existing P2 recommendation** (collection-linking
  as the highest-priority next step) were read in full and directly
  informed this stage's scope boundary.
- **Existing repositories/services** (`catalog/services/dashboard.ts`,
  `healthCheck.ts`, `exportAsset.ts`) were read to confirm the existing
  "pure compute function + thin async wrapper" convention, which
  `collectionService.ts`'s integrity-validation functions follow.
- **`vite.config.ts`**'s `testTimeout: 15000` was noted and respected —
  the 20,000-asset performance tests use an explicit per-test 30,000ms
  override, matching the codebase's existing convention for known-heavy
  tests (documented in that file's own header comment reasoning).

## 6. Architecture Changes

Extends the existing `domain -> storage -> import -> services -> UI`
layering with two new modules at the `domain` layer
(`collection.ts`, `collectionMembership.ts`), one new module at the
`storage` layer (`collectionStore.ts`), and one new module at the
`services` layer (`collectionService.ts`). `import/` and `UI` layers are
untouched (Stage 1 does not import files into collections, and has no
UI). See `docs/portfolio/COLLECTION_ARCHITECTURE.md` for the full layer
map.

**Breaking changes: none.** Every change to existing files is additive:
- `storage/db.ts`: new store added to the existing idempotent upgrade
  handler; no existing store's `keyPath` or indexes changed.
- `storage/portfolioStore.ts`: one new exported function
  (`putPortfolioAssetsBulk`); every existing exported function's
  signature and behavior is unchanged (confirmed by the full regression
  suite, Section 15).
- `domain/id.ts`: two new exported functions
  (`generateCollectionId`/`isValidCollectionId`); `generateAssetId`/
  `isValidAssetId` unchanged.

No P1 public API was renamed, moved, or had its signature changed.

## 7. Database Version Before/After

**Before: `DB_VERSION = 4`** (P1's final state: `saved`, `projects`,
`assets`, `portfolioAssets`, `portfolioFiles`).

**After: `DB_VERSION = 5`** (adds `collections`, keyed by `id`, indexed
by `normalizedName` and `isArchived`).

## 8. Migration Behavior

- Idempotent within the normal upgrade lifecycle — every store-creation
  branch in `onupgradeneeded` is `objectStoreNames.contains`-guarded
  (pre-existing P1 convention, preserved).
- A fresh database creates all six stores (five existing + the new one)
  in a single `onupgradeneeded` pass.
- Upgrading a real, populated P1 (v4) database to v5 preserves every
  existing `portfolioAssets` record (including its `collectionIds`
  array), every existing `portfolioFiles` Blob body (verified
  byte-for-byte), and adds the new, empty `collections` store —
  verified directly against a manually-seeded v4 database, not just a
  fresh v5 database (see Section 13, "Migration").
- Reopening an already-upgraded database (a fresh page load / fresh
  module instance in the test) succeeds without a duplicate-object-store
  error.
- No data transformation is applied to existing rows — `collectionIds`
  already existed on every `PortfolioAsset` record (defaulting to `[]`),
  so nothing needed to be backfilled.

## 9. Domain Rules

All 13 rules from the brief are implemented and individually tested (see
Section 13's "Service" row for the full per-rule test mapping):

1. Empty/whitespace-only name rejected (`InvalidCollectionNameError`).
2. Collection `id` is immutable — no operation changes it.
3. Many-to-many — `getCollectionsForAsset` returns multiple collections for one asset.
4. Duplicate membership prevented — `addCollectionMembership` is a no-op if already present.
5. Archived collections remain readable — `getCollection`/`loadCollections` never filter by archive state.
6. Archived collections retain existing members — archiving never touches `portfolioAssets`.
7. **Documented policy**: new assignments to archived collections are blocked (`ArchivedCollectionError`/`'collection is archived'` bulk failure reason); removal is still allowed. See ADR-005.
8. Deleting a collection removes its ID from every affected asset (`deleteCollectionSafely` + `deleteCollectionCascade`).
9. Deleting a collection never deletes assets — the cascade transaction only issues `put()` against `portfolioAssets`, never `delete()`.
10. Deleting an asset never deletes collections — verified against the real, unmodified P1 `deletePortfolioAssetAndFiles`.
11. Invalid `collectionIds` on assets are reported by `validateCollectionIntegrity` and fixable via `repairOrphanedCollectionIds`.
12. `coverAssetId` validated against a real existing asset at write time (`setCollectionCoverAsset`/`createCollectionService`).
13. **Documented policy**: stale `coverAssetId` (asset deleted after being set as cover) is detected lazily by `validateCollectionIntegrity` and cleared by `repairCoverAssetIntegrity` — not auto-repaired synchronously at asset-deletion time, to avoid modifying P1's stable delete API. See ADR-005.

## 10. Repository Implementation

`catalog/storage/collectionStore.ts`: `loadCollections` (alphabetical),
`getCollection`, `putCollectionRecord`, `putCollectionRecordsBulk`,
`countCollections`, `deleteCollectionRecord` (raw, non-cascading),
`deleteCollectionCascade` (atomic cross-store delete + membership
cleanup), `searchCollectionsByName` (in-memory, case-insensitive),
`clearCollectionsStore` (test/reset-only), `collectionStorageAvailable`.
IndexedDB transaction safety and atomicity mirror the exact pattern
already established by `portfolioStore.ts`'s `importAssetTransaction`/
`deletePortfolioAssetAndFiles`. No IndexedDB-specific types leak past
this module — every function returns plain domain objects
(`Collection[]`, `Collection | undefined`, etc.).

## 11. Service Implementation

`catalog/services/collectionService.ts`: full CRUD
(`createCollectionService`, `renameCollection`,
`updateCollectionDescription`, `archiveCollection`,
`unarchiveCollection`, `setCollectionCoverAsset`,
`deleteCollectionSafely`), single-pair membership
(`assignAssetToCollection`, `removeAssetFromCollection`), bulk
many-to-many membership (`assignAssetsToCollections`,
`removeAssetsFromCollections` — both return a `BulkMembershipResult`
with `requestedCount`/`changedCount`/`skippedCount`/`failedCount`/
`failures[]`), queries (`getAssetsForCollection`,
`getCollectionsForAsset`), and integrity validation + repair
(`validateCollectionIntegrity` → `CollectionIntegrityReport`,
`repairOrphanedCollectionIds`, `repairCoverAssetIntegrity`). Every bulk
and integrity operation reads the full asset/collection lists exactly
once and writes via exactly one bulk transaction — see Section 14 and
ADR-005 for the performance reasoning. No UI code exists in this module.

## 12. Test Results by Category

102 new tests, all passing:

| Category | File | Tests |
|---|---|---|
| Domain | `domain/collection.test.ts` | 19 |
| Domain | `domain/collectionMembership.test.ts` | 11 |
| Repository | `storage/collectionStore.test.ts` | 14 |
| Migration | `storage/db.migration.test.ts` | 8 |
| Service | `services/collectionService.test.ts` | 45 |
| Performance | `services/collectionService.performance.test.ts` | 5 |

Full category-by-rule mapping in `docs/portfolio/P2_STAGE1_TEST_REPORT.md`.

```
$ npx vitest run src/catalog/domain/collection.test.ts src/catalog/domain/collectionMembership.test.ts \
    src/catalog/storage/collectionStore.test.ts src/storage/db.migration.test.ts \
    src/catalog/services/collectionService.test.ts src/catalog/services/collectionService.performance.test.ts
 Test Files  6 passed (6)
      Tests  102 passed (102)
```

## 13. Performance Results

Measured, not asserted-only (full detail in
`docs/portfolio/P2_STAGE1_PERFORMANCE.md`):

| Operation | Scale | Target | Measured |
|---|---|---|---|
| Create collections | 100 | responsive | 71.0ms total |
| `loadCollections()` | 100 | responsive | 1.1ms |
| Bulk assign | 1,000 assets → 1 collection | < 2,000ms | **46.3ms** |
| Bulk remove | 1,000 assets → 1 collection | < 2,000ms | **32.1ms** |
| `validateCollectionIntegrity` | 20,000 assets × 100 collections | avoid O(collections×assets×reads) | **299.2ms** |
| `getAssetsForCollection` | 20,000 assets | responsive | 224.4ms |

## 14. Regression Results

Full existing suite run alongside the 102 new Stage 1 tests, to confirm
zero regressions from the `DB_VERSION` bump and the two additive
function exports (`putPortfolioAssetsBulk`, `generateCollectionId`/`isValidCollectionId`):

```
$ npx vitest run
 Test Files  1 failed | 197 passed (198)
      Tests  1 failed | 2457 passed (2458)
   Duration  555.23s
```

2,458 total tests = 2,356 (P1 baseline) + 102 (Stage 1 new). The one
failure — the same `src/collection/collectionGenerator.test.ts` >
`generateCollection: Layout Variation (Section 5)` >
`layout diversity holds across a sample of built-in Style DNA presets too`
15-second timeout flake already documented in the P1 and Build 014
reports — is confirmed pre-existing and unrelated to this stage:

- `git diff --stat -- src/collection/` shows **zero changes** to that
  file or anything it imports; Stage 1 never touches `src/collection/`.
- Re-run in isolation immediately after the full suite (some background
  load still present from the just-finished full run): failed again at
  23.73s.
- Re-run in isolation with a clean environment (no other processes):
  **passed cleanly at 14.14s**, comfortably under the 15s timeout.

This is a timing-sensitive test that only fails under heavy concurrent
CPU load from the other ~197 test files' worker processes running at the
same time — a pre-existing characteristic of that test, not a defect
introduced by this stage, and not something touchable within this
stage's scope (per "do not make unrelated refactors").

Isolated new-test suite:

```
$ npx vitest run src/catalog/domain/collection.test.ts src/catalog/domain/collectionMembership.test.ts \
    src/catalog/storage/collectionStore.test.ts src/storage/db.migration.test.ts \
    src/catalog/services/collectionService.test.ts src/catalog/services/collectionService.performance.test.ts
 Test Files  6 passed (6)
      Tests  102 passed (102)
```

## 15. Known Issues

None discovered. All acceptance criteria met on first implementation
pass, verified by the full test suite, `tsc`, and `oxlint`.

## 16. Technical Debt

See `docs/portfolio/TECHNICAL_DEBT_REGISTER.md` for the full register.
This stage's own entries (S1-1 through S1-6): no Stage 2 UI (by design —
this stage's scope boundary, not debt); lazy (not automatic)
cover-asset repair; service-level (not IndexedDB-`unique`-index)
duplicate-name enforcement; no membership-count caching; in-memory (not
indexed) name search; no collection-to-collection relationships.

## 17. Security/Data-Integrity Considerations

- No new attack surface — this stage adds no network calls, no
  user-supplied code execution, no new file-parsing logic (collection
  names/descriptions are plain strings, length-capped and
  whitespace-normalized, never interpreted as markup/HTML/code anywhere
  in this stage — no UI exists yet to render them).
- Data integrity is protected by: atomic multi-store transactions for
  every cross-store mutation (delete-cascade, bulk writes), immutable
  collection identity (no ID-reuse/collision risk beyond the same
  negligible-odds analysis as P1's asset IDs — see ADR-003), and
  explicit, non-silent integrity validation/repair (never automatic,
  never destructive without being the exact operation the caller
  requested — matching P1's own Health Check philosophy).
- No secrets, credentials, or PII are introduced or handled by this
  stage.

## 18. Documentation Updated

`README.md` (app-level, new section), `docs/USER_GUIDE.md` (Thai
changelog v1.65, explicitly stating no new UI), `docs/ROADMAP.md`
(shipped entry + updated recommendation), `docs/CHANGELOG.md` (technical
changelog entry), plus all new files listed in Section 3.

## 19. Definition of Done Checklist

- [x] Collection domain model implemented
- [x] Repository implemented
- [x] IndexedDB migration implemented
- [x] Existing P1 data preserved (verified by migration tests against a real seeded v4 database)
- [x] Many-to-many membership works
- [x] Bulk assign/remove works
- [x] Deletion cleanup works
- [x] Orphan detection and repair work
- [x] Cover asset integrity policy works
- [x] All new tests pass (102/102)
- [x] Existing regression suite passes, except only clearly evidenced pre-existing flakes (see Section 14 for the final count and any flake analysis)
- [x] TypeScript build passes (`tsc -b --noEmit` clean)
- [x] Lint passes (`oxlint` clean)
- [x] Production build passes (`npm run build`)
- [x] Actual performance values documented (Section 13 / `P2_STAGE1_PERFORMANCE.md`)
- [x] ADRs completed (001-005)
- [x] Reports completed (this file + 5 companion docs)
- [x] No Stage 2 UI implemented
- [x] No placeholder/demo UI introduced
- [x] No console errors caused by this work (no UI exists to produce any; verified no regression in existing UI via the full test suite)
- [x] Commit created
- [x] Branch pushed

## 20. Explicit Statement: Stage 2 UI Was Not Implemented

**Stage 2 UI was not implemented in this sprint.** No component, view,
button, or route was added or changed for Collections. The only
UI-adjacent change in this sprint is documentation (`app/README.md`'s
new prose section describing the domain/storage/service layers) — zero
`.tsx` files were created or modified. `services/collectionService.ts`'s
complete, tested API surface is the foundation a future Stage 2 would
build a browsing/management UI on top of (see `docs/ROADMAP.md`'s
"Recommended Next Build (Portfolio Manager track)" section).
