# SEO Intelligence Engine Test Report — Build 016

## Summary

```
Test Files  13 passed (13)
     Tests  118 passed (118)
  Duration  ~7-8s
```

Run with `npx vitest run src/catalog/seo/ --no-watch` from `/app`. Zero
failures, zero skipped tests. `npx tsc -b --force` and `npx oxlint
src/catalog/seo/` are both clean.

## Coverage by required test category

The brief mandates: Title scoring, Description scoring, Keyword
analysis, Deduplication, Coverage, Marketplace rules, Batch generation,
Large dataset, Regression. Every category is covered:

| Category | Test file(s) | Representative tests |
|---|---|---|
| Title scoring | `titleAnalyzer.test.ts` | length/keyword-placement/readability/duplicate-word/compliance dimensions individually, overall-score formula, well-formed vs. empty comparison |
| Description scoring | `descriptionAnalyzer.test.ts` | length/keyword-coverage/natural-language/readability/compliance dimensions, empty-optional vs. empty-required special cases |
| Keyword analysis | `keywordAnalyzer.test.ts` | duplicates, similar pairs, plural/singular conflicts, ordering quality, coverage integration, noise keywords |
| Deduplication | `keywordDeduplicator.test.ts`, `keywordAnalyzer.test.ts` (duplicates section) | case/whitespace-insensitive exact dedup, order preservation, near-duplicates deliberately NOT removed |
| Coverage | `keywordCoverage.test.ts` | zero/full/partial concept coverage, substring matching within phrases, case-insensitivity |
| Marketplace rules | `marketplaceRules.test.ts`, `seoProfile.test.ts` | title/description/keyword compliance checks against real profile bounds, profile registry (built-ins, runtime registration, duplicate rejection) |
| Batch generation | `batchSeoService.test.ts`, `seoGenerator.test.ts` | single pattern/single marketplace, single pattern/all marketplaces, multiple patterns x multiple marketplaces cross product, pattern isolation |
| Large dataset | `seoLargeDataset.test.ts` | 2,000 generated SEO packages (400 patterns x 5 marketplaces) |
| Regression | full-suite run (below) | 257 test files / 2,961 tests, no change outside `catalog/seo/` |

## Test files

### `seoProfile.test.ts` (7 tests)
Exactly the 5 required built-ins; every built-in resolves via
`getSeoProfile`; every profile's bounds are internally consistent
(min ≤ max); `isKnownSeoMarketplace` true/false; `registerSeoProfile`
adds a marketplace at runtime immediately visible to every lookup — the
concrete proof of "new profiles without changing the engine"; rejects
re-registering an existing id (including a built-in) with
`DuplicateSeoProfileError`; `resetSeoProfileRegistry` restores exactly
the built-ins.

### `keywordNormalizer.test.ts` (3 tests)
Trims/lowercases/collapses whitespace; idempotent; `normalizeKeywords`
drops whitespace-only entries.

### `keywordDeduplicator.test.ts` (6 tests)
No-op when there are no duplicates; case-insensitive exact dedup keeping
the first occurrence; whitespace-insensitive dedup; whitespace-only
entries dropped silently (not reported as duplicates); relative order
preserved; near-duplicates (not exact) deliberately left alone —
confirming that's `keywordAnalyzer.ts`'s job, not this module's.

### `keywordCoverage.test.ts` (5 tests)
Zero coverage for an empty list; full coverage when every concept bucket
is touched; partial coverage lists exactly the missing concepts;
concept terms match as substrings within multi-word keywords;
case-insensitive.

### `keywordAnalyzer.test.ts` (16 tests)
Duplicates via the same logic as the deduplicator; near-duplicate
similarity detection (small edit distance) without false-positiving on
unrelated keywords; a plural pair is never double-reported as also
"similar"; plural/singular conflicts for -s, -es, and y→ies patterns,
with no false positives on unrelated words; ordering quality scores 100
for broad-to-specific ordering and 0 for the reverse, with a 0/1-keyword
edge case scoring 100 by definition; a real `KeywordCoverageReport` is
embedded; noise-keyword detection for stopwords and too-short entries,
with no false positives on legitimate short real words.

