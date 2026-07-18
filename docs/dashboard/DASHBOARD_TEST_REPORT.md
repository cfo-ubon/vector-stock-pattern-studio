# Portfolio Dashboard Test Report — Build 017

## Summary

```
Test Files  10 passed (10)
     Tests  65 passed (65)
```

Run with `npx vitest run src/catalog/dashboard/ --no-watch` from `/app`.
Zero failures, zero skipped tests. `npx tsc -b --force` and `npx oxlint
src/catalog/dashboard/` are both clean.

## Coverage by required test category

The brief mandates: Portfolio Health, Analytics, Recommendation Engine,
Snapshot, Large dataset, Regression. Every category is covered:

| Category | Test file(s) | Representative tests |
|---|---|---|
| Portfolio Health | `portfolioHealthCalculator.test.ts` | empty-portfolio floor, `overall` matches its own component-average formula, each of the 6 components responds to a real signal (missing metadata, duplicate conflicts, organization ratio, readiness rate, validation failures) |
| Analytics | `collectionAnalytics.test.ts`, `submissionAnalytics.test.ts`, `marketplaceAnalytics.test.ts`, `seoAnalytics.test.ts`, `readinessAnalytics.test.ts` | see per-file breakdown below |
| Recommendation Engine | `recommendationEngine.test.ts` | each of the 6 codes' trigger condition and priority, an explicit determinism check |
| Snapshot | `dashboardSnapshot.test.ts`, `portfolioDashboardService.test.ts` | empty baseline, real mixed-portfolio wiring across all 5 analytics sections, recommendations reflecting the same data, determinism, real-storage integration, read-only proof |
| Large dataset | `dashboardLargeDataset.test.ts` | 400 patterns × 40 collections × 5 marketplaces = 2,000 submissions |
| Regression | full-suite run (below) | no change to any file outside `app/src/catalog/dashboard/` |

## Test files

### `collectionAnalytics.test.ts` (9 tests)
Empty portfolio returns all-zero/empty stats; `collectionCount` and
organized `patternCount` counted correctly; `averagePatternsPerCollection`
uses each collection's own size (proven to double-count a pattern shared
across 2 collections, distinct from `patternCount`); `largestCollection`
identifies the biggest collection and is `null` (not a zero-pattern
summary) when there are no collections at all; `emptyCollections` lists
real 0-pattern collections; `duplicatePatternUsage` lists patterns in
>1 collection and is empty when none are.

### `submissionAnalytics.test.ts` (3 tests)
Empty list returns all-zero counts; all 8 statuses counted under their
own field from a mixed set of records; `byMarketplace` passed through
unchanged from `computeSubmissionStatistics`.

