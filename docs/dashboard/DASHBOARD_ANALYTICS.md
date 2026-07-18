# Dashboard Analytics — Build 017

The 5 read-only analytics reports the Portfolio Dashboard computes, plus
the Recommendation Engine and the Dashboard Snapshot that ties them
together. Every report below is a pure function over plain data arrays
— see `PORTFOLIO_DASHBOARD_ARCHITECTURE.md` for how each one sources
its data without modifying the module that owns it.

## SEO Analytics (`seoAnalytics.ts`)

Reports the brief's exact 6 fields, computed from every submission's own
`titleSnapshot`/`descriptionSnapshot`/`keywordSnapshot` run through the
SEO Engine's unmodified `computeSeoScore` and `analyzeKeywords`:

| Field | Meaning |
|---|---|
| `averageScore` | Mean `computeSeoScore(...).overall` across all submissions |
| `lowestScore` / `highestScore` | Min/max of the same per-submission overall scores |
| `missingMetadataCount` | Submissions missing a non-empty title, description, ≥1 keyword, or a category |
| `averageKeywordCoverage` | Mean of `analyzeKeywords(...).coverage.coverageScore` |
| `averageMarketplaceCompatibility` | Mean of `computeSeoScore(...).marketplaceCompatibility`, each scored against its own submission's marketplace |
| `sampleSize` | Number of submissions the report was computed from — disambiguates "empty portfolio" from "everything scored zero" |

All numeric fields are `0` and `sampleSize` is `0` for an empty input.

## Submission Analytics (`submissionAnalytics.ts`)

A thin reshape of Submission Center's own `computeSubmissionStatistics`
(Build 015, unmodified) — no new counting logic. Reports the brief's 8
status counts plus `total` and the pre-existing `byMarketplace`
breakdown, passed through wholesale:

`draft`, `ready`, `queued`, `submitted`, `approved`, `rejected`,
`needsRevision`, `archived`, `total`, `byMarketplace`.

## Collection Analytics (`collectionAnalytics.ts`)

| Field | Meaning |
|---|---|
| `collectionCount` | Total collections |
| `patternCount` | Distinct patterns belonging to **at least one** collection ("organized" patterns — not the catalog's total size) |
| `averagePatternsPerCollection` | Sum of each collection's own size ÷ `collectionCount`, rounded to 1 decimal. Deliberately double-counts a pattern filed under multiple collections (each of those collections is genuinely 1 pattern bigger) — this is *not* the same as `patternCount / collectionCount` |
| `largestCollection` | `{collectionId, name, patternCount}` of the biggest collection, or `null` if there are no collections |
| `emptyCollections` | Real collections with 0 patterns (distinct from "no collections at all," which is `largestCollection: null`) |
| `duplicatePatternUsage` | Patterns filed under more than one collection — an organizational fact, not inherently a problem (a pattern legitimately belonging to "Spring 2026" and "Florals" both is normal) |

## Marketplace Analytics (`marketplaceAnalytics.ts`)

One entry per distinct marketplace referenced by any submission (sorted
by id), covering the brief's funnel: Planned → Ready → Submitted →
Approved/Rejected.

| Field | Meaning |
|---|---|
| `patternsPlanned` | Distinct patterns with ≥1 submission to this marketplace, in *any* status |
| `ready` / `submitted` / `approved` / `rejected` | Submission counts at that status, for this marketplace |
| `approvalRate` | `approved / (approved + rejected) * 100`, rounded to 1 decimal; `null` when nothing has been decided yet (distinct from a real `0%`, which would mean everything decided was rejected) — "if data exists," per the brief |

## Readiness Analytics (`readinessAnalytics.ts`)

The one place total catalog size (from the frozen Collection API's
`PortfolioAsset[]`) meets submission data.

| Field | Meaning |
|---|---|
| `totalPatterns` | Total distinct patterns in the catalog |
| `patternsWithSubmissions` / `patternsWithoutSubmissions` | Patterns with ≥1 submission record, and the complement |
| `patternsReadyOrBeyond` | Patterns with ≥1 submission at `READY`/`QUEUED`/`SUBMITTED`/`APPROVED` on any marketplace |
| `readinessRate` | `patternsReadyOrBeyond / totalPatterns * 100`, rounded to 1 decimal |

A submission whose `patternId` no longer matches any live catalog asset
(e.g. the asset was later deleted) is excluded from
`patternsWithSubmissions` and `patternsReadyOrBeyond` — it cannot
inflate either count past the catalog's own real size.

## Recommendation Engine (`recommendationEngine.ts`)

"Generate recommendations only. Never modify data." Every recommendation
is `{code, priority, message, relatedCount}`, produced by a fixed,
literal-order list of checks against the already-computed analytics
reports above — no randomness, no write calls reachable from this file
at all.

| Code | Fires when | Priority |
|---|---|---|
| `improve-seo` | `seoAnalytics.sampleSize > 0 && averageScore < 70` | high if `<50`, else medium |
| `complete-metadata` | `missingMetadataCount > 0` | high if more than half of submissions are missing metadata, else medium |
| `move-ready-to-submission` | `submissionAnalytics.ready > 0` | medium |
| `review-rejected` | `submissionAnalytics.rejected > 0` | high |
| `remove-duplicates` | `collectionAnalytics.duplicatePatternUsage.length + duplicateSubmissionConflictCount > 0` | high if any submission-level conflict exists, else low |
| `fill-empty-collections` | `collectionAnalytics.emptyCollections.length > 0` | low |

`duplicateSubmissionConflictCount` is passed in as an exact, pre-computed
number (from `portfolioHealthCalculator.ts`'s
`countDuplicateConflictingSubmissions`) rather than re-derived from
`PortfolioHealthScore.components.duplicateRisk`'s rounded percentage —
this avoids a rounding-introduced mismatch between what Portfolio
Health reports and what this recommendation's `relatedCount` says, for
the same underlying fact.

An empty portfolio produces an empty recommendation list — every check
above requires a positive count to fire, and every analytics field is
`0` with no data.

## Dashboard Snapshot (`dashboardSnapshot.ts`)

`buildDashboardSnapshot({collections, assets, submissions, now?})`
computes all 5 analytics reports above, the Portfolio Health score, and
the recommendation list from the same three input arrays, and returns:

```ts
{
  generatedAt: number;           // Date.now(), or the injected `now`
  portfolioHealth: PortfolioHealthScore;
  submissionAnalytics: SubmissionAnalytics;
  seoAnalytics: SeoAnalytics;
  collectionAnalytics: CollectionAnalytics;
  marketplaceAnalytics: MarketplaceAnalyticsEntry[];
  readinessAnalytics: ReadinessAnalytics;
  recommendations: Recommendation[];
}
```

`generatedAt` is the only field that is not a pure function of the
input — everything else is. See
`PORTFOLIO_DASHBOARD_ARCHITECTURE.md`'s "Determinism" section.

`portfolioDashboardService.ts`'s `loadDashboardSnapshot()` is the single
async entry point: it loads Collections/Portfolio/Submissions from their
existing stores and hands them to `buildDashboardSnapshot`. This is the
only place in the whole module that touches live storage.
