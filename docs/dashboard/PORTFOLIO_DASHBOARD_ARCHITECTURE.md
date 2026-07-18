# Portfolio Dashboard Architecture — Build 017

An integration build. This layer builds nothing new — it reads from the
three modules that already exist (Collection API, Submission Center,
SEO Intelligence Engine) and combines their data into a single set of
analytics reports, a portfolio health score, generated recommendations,
and one snapshot object suitable for a future UI to render. **No file
outside `app/src/catalog/dashboard/` was touched.**

## What this is, and isn't

Given the current state of a user's Collections, Portfolio catalog, and
Submissions, this layer answers: how healthy is the portfolio overall
(0-100, six components), what does SEO/Submission/Collection/Marketplace/
Readiness data look like in aggregate, and what should the user do next
(a plain list of recommendations). It does **not** upload anything to a
marketplace, does **not** modify any Collection, Submission, or SEO
data, and does **not** render any UI — this build is a service layer
only, "suitable for future UI rendering," per the brief.

## Layer map

```
app/src/catalog/dashboard/
  collectionAnalytics.ts        Collection Analytics — collections/patterns/duplicates
  submissionAnalytics.ts        Submission Analytics — 8-status counts + per-marketplace
  marketplaceAnalytics.ts       Marketplace Analytics — per-marketplace funnel + approval rate
  seoAnalytics.ts                SEO Analytics — score aggregates, missing metadata, coverage
  readinessAnalytics.ts          Readiness Analytics — catalog-wide submission readiness
  portfolioHealthCalculator.ts   Portfolio Health — single 0-100 score, 6 components
  recommendationEngine.ts        Recommendation Engine — read-only suggestion list
  dashboardSnapshot.ts           Dashboard Snapshot — assembles everything above
  portfolioDashboardService.ts   Portfolio Dashboard Service — the one file that touches storage
  index.ts                       Public barrel
```

Every one of the brief's 9 named modules maps to a real file above.
There is no storage layer of its own — no new IndexedDB store, no new
`localStorage` key — matching the brief's "No storage. No IndexedDB
changes."

## Read-only integration: a checkable fact, not just a description

The brief forbids modifying the Collection API, Backup & Restore, the
SEO Engine, and the Submission Engine, and requires the dashboard itself
to be read-only. Three things make this a property of the code, not
just an intention:

1. **Only three loader functions are ever called**, and all three are
   pre-existing reads: `loadCollections` and `loadPortfolioAssets` (the
   frozen Collection API, `docs/portfolio/COLLECTION_API_FREEZE.md`) and
   `loadSubmissions` (Submission Center, Build 015). They are called in
   exactly one place, `portfolioDashboardService.ts`'s
   `loadDashboardSnapshot`. No other file under `catalog/dashboard/`
   imports from `storage/collectionStore.ts`, `storage/portfolioStore.ts`,
   or `submission/submissionStore.ts` at all.
2. **No write function from any of the three source modules is ever
   imported.** `createCollectionService`, `assignAssetsToCollections`,
   `importAssetTransaction`, `createSubmission`, `updateSubmissionStatus`,
   `seoGenerator.ts`'s generation functions — none appear anywhere in
   `catalog/dashboard/`'s import graph. This was verified directly by
   `portfolioDashboardService.test.ts`'s "never writes anything back to
   storage" test, which calls `loadDashboardSnapshot()` twice and then
   independently re-reads Collections/Portfolio/Submissions to confirm
   nothing changed.
3. **8 of the 9 files are pure functions over plain data arrays.** Only
   `portfolioDashboardService.ts` is `async` and touches storage; every
   other module (`collectionAnalytics.ts` through `recommendationEngine.ts`
   and `dashboardSnapshot.ts`) takes `Collection[]` / `PortfolioAsset[]` /
   `SubmissionRecord[]` (or already-computed analytics reports) as plain
   arguments and returns plain data — no side effects are even reachable
   from those files.

## The SEO ↔ Submission integration bridge

