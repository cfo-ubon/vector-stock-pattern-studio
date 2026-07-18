# Portfolio Health Score — Build 017

`computePortfolioHealth` (`app/src/catalog/dashboard/portfolioHealthCalculator.ts`)
produces a single 0-100 `overall` score plus the 6 named component
scores it is built from — the exact 6 the brief names: SEO Score,
Submission Readiness, Metadata Completeness, Duplicate Risk, Collection
Organization, Validation Status.

## Formula

`overall` is the **unweighted average of the 6 components, rounded to
the nearest whole number** — the same convention every scoring module
in this repo has used since `metadata/readinessScore.ts` (P2.5),
continued through `catalog/seo/seoScoring.ts` (Build 016). No component
is weighted more heavily than another; a future build could introduce
weighting, but this foundation deliberately keeps the formula legible
and equal-weighted.

```
overall = round( (seoScore + submissionReadiness + metadataCompleteness
                   + duplicateRisk + collectionOrganization
                   + validationStatus) / 6 )
```

Every component is independently bounded 0-100, so `overall` is too.

## The 6 components

### 1. SEO Score
`= seoAnalytics.averageScore` — the average overall SEO score
(`computeSeoScore`, unmodified from Build 016) across every submission's
own title/description/keyword snapshot. `0` when there are no
submissions to score.

### 2. Submission Readiness
`= readinessAnalytics.readinessRate` — the percentage of the catalog's
patterns that have at least one submission at `READY` or beyond
(`READY`/`QUEUED`/`SUBMITTED`/`APPROVED`). `0` for an empty catalog.

### 3. Metadata Completeness
`= (sampleSize - missingMetadataCount) / sampleSize * 100`, rounded to 1
decimal — the percentage of submissions with a non-empty title,
non-empty description, at least one keyword, and a category. `0` when
there are no submissions.

### 4. Duplicate Risk
`= (1 - conflictCount / recordCount) * 100`, rounded to 1 decimal — the
percentage of submissions with **no** duplicate-submission conflict, so
higher is safer (a portfolio with zero conflicts scores 100 here).
`conflictCount` comes from `countDuplicateConflictingSubmissions`,
which reuses Submission Center's own, unmodified
`detectDuplicateSubmission` (same-version / already-approved /
already-submitted conflict rules from Build 015) — no new duplicate
logic was written for this build. `0` when there are no submissions at
all.

**Why the count is a parameter, not always recomputed here:**
`countDuplicateConflictingSubmissions` is an O(n²) pass (every
submission checked against every other). `dashboardSnapshot.ts` already
needs the exact same count for `generateRecommendations`'s
`remove-duplicates` entry, so it computes the count once and passes it
into `computePortfolioHealth` as an explicit 5th argument, rather than
paying for the O(n²) pass twice in the same snapshot build. Standalone
callers (including this module's own tests) can omit the argument — it
defaults to a fresh `countDuplicateConflictingSubmissions(records)` call.

### 5. Collection Organization
`= collectionAnalytics.patternCount / readinessAnalytics.totalPatterns * 100`,
rounded to 1 decimal — the percentage of the catalog's total patterns
that belong to at least one collection. `0` when the catalog is empty.

### 6. Validation Status
`= (count of submissions whose SEO content validates with zero errors) / recordCount * 100`,
rounded to 1 decimal — each submission's snapshot content is re-checked
against its own marketplace's rules via `validateSeoContent`
(unmodified from Build 016); a submission "passes" here only if
`valid === true` (zero errors — warnings and suggestions don't count
against it, matching Build 016's own "warnings never affect `valid`"
rule). `0` when there are no submissions.

## Empty-portfolio behavior

An empty portfolio (no collections, no assets, no submissions) scores
`overall: 0` — every component above independently defines its own "no
data" condition as `0`, so there is nothing to average that could
produce a different result. This is a deliberate choice (documented
once on the module's header comment): an empty portfolio is neither
"perfectly healthy" nor "maximally at risk," it is simply unscored, at
its floor. `dashboardSnapshot.test.ts` and
`portfolioDashboardService.test.ts` both assert this directly.

## Determinism

Every component is a pure function of already-computed analytics
reports or the raw `SubmissionRecord[]`/`Collection`/`PortfolioAsset`
arrays — no randomness, no wall-clock reads anywhere in the formula
(only `DashboardSnapshot.generatedAt`, one level up, is time-stamped,
and it plays no role in any score). The same portfolio state always
produces the same `PortfolioHealthScore`, verified directly by
`portfolioHealthCalculator.test.ts` and, at scale, by
`dashboardLargeDataset.test.ts`'s determinism check.
