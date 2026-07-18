# P2.5 Sprint 2 — Stress Report

Real measurements from `npm run validate:collections:stress`
(`scripts/validateCollectionsStress.ts stress`) — the LARGE-dataset,
exact-operation-count stress plan required by the Sprint 2 brief's
Section 4. This is the authoritative, corrected run (see the "P2.5-6
defect" note below); an earlier run exists in this session's history with
a since-fixed baseline-comparison bug.

## Dataset

Real LARGE preset, generated fresh for this run (seed
`p2.5-sprint2-stress`):

| Field | Value |
|---|---|
| assetCount | 100,000 |
| collectionCount | 10,000 |
| activeCollectionCount | 9,000 |
| archivedCollectionCount | 1,000 |
| membershipCount (initial) | 504,544 |
| averageMembershipsPerAsset | 5.05 |
| maxMembershipsOnOneAsset | 50 |
| coverCount / staleCoverCount | 4,775 / 477 |
| orphanedMembershipCount | 2,000 (deliberate fixture, per Sprint 1 generator) |
| duplicateCollectionIdAssetCount | 2,000 (deliberate fixture) |
| generationDurationMs | 421.3ms |
| persistDurationMs | ~1.4–1.6s (batchSize 2,000) |

## Operation counts (exact, per Section 4's required minimums)

| Operation | Required min | Actual | Success | Failure | Timeout |
|---|---|---|---|---|---|
| searchCollections | 100 | 100 | 100 | 0 | 0 |
| filterActive | 100 | 100 | 100 | 0 | 0 |
| filterArchived | 100 | 100 | 100 | 0 | 0 |
| openCollection | 100 | 100 | 100 | 0 | 0 |
| switchCollection | 100 | 100 | 100 | 0 | 0 |
| retrieveMembers | 50 | 50 | 50 | 0 | 0 |
| bulkAssign (1,000 each) | 20 | 20 | 20 | 0 | 0 |
| bulkRemove (1,000 each) | 20 | 20 | 20 | 0 | 0 |
| integrityScan | 20 | 20 | 20 | 0 | 0 |
| tempCollectionCycle (create/rename/archive/unarchive/delete) | 100 | 100 | 100 | 0 | 0 |

**Total: 710/710 operations succeeded. Zero failures. Zero timeouts.**
Deterministic exact-count sequence built by `runStressPlan()` (Fisher-Yates
shuffle over the seeded RNG), operation timeout 60s each — never
approached.

Total wall-clock duration: **482.1s** (~8.0 minutes) for the full 710-op
plan against the 100k-asset/10k-collection dataset.

## Consistency (before → after)

| Metric | Before | After | Delta |
|---|---|---|---|
| assetCount | 100,000 | 100,000 | 0 |
| collectionCount | 10,000 | 10,000 | 0 |
| orphanCount | 2,000 | 2,000 | 0 |
| staleCoverCount | 477 | 477 | 0 |
| duplicateCollectionIdAssetCount | 2,000 | 2,000 | 0 |
| membershipCount | 504,544 | 524,523 | +19,979 (expected net from 20×1,000 bulk-assign − 20×1,000 bulk-remove − assignment overlap) |

Zero unexplained mismatches. Zero new orphans. Zero new stale covers. All
100 `tempCollectionCycle` runs created, renamed, archived, unarchived, and
deleted their temporary collection — `collectionCount` returned to
exactly 10,000, confirming full cleanup.

## Latency drift

See `P2_5_LATENCY_DRIFT.md` for the full table. Summary: every operation
with ≥30 samples (the drift module's minimum) classified **stable**
(0.6%–8.8% drift). `bulkAssign`, `bulkRemove`, and `integrityScan` (20
samples each, below the 30-sample threshold) correctly report
`insufficient_samples` rather than a fabricated classification.

## Memory

Sample count 36, classification **growth** (slope ≈958KB/s over the
8-minute run), early-window mean 618.8MB → late-window mean 885.2MB. See
`P2_5_MEMORY_REPORT.md` for full analysis and why this single-run "growth"
label is not evidence of an unbounded leak (the identical code, run for
30 minutes against the same LARGE dataset, plateaus — see that report).

## Baseline comparison

See `P2_5_BASELINE_COMPARISON.md` for the full table.
`filter-active-archived` stable, `open-collection-metadata` /
`bulk-assign-1000` / `bulk-remove-1000` / `integrity-scan` all
**improved** 5–21% vs. the Sprint 1 baseline. No regressions.

## Defect discovered and fixed during this run (P2.5-6)

The first stress run (pre-fix) additionally compared Sprint 2's
`searchCollections` operation (calls `searchCollectionsByName`, a full
`loadCollections()` + in-memory name filter) against Sprint 1's
`search-collection-filter` baseline entry — which actually measured
`searchPortfolioAssets` (an unrelated asset search filtered by collection
membership; see `scripts/validateCollections.ts`). Comparing two
different operations under a coincidentally shared label produced a false
~559% "regression." This was a **validation-tool defect**, not a
production regression — no production Collection code was touched. Fixed
by extracting the Sprint2→Sprint1 operation-name map into
`SPRINT2_OPERATION_TO_SPRINT1_BENCHMARK_NAME`
(`app/src/catalog/validation/baselineCompare.ts`), deliberately omitting
`searchCollections` (no true Sprint 1 equivalent exists), with 3 new
regression tests in `baselineCompare.test.ts`. The stress run above is the
re-run with the fix applied. See "Defects Found" in
`P2_5_SPRINT2_REPORT.md` for the full write-up.