### `marketplaceAnalytics.test.ts` (7 tests)
Empty array for no submissions; marketplaces listed sorted by id;
`patternsPlanned` counts distinct patterns, not raw record count;
ready/submitted/approved/rejected counted by current status;
`approvalRate` is `null` with no decided outcome and computed correctly
once one exists; marketplaces kept fully independent (one marketplace's
data never leaks into another's entry).

### `seoAnalytics.test.ts` (8 tests)
Empty input returns an all-zero report with `sampleSize: 0`; a single
submission's aggregate score matches `computeSeoScore`'s own `overall`
directly; lowest/highest diverge across a mix of good and poor
submissions; missing-metadata counting for absent title/description/
keywords/category, and `0` when everything is complete;
`averageKeywordCoverage` at 100 when every submission touches every
concept bucket; `averageMarketplaceCompatibility` drops when submissions
violate their marketplace's rules.

### `readinessAnalytics.test.ts` (7 tests)
Empty portfolio returns all-zero stats; patterns with/without
submissions counted correctly; a submission referencing a `patternId`
not present in the catalog is excluded (proven directly, not just
asserted); `DRAFT`/`NEEDS_REVISION`/`REJECTED`/`ARCHIVED` classified as
NOT ready-or-beyond, `READY`/`QUEUED`/`SUBMITTED`/`APPROVED` classified
as ready-or-beyond; a pattern counts as ready-or-beyond if ANY of its
submissions qualifies; `readinessRate` rounded to 1 decimal (a `33.3`
example).

### `portfolioHealthCalculator.test.ts` (10 tests)
Empty portfolio returns `overall: 0` and every component `0`; `overall`
verified against its own 6-component average for a real mixed
portfolio; `metadataCompleteness` drops when submissions are missing
fields; `duplicateRisk` drops when submissions have real duplicate
conflicts (via `countDuplicateConflictingSubmissions`);
`collectionOrganization` reflects the organized/total ratio;
`submissionReadiness` matches `readinessAnalytics.readinessRate`
exactly; `validationStatus` is 100 when every submission validates
cleanly and drops when one fails marketplace validation;
`countDuplicateConflictingSubmissions` returns 0 for an empty or
conflict-free list, and — the one test whose expectation was corrected
during development — counts **only the new attempt** that conflicts
with an already-approved original, not the original itself (matching
`submissionDuplicateDetection.test.ts`'s own established asymmetric
semantics from Build 015: the original's own related record is in
`DRAFT` at a different version, so nothing flags the original itself).

### `recommendationEngine.test.ts` (14 tests)
An empty/quiet portfolio returns no recommendations; `improve-seo`
triggers below 70 with real submissions but not for an empty portfolio
(`sampleSize: 0`, even though `averageScore` reads `0`) — proving the
sample-size guard is real, not incidental; high priority below 50,
medium between 50 and 70, no trigger at or above 70; `complete-metadata`
triggers on any missing-metadata count and escalates to high priority
past a 50% ratio; `move-ready-to-submission` and `review-rejected` fire
with their exact counts; `remove-duplicates` triggers from collection-
level duplication alone (low priority), from submission-level conflicts
alone (high priority), and combines both signals into one recommendation
with a summed `relatedCount` when both are present;
`fill-empty-collections` fires with the exact empty-collection count; an
explicit determinism test compares `JSON.stringify` of two calls with
identical input.

### `dashboardSnapshot.test.ts` (5 tests)
An empty portfolio produces a complete snapshot with every section
present, all at their documented empty baseline; a real mixed portfolio
(one collection, two assets, one `READY` submission) wires every
analytics section consistently from the same input, including a real
positive `portfolioHealth.overall`; recommendations reflect the same
data the analytics sections themselves report (an empty collection
produces both `collectionAnalytics.emptyCollections.length === 1` and a
`fill-empty-collections` recommendation); determinism verified via
`JSON.stringify` equality across two builds with identical input and
`now`; `generatedAt` defaults to a real `Date.now()`-range value when
`now` is omitted.

### `portfolioDashboardService.test.ts` (3 tests, real storage)
Against real IndexedDB/`localStorage`-backed stores (cleared in
`beforeEach` via `clearCollectionsStore`, `clearPortfolioStores`,
`clearSubmissionStore`): a fresh empty portfolio produces the documented
empty-baseline snapshot; real Collections + real Portfolio assets + a
real Submission created through their own service layers
(`createCollectionService`, `importAssetTransaction`,
`assignAssetsToCollections`, `createSubmission`) are correctly reflected
end-to-end in the loaded snapshot; and — the explicit "read-only
integration" proof — calling `loadDashboardSnapshot()` twice and then
independently re-reading Collections/Portfolio/Submissions afterward
confirms nothing was written back to any store.

### `dashboardLargeDataset.test.ts` (1 test, "Large dataset" category)
400 patterns across 40 collections (every pattern in exactly 1
collection, round-robin) × 5 marketplaces = 2,000 submissions, statuses
cycled evenly across `DRAFT`/`READY`/`QUEUED`/`SUBMITTED`/`APPROVED`.
Verifies: completes in well under 20 seconds (observed ~5.9s); Collection
Analytics (`collectionCount`, full `patternCount`, zero empty
collections, zero duplicate usage), Readiness Analytics (`totalPatterns`,
`patternsWithSubmissions`), Submission Analytics (each of the 5 used
statuses appears exactly 400 times), and Marketplace Analytics
(`patternsPlanned` exactly 400 per marketplace) all correct at scale;
SEO Analytics has a real 2,000-record sample with every score bounded
0-100 and `lowestScore ≤ averageScore ≤ highestScore`; Portfolio Health
`overall` is in range and `collectionOrganization` reads exactly 100
(every pattern is organized by construction); `move-ready-to-submission`
is present among the recommendations; rebuilding from the exact same
input produces a byte-for-byte identical (`JSON.stringify`) snapshot.
30-second test timeout; observed runtime well under that.

## Regression

Full pre-existing suite re-run alongside this new work with no change to
any file outside `app/src/catalog/dashboard/`:

```
Test Files  267 passed (267)   (was 257 before Build 017 — +10 new files)
     Tests  3026 passed (3026) (was 2961 before Build 017 — +65 new tests)
```

No change to `catalog/domain/collection.ts`,
`catalog/domain/collectionMembership.ts`, `catalog/storage/collectionStore.ts`,
`catalog/services/collectionService.ts` (the frozen Collection API
surface, still guarded by `collectionApiFreeze.test.ts`, which passed
unmodified), to any file under `catalog/backup/` (Backup & Restore, P3),
to any file under `catalog/submission/` (Submission Center, Build 015),
or to any file under `catalog/seo/` (SEO Intelligence Engine, Build
016).

## Known gaps

- No dedicated performance/soak test beyond the single 2,000-submission
  large-dataset case — out of scope for a foundation build whose brief
  asked for large-dataset *correctness*, not a new performance baseline.
- `portfolioDashboardService.test.ts` exercises real storage for
  Collections, Portfolio assets, and Submissions together but only in a
  small, hand-built scenario (1 collection, 1 asset, 1 submission) —
  large-scale real-storage integration is covered separately by
  `dashboardLargeDataset.test.ts`, but that test builds its input arrays
  directly rather than round-tripping through the three stores.
- No UI-level test, since no UI was built this phase.
