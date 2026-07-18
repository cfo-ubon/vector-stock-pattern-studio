# SEO Scoring — Build 016

Every score in this engine is 0-100. This document covers every scoring
formula in one place: `titleAnalyzer.ts`, `descriptionAnalyzer.ts`,
`keywordAnalyzer.ts`'s scoring-relevant fields, and `seoScoring.ts`'s
unification of all of it.

## Title Score (`titleAnalyzer.ts`'s `analyzeTitle`)

Five dimensions, unweighted average, rounded:

| Dimension | Field | How it's computed |
|---|---|---|
| Length | `lengthScore` | 100 within `[minLength, maxLength]`; below min scales down proportionally (`length/min * 100`); above max loses 2 points per character over; empty title scores 0. |
| Keyword placement | `keywordPlacementScore` | Checks whether each of the first 3 keywords appears (case-insensitive substring) in the title, weighted 3/2/1 by position — an earlier keyword's presence matters more, since stock marketplace convention treats the title's own words as the most important keywords. No keywords given scores 100 (nothing to place). |
| Readability | `readabilityScore` | Starts at 100; -30 for under 3 words; -30 for over 20 words; -40 if the entire title is ALL CAPS; -20 if average word length exceeds 12 characters (likely keywords glued together rather than real words). |
| Duplicate words | `duplicateWordScore` | 100 minus 20 per word (3+ characters) that repeats within the title. |
| Marketplace compliance | `complianceScore` | 100 if `marketplaceRules.ts`'s `checkTitleCompliance` passes; otherwise 100 minus 40 per compliance reason that failed. |

`score = round((lengthScore + keywordPlacementScore + readabilityScore + duplicateWordScore + complianceScore) / 5)`

## Description Score (`descriptionAnalyzer.ts`'s `analyzeDescription`)

Five dimensions, same unweighted-average shape:

| Dimension | Field | How it's computed |
|---|---|---|
| Length | `lengthScore` | Same shape as title's length score, against the marketplace's description bounds. |
| Keyword coverage | `keywordCoverageScore` | Percentage of the given keywords that appear (case-insensitive substring) in the description text. No keywords given scores 100. |
| Natural language | `naturalLanguageScore` | Starts at 100; -40 if under 8 words; -30 if there is no sentence-ending punctuation (`.`/`!`/`?`) anywhere; -20 if comma count exceeds a third of the word count (the fingerprint of a keyword list pasted into the description field instead of real prose). |
| Readability | `readabilityScore` | Starts at 100; -30 if average words-per-sentence exceeds 30; -40 if the entire description is ALL CAPS. |
| Marketplace compliance | `complianceScore` | Same shape as title's compliance score, against `checkDescriptionCompliance`. |

**Special case**: an empty description on a marketplace that does **not**
require one (`profile.description.required === false`) scores 100 on
every dimension — there is genuinely nothing to evaluate, and an omitted
optional field is not a defect. A marketplace that *does* require a
description scores the empty case through the normal path above, which
correctly lands near zero (length 0, no natural language, no
compliance).

`score = round((lengthScore + keywordCoverageScore + naturalLanguageScore + readabilityScore + complianceScore) / 5)`

## Keyword Score (`seoScoring.ts`'s `computeKeywordScore`, private helper)

Built from `keywordAnalyzer.ts`'s `KeywordAnalysisReport`, itself an
average of three sub-signals:

1. **Cleanliness score**: 100 minus 10 per exact duplicate, minus 5 per
   similar-keyword pair, minus 8 per plural/singular conflict, minus 6
   per noise keyword — floored at 0.
2. **Coverage score**: `keywordCoverage.ts`'s `coverageScore` (percentage
   of the 5 concept buckets touched — technique/subject/color/useCase/
   format).
3. **Ordering score**: `keywordAnalyzer.ts`'s `orderingScore` (percentage
   of adjacent keyword pairs that follow the broad-to-specific
   convention, using word count as the specificity proxy).

`keywordScore = round((cleanlinessScore + coverageScore + orderingScore) / 3)`

## Marketplace Compatibility

Derived from `validateSeoContent`'s error/warning counts, using the same
"errors cost more than warnings, floor at 0" penalty shape this repo's
own `metadata/readinessScore.ts` already established for its
differently-scoped readiness score:

`marketplaceCompatibility = max(0, 100 - errorCount * 40 - warningCount * 15)`

## Commercial Readiness

Counts how many terms from a small, fixed commercial-intent list
(`seamless`, `vector`, `pattern`, `commercial use`, `editable`, `repeat`,
`tileable`, `print`, `wallpaper`, `textile`, `royalty free`, `license`)
appear anywhere in the keyword list (case-insensitive substring match),
capped at 100:

`commercialReadiness = min(100, matchedTermCount * 25)`

This is intentionally independent of `keywordCoverage.ts`'s concept-
bucket coverage score — coverage asks "does this touch several different
*search* concepts a buyer might use," commercial readiness asks the
narrower question "does this touch terms buyers use when they specifically
intend to license something for commercial use."

## Overall SEO Score

Unweighted average of the 5 named dimensions the brief requires, rounded
— deliberately the same "unweighted average of N real dimensions"
convention `metadata/readinessScore.ts` already established for its own
(differently-scoped) readiness score, applied here to an analogous
problem:

`overall = round((titleScore + descriptionScore + keywordScore + marketplaceCompatibility + commercialReadiness) / 5)`

For an unregistered marketplace, `titleScore` and `descriptionScore`
both fall back to 0 (there is no profile to analyze length/compliance
against) rather than throwing — `computeSeoScore` never throws, even
though the brief's explicit "never throw" requirement is scoped to `SEO
Validation` specifically; this function honors the same guarantee since
nothing about scoring should crash a caller either.

## Design rationale: why unweighted averages everywhere

Every combined score in this engine — title, description, keyword,
overall — is an unweighted average of its named sub-dimensions, never a
hand-tuned weighted formula. This is a deliberate simplicity choice
matching the brief's "structured, reusable" requirement: a weighted
formula requires someone to have decided (and be able to justify) that,
say, keyword placement matters 1.5x more than readability — a judgment
call with no real evidence behind it at this foundation stage. An
unweighted average is honest about that: every named dimension counts
equally until real usage data suggests otherwise.