The SEO Intelligence Engine (Build 016) has no storage of its own — it
is a pure computation over caller-supplied title/description/keyword
strings (see `docs/seo/SEO_ARCHITECTURE.md`). Submission Center (Build
015), however, already persists exactly that content on every
`SubmissionRecord` (`titleSnapshot`, `descriptionSnapshot`,
`keywordSnapshot`, plus `marketplaceId` and `category`) — the text a
user entered at submission time. `seoAnalytics.ts` and
`portfolioHealthCalculator.ts`'s validation component feed each
record's own snapshot fields through the SEO Engine's existing,
unmodified `computeSeoScore`, `analyzeKeywords`, and `validateSeoContent`
functions. This is the one place Submission Center's and the SEO
Engine's data actually meet — neither module needed to change, and
neither one imports the other.

## Pure-computation / thin-loader split

This mirrors the same split already established by Submission Center
(`submissionQueue.ts`, pure, vs. `submissionStore.ts`, a loader) and
Backup & Restore (`backupBuilder.ts`). `portfolioDashboardService.ts` is
the *only* file in this module that is `async` or imports a storage
module. `dashboardSnapshot.ts`'s `buildDashboardSnapshot` is the pure
core: given the same three input arrays (plus an optional injectable
`now`), it always produces the same output — this is what makes
`loadDashboardSnapshot` trivial (fetch the three arrays, hand them to
the pure function) and what makes the pure function itself trivially
testable without any storage setup at all.

## Composition, not duplication

- `submissionAnalytics.ts` writes no counting logic of its own — it
  reshapes Submission Center's own `computeSubmissionStatistics` output
  into the field names the brief's Submission Analytics section names.
- `portfolioHealthCalculator.ts`'s `seoScore` component is literally
  `seoAnalytics.averageScore`, and `submissionReadiness` is literally
  `readinessAnalytics.readinessRate` — the health calculator does not
  recompute what an analytics module already computed, it composes.
- `recommendationEngine.ts` takes already-computed analytics reports as
  input (`SeoAnalytics`, `SubmissionAnalytics`, `CollectionAnalytics`)
  rather than raw records — it never re-derives a count that an
  analytics module already owns.
- `dashboardSnapshot.ts` computes the shared, expensive
  `duplicateSubmissionConflictCount` (an O(n²) pass over submissions,
  via `portfolioHealthCalculator.ts`'s exported
  `countDuplicateConflictingSubmissions`) exactly once per snapshot
  build, and threads the same number into both `computePortfolioHealth`
  (for the Duplicate Risk component) and `generateRecommendations` (for
  the exact `remove-duplicates` count) — see
  `PORTFOLIO_HEALTH_SCORE.md`'s "Duplicate Risk" section for why sharing
  this one computation matters, both for performance and for keeping
  the two outputs describing the same fact in agreement.

## Uniform empty-data convention

Every Portfolio Health component and every analytics aggregate returns
exactly `0` when there is no data to compute it from (an empty
portfolio, a marketplace with no decided submissions, etc.) — documented
once on `portfolioHealthCalculator.ts`'s module header and applied
consistently by every module in this layer. An empty portfolio is
deliberately not scored as "perfectly healthy" (nothing to be wrong
with) nor as "maximally at risk" — it is simply unscored, at its floor.
The one intentional exception to plain zero is `approvalRate`, which is
`null` (not `0`) when no submission has been decided yet — a genuine
`0` there would mean every decided submission was rejected, a
materially different fact.

## Determinism

`buildDashboardSnapshot` is a pure function of its three input arrays
and an optional `now`. The only non-deterministic field in the whole
snapshot is `generatedAt` (defaults to `Date.now()` when `now` is
omitted) — every score, count, and recommendation is otherwise a
deterministic function of the input. `dashboardSnapshot.test.ts` and
`dashboardLargeDataset.test.ts` both verify this directly by
`JSON.stringify`-comparing two builds from identical input.

## Explicitly out of scope for this build

- Any UI component, view, or button — "No UI in this build," per the
  brief.
- Any marketplace upload — this layer only ever reads already-persisted
  submission data, it never transmits anything.
- Any modification to `docs/portfolio/COLLECTION_API_FREEZE.md`'s frozen
  surface, `catalog/backup/` (Backup & Restore), `catalog/submission/`'s
  existing files (Submission Center), or `catalog/seo/`'s existing files
  (SEO Intelligence Engine) — none were touched; no production defect
  was found or claimed in any of them.
- Persisting a snapshot anywhere — every snapshot is computed fresh on
  each `loadDashboardSnapshot()` call; there is no "last snapshot" store.
