# Marketplace Rules — Build 016

The built-in `SeoProfile` data (`app/src/catalog/seo/seoProfile.ts`) and
how `marketplaceRules.ts` evaluates content against it.

## Built-in profiles

| Marketplace | Title length | Description | Keywords |
|---|---|---|---|
| Shutterstock | 20-200 | required, 20-200 | 7-50, max 60 chars each |
| Adobe Stock | 20-70 | optional, 0-200 | 7-49, max 60 chars each |
| Freepik | 20-100 | optional, 0-200 | 7-50, max 60 chars each |
| Getty Images | 20-200 | required, 20-200 | 7-50, max 60 chars each |
| Etsy | 10-140 | required, 40-5000 | 5-13, max 20 chars each |

Shutterstock, Adobe Stock, Freepik, and Etsy's bounds are reused from
this repo's own researched `src/marketplaces/*.json` profiles (title
and keyword rules; description bounds for the two "optional" ones are
this module's own conservative default of 0-200, since those JSON
profiles record `minLength`/`maxLength` as `0` for a field their own
site doesn't require at all). **Getty Images has no existing profile in
this repo** — its bounds here are a conservative estimate in the same
ballpark as the other stock-photo marketplaces (title 20-200,
description required, 7-50 keywords). Confirm against Getty's current
contributor documentation before treating this as verified; it is an
estimate, not a researched figure like the other four.

## Adding a marketplace without changing the engine

```ts
import { registerSeoProfile } from './catalog/seo/seoProfile';

registerSeoProfile({
  id: 'redbubble',
  label: 'Redbubble',
  builtin: false,
  title: { minLength: 5, maxLength: 100 },
  description: { required: false, minLength: 0, maxLength: 200 },
  keywords: { minCount: 3, maxCount: 30, maxKeywordLength: 40 },
});
```

The moment this call runs, `redbubble` is usable by every module that
resolves profiles through `getSeoProfile`/`listSeoProfiles` —
`marketplaceRules.ts`, both content analyzers, `seoValidator.ts`,
`seoScoring.ts`, `seoGenerator.ts`, and `batchSeoService.ts`'s
"every registered marketplace" default — with zero edits to any of
those files. `registerSeoProfile` throws `DuplicateSeoProfileError` if
the id is already registered (including a built-in), so a caller cannot
accidentally silently overwrite an existing profile's rules.

## Rule evaluation (`marketplaceRules.ts`)

Three functions, each returning `{ compliant: boolean; reasons: string[] }`
— every other module that needs a compliance answer goes through these,
never re-deriving bounds checks itself:

### `checkTitleCompliance(title, profile)`

- Empty title → non-compliant (`"Title is empty."`).
- Non-empty but under `title.minLength` → non-compliant.
- Over `title.maxLength` → non-compliant.
- A title can trigger both the min and max reasons only if it is
  simultaneously non-empty-but-short in one dimension and... in practice
  this never happens for the same string (a string is either too short
  or too long, never both) — but the function does not special-case that
  away since it is a natural byproduct of two independent checks, not a
  bug.

### `checkDescriptionCompliance(description, profile)`

- Empty AND the marketplace requires one → non-compliant
  (`"X requires a description."`).
- Non-empty but under `description.minLength` → non-compliant. (An
  empty description on a marketplace that does *not* require one is
  never flagged for being "too short" — it's legitimately absent, not a
  too-short value.)
- Over `description.maxLength` → non-compliant, regardless of whether
  the marketplace requires a description at all (a marketplace that
  doesn't require one can still reject one that's absurdly long).

### `checkKeywordCompliance(keywords, profile)`

- Fewer than `keywords.minCount` → non-compliant.
- More than `keywords.maxCount` → non-compliant.
- Any individual keyword longer than `keywords.maxKeywordLength` →
  non-compliant, with the count of over-long keywords in the message.

## How compliance feeds everything else

- **`seoValidator.ts`**: every non-compliance reason becomes one `error`-
  severity issue (`title-non-compliant`/`description-non-compliant`/
  `keyword-non-compliant`) — these are the *only* things that can make
  `SeoValidationReport.valid` false.
- **Title/Description analyzers**: `complianceScore` is 100 when
  compliant, otherwise `100 - reasons.length * 40` — one of the 5 equal-
  weighted dimensions in each analyzer's overall score (see
  `SEO_SCORING.md`).
- **`seoScoring.ts`**: `marketplaceCompatibility` is derived from the
  validator's error/warning *counts*, not from calling the rule
  functions a second time — one source of truth, reused.
- **`seoGenerator.ts`**: doesn't call these functions directly, but its
  truncation/deduplication logic exists specifically so the content it
  hands to the validator afterward is more likely to already be
  compliant (title/description length, keyword count) — the two modules
  work toward the same bounds independently.