### `marketplaceRules.test.ts` (12 tests)
Each of `checkTitleCompliance`/`checkDescriptionCompliance`/
`checkKeywordCompliance` tested against real profile bounds (Etsy's
tight 5-13 keyword / 10-140 title / 40-5000 required-description rules,
Adobe Stock's 70-character title cap) for both the compliant and every
non-compliant case.

### `titleAnalyzer.test.ts` (16 tests)
Length scoring in/below/above bounds and for an empty title; keyword
placement scoring with no keywords, a matching primary keyword, no
matches, and earlier-keyword-weighted-more-than-later; readability
penalizing ALL CAPS and too-short word count; duplicate-word detection
and its score impact; compliance scoring; the overall-score formula
verified against its own component sum; a well-formed title scoring
highly, an empty title scoring substantially worse than a well-formed
one.

### `descriptionAnalyzer.test.ts` (14 tests)
The empty-optional-description special case (all dimensions exactly
100); the empty-required-description case (scores poorly, `complianceScore`
and `score` both depressed); length scoring in/below/above bounds;
keyword coverage at 0%/50%/100%; natural-language scoring rewarding real
prose and penalizing a comma-joined keyword dump; readability penalizing
ALL CAPS; the overall-score formula verified against its own component
sum; a well-formed description scoring highly.

### `seoValidator.test.ts` (15 tests)
Never throws for an unregistered marketplace or completely empty
content (both explicitly asserted with `expect(() => ...).not.toThrow()`);
zero errors for well-formed content; `title-non-compliant`/
`description-non-compliant`/`keyword-non-compliant` errors for real rule
violations; `duplicate-keywords`/`plural-singular-conflict`/
`noise-keywords`/`duplicate-title-words` warnings; `missing-concepts`/
`keyword-ordering`/`description-not-natural-language` suggestions;
explicit proof that warnings and suggestions never affect `valid`.

### `seoScoring.test.ts` (6 tests)
Returns all 6 named scores, every one bounded 0-100; `overall` verified
against its own component-average formula; well-formed content scores
substantially higher than empty content; `marketplaceCompatibility`
drops when content violates marketplace rules; `commercialReadiness`
rewards commercial-intent keywords over unrelated ones; never throws for
an unknown marketplace (title/description scores fall back to 0).

### `seoGenerator.test.ts` (10 tests)
Throws `UnknownSeoMarketplaceError` for an unregistered marketplace
(the one place in this engine that *does* throw, deliberately, since the
brief's "never throw" requirement is scoped to SEO Validation);
deduplicates keywords; truncates the keyword list to the marketplace
maximum (and does not touch a list already within bounds); truncates an
individual over-long keyword to the per-keyword limit; truncates an
over-long title at a word boundary (never mid-word, verified via
`startsWith`) and leaves an in-bounds title untouched; truncates an
over-long description at a word boundary; leaves an empty description
empty rather than inventing copy; validation and score are proven to
reflect the *generated* (post-truncation) content, not the raw input.

### `batchSeoService.test.ts` (7 tests)
Single pattern/single marketplace carries the right ids through;
single pattern/multiple marketplaces defaults to every registered
marketplace when unspecified and to exactly the requested subset
otherwise, with every result carrying the same pattern id; multiple
patterns x multiple marketplaces produces the full cross product; one
pattern's content is proven not to leak into another's result; an empty
request list returns an empty result list.

### `seoLargeDataset.test.ts` (1 test, "Large dataset" category)
400 patterns × 5 built-in marketplaces = 2,000 generated SEO packages in
one `generateBatchSeo` call. Verifies: completes in well under 10
seconds; every one of the 2,000 results has a real, in-range (0-100)
overall score and a real validation report (exhaustively checked, not
sampled); marketplace-specific generation held at scale (exactly 400
packages per marketplace, each correctly tagged); Etsy's tight 13-keyword
cap held for all 400 of its packages; pattern identity preserved
end-to-end for a spot-checked sample. 30-second test timeout; observed
runtime well under that.

## Regression

Full pre-existing suite re-run alongside this new work with no change to
any file outside `app/src/catalog/seo/`:

```
Test Files  257 passed (257)   (was 244 before Build 016 — +13 new files)
     Tests  2961 passed (2961) (was 2843 before Build 016 — +118 new tests)
```

Two transient timeouts were observed on separate full-suite runs, in
`src/collection/collectionGenerator.test.ts` and
`src/workbench/workbenchImportExport.test.ts` /
`src/components/workbench/ImportExportBar.test.tsx` — pre-existing,
CPU-heavy generative tests unrelated to this build (neither this build
nor any prior session touched any of those three files). Both were
confirmed to pass cleanly when re-run in isolation, consistent with
environment-load-driven flakiness under the full 257-file parallel run
rather than a real regression. No change to
`catalog/domain/collection.ts`, `catalog/domain/collectionMembership.ts`,
`catalog/storage/collectionStore.ts`, `catalog/services/collectionService.ts`
(the frozen Collection API surface, still guarded by
`collectionApiFreeze.test.ts`, which passed unmodified), to any file
under `catalog/backup/` (Backup & Restore, P3), or to any file under
`catalog/submission/` (Submission Center, Build 015).

## Known gaps

- No dedicated performance/soak test beyond the single 2,000-package
  large-dataset case — out of scope for a foundation build whose brief
  asked for large-dataset *correctness*, not a new performance baseline.
- Similarity detection (`keywordAnalyzer.ts`) uses a conservative
  Levenshtein-distance heuristic (distance 1-2, both keywords ≥4
  characters) — not tested against a large adversarial corpus of real-
  world near-duplicate keyword pairs, only hand-picked representative
  cases.
- No UI-level test, since no UI was built this phase.
