# SEO Intelligence Engine Architecture — Build 016 (Commercial Workflow's second module)

A production-grade SEO engine capable of generating, validating, and
scoring metadata for stock marketplaces. Service-layer only, no UI, no
marketplace upload — the second module in the Commercial Workflow track,
following Build 015's Submission Center Foundation.

## What this is, and isn't

Given a pattern's candidate title, description, and keyword list, this
engine tells you: is this content compliant with a given marketplace's
rules, how good is it (0-100, across several dimensions), what's wrong
with it (structured errors/warnings/suggestions), and — via the
generator — adapts it to fit a specific marketplace's bounds. It does
**not** invent creative copy from a pattern's visual content (it has no
access to that), and it does **not** upload anything anywhere.

## Layer map

```
app/src/catalog/seo/
  seoProfile.ts            SEO Profile — 5 built-ins + runtime-extensible registry
  keywordNormalizer.ts     Keyword Normalizer — canonical comparison form
  keywordDeduplicator.ts   Keyword Deduplicator — exact-duplicate removal
  keywordCoverage.ts       Keyword Coverage — 5-concept-bucket analysis
  keywordAnalyzer.ts       Keyword Analyzer — unified report (duplicates, similar, plural, ordering, coverage, noise)
  marketplaceRules.ts      Marketplace Rules — compliance-check functions over a SeoProfile
  titleAnalyzer.ts         Title Analyzer — 0-100 score, 5 dimensions
  descriptionAnalyzer.ts   Description Analyzer — 0-100 score, 5 dimensions
  seoValidator.ts          SEO Validator — never-throwing errors/warnings/suggestions
  seoScoring.ts             SEO Scoring — overall + 5 named sub-scores
  seoGenerator.ts           SEO Generator — marketplace-adapted package
  batchSeoService.ts        Batch SEO Service — single/multiple patterns x marketplaces
  index.ts                  Public barrel
```

Every one of the brief's 12 named modules maps to a real file above —
none were merged away or skipped. No storage layer exists in this
module: every function is a pure, synchronous computation over caller-
supplied strings — there is nothing here that needs persisting, so
(per the brief) no IndexedDB change was needed at all, not even the
isolated `localStorage` approach Build 015 used for Submission Center.

## Decoupling: three independent decisions, one rationale

The brief requires this engine to be "completely service-layer and
reusable," and separately forbids modifying the Collection API, Backup &
Restore, or Submission Center's architecture. Three deliberate
decoupling choices make all of that simultaneously true:

1. **Not built on `catalog/submission/marketplaceProfile.ts`.** Build
   015's `MarketplaceProfile` only carries what Submission Center's
   *readiness gate* needs (keyword count + description/category
   requiredness). This engine needs richer rules (title length bounds,
   per-keyword length limits, description length bounds) that don't
   belong bolted onto that narrower type. `seoProfile.ts` is its own
   registry, using the same 5 marketplace id strings
   (`shutterstock`/`adobestock`/`freepik`/`gettyimages`/`etsy`) so a
   future integration layer can bridge the two by id equality — without
   either module importing the other, and so without "modifying
   Submission Center architecture" even being a question.
2. **Not built on `src/marketplaces/*.json` / `metadata/marketplaceSeo.ts`.**
   That system is tightly coupled to the pattern generator's own
   `TileData` object and its own `buildSiteMetadata` copy-generation
   pipeline — a different concern (live-generation-time SEO) from this
   engine's (post-hoc, content-agnostic analysis of any candidate text).
   Real length/count bounds were still reused from those JSON profiles
   where one exists, for consistency between the two independent rule
   systems describing the same real marketplaces — but as *data*, never
   as a code dependency.
3. **`patternId` is a plain string everywhere it appears** (in
   `batchSeoService.ts`'s request/result types) — the same choice
   `catalog/submission/submissionRecord.ts` made for the same reason:
   this engine never needs to know what a pattern actually is, so it
   never imports `catalog/domain/types.ts`'s `PortfolioAsset`.

## Data vs. rule-evaluation split

`seoProfile.ts` (data: per-marketplace bounds) and `marketplaceRules.ts`
(evaluation: does this specific title/description/keyword list satisfy
those bounds) are deliberately separate files. Every other module that
needs a compliance answer — `seoValidator.ts`, the two content analyzers'
`complianceScore` dimension, `seoGenerator.ts`'s post-generation
adaptation — goes through `marketplaceRules.ts`'s three functions
(`checkTitleCompliance`, `checkDescriptionCompliance`,
`checkKeywordCompliance`), so there is exactly one implementation of "is
this within bounds" to get right, never several that could quietly
disagree.

## Composition, not duplication

`keywordAnalyzer.ts` composes `keywordDeduplicator.ts` (exact duplicates)
and `keywordCoverage.ts` (concept coverage) rather than re-implementing
either — it only adds the analysis unique to it (similarity, plural
conflicts, ordering, noise). `seoValidator.ts` composes
`marketplaceRules.ts` (errors), `keywordAnalyzer.ts` (warnings/
suggestions), and the two content analyzers (warnings) rather than
re-deriving any of their logic. `seoScoring.ts` reuses
`validateSeoContent`'s error/warning counts for its
`marketplaceCompatibility` dimension and the two analyzers' own `.score`
for its `titleScore`/`descriptionScore`. `seoGenerator.ts` calls both
`validateSeoContent` and `computeSeoScore` on the content it actually
produced (post-truncation/deduplication), never on the caller's raw
input. `batchSeoService.ts` adds zero new generation/scoring/validation
logic — it is purely fan-out over `seoGenerator.ts`.

## Honest scope: the SEO Generator adapts, it does not create

`seoGenerator.ts`'s module header states this explicitly: this engine has
no access to a pattern's visual content, so `generateSeoPackage` cannot
invent title/description copy from nothing. What it does is take
caller-supplied candidate content and adapt it to a specific
marketplace's constraints — deduplicate keywords, truncate the keyword
list to the count bound, truncate title/description at a word boundary
to the length bound — then validate and score the *result it actually
produced*. A future creative-copy generator (e.g. drawing on Trend
Intelligence Studio's keyword/style data) could sit in front of this
module without this module needing to change at all: it would simply
become another producer of the `SeoContentInput` this engine already
consumes.

## Explicitly out of scope for this build

- Any UI component, view, or button.
- Any automatic or manual marketplace upload — this engine only ever
  reasons about text, never transmits anything.
- Any modification to `docs/portfolio/COLLECTION_API_FREEZE.md`'s frozen
  surface, `catalog/backup/` (Backup & Restore), or
  `catalog/submission/`'s existing files (Submission Center) — none were
  touched; no production defect was found or claimed in any of them.
- Creative title/description generation from a pattern's actual visual
  design — see "Honest scope" above.
