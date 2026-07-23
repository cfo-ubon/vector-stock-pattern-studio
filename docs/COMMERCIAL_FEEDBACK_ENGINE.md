# Commercial Feedback Engine — Build 026

`app/src/catalog/commercial/commercialFeedbackEngine.ts`

## What it is, and what it explicitly is not

The Commercial Feedback Engine reads **only real recorded outcomes** —
submission approvals/rejections, sales revenue/downloads, structured
rejection categories — and turns them into confidence-gated,
explainable insights about which dimensions of the pattern generator
(preset, Style DNA, composition type, pattern type) tend to get
approved, sell, or get rejected.

It is deliberately distinct from two other things that sound similar:

- **`dashboard/recommendationEngine.ts`** (Build 017) — a
  workflow-hygiene recommender (missing titles, stale drafts, duplicate
  risk). Never looks at real marketplace outcomes.
- **The generation-time Beauty/Commercial Score** — computed by the
  pattern generator's own quality critic
  (`qualityClassification.ts`'s `classifyQuality`) and persisted per
  evaluation in `QualitySnapshot`. This engine **never reads, writes, or
  overrides** any `QualitySnapshot`, `beautyScore`, or `commercialScore`
  field — it produces a completely separate report object. This is a
  hard rule from the brief: generation-time quality scoring and
  post-hoc commercial outcome analysis must never be conflated.

## Confidence gating

```ts
export const MIN_SAMPLE_SIZE_MODERATE_CONFIDENCE = 5;
export const MIN_SAMPLE_SIZE_HIGH_CONFIDENCE = 10;
```

Every insight's `confidence` (`'high' | 'moderate' | 'low'`) is capped by
`decidedCount` — the number of `APPROVED`/`REJECTED` submissions
actually attributable to that dimension value — regardless of how strong
the observed effect looks. A 100% approval rate on 2 submissions is
reported at `'low'` confidence, never `'high'`, because 2 is below
`MIN_SAMPLE_SIZE_MODERATE_CONFIDENCE`. These thresholds are named
constants specifically so the documented policy and the code enforcing
it can never silently drift apart.

## What one insight (`CommercialDimensionOutcome`) contains

For each dimension value (e.g. `presetId: "luxuryFloral"`):

- `sampleSize` — every submission for this value, any status.
- `decidedCount` / `approvedCount` / `rejectedCount` — the subset the
  confidence gate is keyed on.
- `approvalRate` — `null` when `decidedCount` is 0 (there is no rate to
  report, not even at low confidence).
- `netRevenue` / `downloads` — summed via `SalesEvent.productionAssetId`
  joined against `PortfolioAsset.productionAssetId`.
- `topRejectionCategories` — up to 3 most common rejection categories
  among this value's rejected submissions (see
  `docs/REJECTION_INTELLIGENCE.md`).
- `confidence` — capped per the rule above.
- `explanation` — a plain-English sentence stating the exact sample
  size, the rate, the portfolio baseline for comparison, and — whenever
  confidence is capped — exactly how many more decided submissions would
  raise it. Every insight explains itself; nothing is opaque.

## The four dimensions

```ts
export const COMMERCIAL_FEEDBACK_DIMENSIONS: CommercialDimension[] =
  ['presetId', 'styleDna', 'compositionType', 'patternType'];
```

## Report shape

`generateCommercialFeedback(input)` is a pure function — no storage
access, no side effects — taking already-loaded `assets`, `submissions`,
`salesEvents`, and `rejectionRecords`, and returning a
`CommercialFeedbackReport`: a portfolio-wide baseline approval rate plus
every dimension insight, sorted by `decidedCount` descending (most
statistically grounded first).

## Downstream consumer: Production Recommendations

`app/src/catalog/commercial/productionRecommendations.ts`
(`generateProductionRecommendations`) is the brief's "What Should I
Generate Next" engine. It reads this report's output as an *optional*
input and ranks candidate presets (from a caller-supplied
`availablePresetIds` list — it never invents a preset the caller didn't
supply) by three weighted factors:

- **Gap score** (50%) — `1 / (1 + existingAssetCount)`: fewer existing
  assets for a preset means a stronger case for generating more of it.
- **Internal diversity score** (30%) — among what already exists for a
  preset, how repetitive is it across `styleDna`/`compositionType`/
  `productTargets`/`colorPalette`? Only dimensions with at least one
  populated value among that preset's assets count toward the average,
  so a preset that simply never recorded a field isn't scored as
  "maximally repetitive" purely for lacking data.
- **Commercial boost** (20%) — the Commercial Feedback Engine's
  `approvalRate` for this preset, but **only** when that insight's own
  confidence is `'moderate'` or `'high'`. A `'low'`-confidence or missing
  insight contributes nothing — the same "never claim more than the data
  supports" rule propagated one layer further.

`maxExistingAssetsPerPreset` (default 25,
`DEFAULT_MAX_EXISTING_ASSETS_PER_PRESET`) is a hard duplicate-risk limit:
a preset at or past this many existing assets is excluded from
recommendations entirely (listed in `excludedDueToDuplicateRisk`),
regardless of how well it scores commercially — this engine can never
recommend flooding the portfolio with more near-duplicates of an
already-saturated preset.

Every recommendation carries a `reason` string explaining its own score
inputs in plain English — no opaque ranking. It never invents a specific
seed, palette, or SVG; seed/geometry generation stays the pattern
generator's own job, preserving deterministic replay. This module only
recommends the higher-level `presetId` and explains which lower-level
dimensions have been under-explored for it so far — a human still makes
the concrete generation choice.
