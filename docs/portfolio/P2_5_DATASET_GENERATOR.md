# Dataset Generator — Portfolio Manager P2.5 Sprint 1

Source of truth: `app/src/catalog/validation/datasetGenerator.ts` (config
validation + generation), `datasetPresets.ts` (SMALL/MEDIUM/LARGE),
`deterministicIds.ts` (id shape), `types.ts` (schema).

## What it produces

`generateDataset(config: DatasetGeneratorConfig): GeneratedDataset` returns
`{ collections, assets, manifest }` — plain `Collection[]`/`PortfolioAsset[]`
arrays built from the *real* domain shapes (`catalog/domain/collection.ts`,
`catalog/domain/types.ts`), never a parallel shadow type. Pure and
synchronous; does not touch IndexedDB (see `validationDb.ts` for
persistence).

## Determinism

- The seeded PRNG is `engine/rng.ts`'s existing `createRng`/`rngInt` (the
  same mulberry32 + cyrb53-hash implementation the pattern generator
  itself uses) — no `Math.random` anywhere in this module.
- IDs are built by `deterministicIds.ts`'s `deterministicAssetId`/
  `deterministicCollectionId`: same `VSP-YYYYMMDD-XXXXXX`/
  `COL-YYYYMMDD-XXXXXX` shape `domain/id.ts`'s validators accept, but the
  6-char suffix comes from a plain base36-encoded index, not
  `Math.random()`.
- Every shuffled/random-looking selection (which collections are
  archived/empty/covered, which assets get an injected defect) is a
  seeded Fisher-Yates permutation, then a deterministic prefix slice —
  same seed -> same permutation -> same selection, every time.
- **Verified**: `datasetGenerator.test.ts`'s determinism suite generates
  the same config twice and asserts `toEqual` on the full collections/
  assets arrays (excluding the manifest's own wall-clock `generatedAt`/
  `generationDurationMs` fields, which are real timestamps by
  definition).

## Presets (Section 3)

| Preset | Assets | Collections | Target memberships | Actual (seed `p2.5-*`) |
|---|---|---|---|---|
| SMALL | 1,000 | 100 | 5,000 | 5,559 (5,000 base + 559 from injected orphan/high-membership extras) |
| MEDIUM | 10,000 | 1,000 | 50,000 | 50,939 |
| LARGE | 100,000 | 10,000 | ≥500,000 | 504,541 |

All three use `avgMembershipsPerAsset: 5`, which is exactly what produces
`assetCount x 5` base memberships before any injected-condition extras are
added on top (verified by `datasetGenerator.test.ts`'s "membership target
accuracy" tests, which zero out every injection ratio and assert the
exact base count).

## Configurable options (`DatasetGeneratorConfig`)

`seed`, `assetCount`, `collectionCount`, `avgMembershipsPerAsset`,
`archivedCollectionRatio`, `emptyCollectionRatio`, `collectionCoverRatio`,
`staleCoverRatio`, `orphanedCollectionIdRatio`,
`duplicateCollectionIdRatio`, `baseTimestamp` (deterministic timestamps),
`includeHighMembershipFixtures`, `includeBlobs` + `blobSampleCount`
(persistence-mode only — see `validationDb.ts`), `batchSize`.

## Injected conditions

- **Orphaned membership**: an extra `collectionIds` entry pointing at
  `GHOST_COLLECTION_ID` (a syntactically valid, never-generated id — see
  `deterministicIds.ts`) — a real Rule 11 violation, detected by the
  existing `validateCollectionIntegrity`.
- **Stale cover**: `coverAssetId` set to `GHOST_ASSET_ID` instead of a
  real member — a real Rule 13 violation, detected the same way.
- **Duplicate collectionId**: an asset's `collectionIds` array literally
  contains the same id twice. This **cannot** be produced through
  `collectionService.assignAssetsToCollections`/
  `domain/collectionMembership.ts`'s `addCollectionMembership` (which
  dedupes on every call) — the generator injects it by directly
  constructing the raw `collectionIds` array
  (`assets[idx].collectionIds = [...ids, ids[0]]`), bypassing the service
  layer entirely. This is the "exact controlled injection method" the
  brief's Section 7 asks to be documented when a condition can't arise
  naturally. `validateCollectionIntegrity` does not currently scan for
  this condition (see `TECHNICAL_DEBT_REGISTER.md`).
- **High-membership asset / high-member collection**: not integrity
  violations — deliberate dataset-shape fixtures. One asset (index 0) is
  boosted to join up to 50 collections; one collection (the first
  assignable one) is boosted to gain up to 500 members.

## In-memory vs. persisted (Section 3 capabilities 1–3)

- **In-memory** (`generateDataset` alone): fast, no IndexedDB — used by
  pure-generator benchmarks and every unit test above.
- **Real IndexedDB seeding** (`validationDb.persistDataset`): writes the
  generated arrays via the *existing* bulk primitives
  (`putCollectionRecordsBulk`, `putPortfolioAssetsBulk`), chunked by
  `batchSize`. See `P2_5_VALIDATION_ARCHITECTURE.md`'s "Database
  isolation" section for what makes this safe.
- **Clean removal/reset** (`validationDb.resetValidationDatabase`): calls
  the existing `clearCollectionsStore()`/`clearPortfolioStores()`.

## Performance note

An early version of the manifest-computation pass did an
O(collections x assets) `.some()`-per-collection check to find empty
collections, and a matching O(coveredCollections x assets) `.find()` per
covered collection to resolve cover targets. At the LARGE preset's
100,000 x 10,000 scale this took ~8.5s. Rewritten to a single linear pass
over assets building lookup `Set`/`Map`s once — LARGE generation now
completes in ~330-500ms (see `P2_5_SPRINT1_TEST_REPORT.md`/
`P2_5_PERFORMANCE_BASELINE.md` for the measured numbers).

## Input validation (`validateDatasetConfig`)

Throws `InvalidDatasetConfigError` for: empty seed, negative/non-integer
counts, out-of-range ratios (must be 0..1), `archivedCollectionRatio +
emptyCollectionRatio > 1`, `avgMembershipsPerAsset` larger than the
assignable (non-empty) collection pool, non-positive `batchSize`,
`collectionCount` of 0 with a non-zero membership target, negative
`blobSampleCount`.
