# Marketplace Intelligence Engine — Phase 5

This document covers the Marketplace Intelligence Engine Phase 5 milestone:
making the app genuinely understand the commercial requirements of every
supported marketplace, on top of the existing Marketplace Profile System
(v1.36) and Design Intelligence Core Phase 1's JSON-schema validation layer
— neither of which this phase redesigns.

## Contents

- [Scope decision](#scope-decision)
- [Architecture](#architecture)
- [Marketplace Profiles](#marketplace-profiles)
- [Marketplace Validation](#marketplace-validation)
- [SEO Hint Engine](#seo-hint-engine)
- [Filename Engine](#filename-engine)
- [Contributor Center](#contributor-center)
- [Marketplace Package Profile](#marketplace-package-profile)
- [Readiness Score](#readiness-score)
- [JSON Schemas](#json-schemas)
- [Developer Guide](#developer-guide)
- [Tests](#tests)
- [Remaining weaknesses](#remaining-weaknesses)
- [Recommendations for Phase 6](#recommendations-for-phase-6)

## Scope decision

By the time this milestone started, the app already had two working layers
this brief's sections overlap heavily with:

- **Marketplace Profile System** (`metadata/marketplaceProfiles.ts`,
  `metadata/marketplaceSeo.ts`, `metadata/marketplaceValidation.ts`,
  `metadata/filenameEngine.ts`, `metadata/exportPackage.ts`,
  `metadata/contributorLinks.ts`, v1.36) — already generated marketplace-
  specific Title/Description/Keywords/Filename, validated them against
  real per-site rules, built export-package text files, and linked to
  contributor portals for 6 marketplaces (Shutterstock, Adobe Stock,
  Freepik, Creative Fabrica, Creative Market, Etsy).
- **A parallel, unwired JSON mirror** (`src/marketplaces/*.json` +
  `src/marketplaces/index.ts`, Design Intelligence Core Phase 1) — a 1:1
  JSON port of the same profile data, already consumed by the Services
  layer (`services/marketplaceService.ts`, `services/keywordBundleEngine.ts`,
  `validators/relationshipValidator.ts`) but explicitly documented as "not
  a replacement yet" for the code-driven profiles everything else used.

Rather than rebuild either, this phase audited both and invested new
engineering effort specifically where the brief's 11 sections named a real,
honest gap:

- **Section 9 ("no hardcoded marketplace logic")** was the biggest
  structural gap: two parallel, drift-prone sources of the same profile
  data. **Fixed**: `metadata/marketplaceProfiles.ts` now *builds*
  `MARKETPLACE_PROFILES` from the real JSON (`src/marketplaces/*.json`)
  instead of a hardcoded TS object literal — one source of truth for
  every marketplace-aware module in the app, closing the exact gap Design
  Intelligence Core Phase 1's own report flagged as a "Phase 2
  recommendation."
- **Section 2 (Profile Content)** was missing 6 of the 17 named fields —
  Help URL, Guidelines URL, Submission/Analytics/Support URLs (only
  Contributor Portal existed), Collection Naming Rules, Supported File
  Types (only a single `extension` existed), Preview Requirements, and a
  real per-category Category Mapping (only a flat `defaultCategory`
  existed). **New**: all of the above, added to every marketplace's JSON
  profile.
- **Section 3 (Validation)** covered 4 of 9 named fields (Title/
  Description/Keywords/Filename). **New**: Collection Name, Asset Name,
  Preview, Export Package, and Display validation, plus a third
  `'suggestion'` severity tier (previously only error/warning).
- **Section 4 (SEO Hint Engine)** did not exist — every existing SEO
  generator (`marketplaceSeo.ts`, `trend/designSpecSeo.ts`) produces one
  final, committed answer and requires an already-generated `TileData`.
  **New**: `trend/seoHintEngine.ts` — runs from a Design Specification
  alone, before anything is generated, and returns candidates/ranges/
  advisory notes, never one committed string.
- **Section 5 (Filename Engine)** already had templates, customization,
  and dedup — genuinely complete. **Extended**: a Collection-Specification-
  aware batch filename builder (`trend/collectionPlan.ts`'s
  `buildCollectionMarketplaceFilenames`), since the brief explicitly names
  "Collection Specification JSON" as something this phase should consume.
- **Section 6 (Contributor Center)** had exactly 1 of 6 named link types
  (Portal only). **New**: Submission/Analytics/Help/Guidelines/Support,
  each with its own real-or-honestly-unverified URL, surfaced in the
  existing Stock Readiness cards UI.
- **Section 7 (Marketplace Package Profile)** existed only as a flat file-
  name list (`exportPackageFiles`). **New**:
  `buildMarketplacePackageProfile` assembles required files + supported
  file types + preview requirements into one structured object for a
  future export engine — no export/zip logic added.
- **Section 8 (Readiness Score)** existed only as scattered, differently-
  scoped signals (`submissionCenter.ts`'s Shutterstock-locked `analyzeSeo`,
  per-checklist-item statuses). **New**: `metadata/readinessScore.ts` — one
  real, per-marketplace score across all 5 named dimensions, assembled
  from data the existing SEO/validation/hard-reject modules already
  compute.

**Not touched**: SVG generation algorithms, the Design Intelligence Core's
services layer logic (only its JSON data files gained new fields, read the
same way as before), the Trend Intelligence Engine's own schema, upload
automation (no actual submission to any marketplace happens anywhere), or
Collection Engine internals.

## Architecture

```
src/
  marketplaces/
    *.json                 EXTENDED — 6 new fields per profile (Section 1/2/7)
    index.ts                EXTENDED — MarketplaceProfileData interface grows
  schemas/
    marketplaceProfile.schema.json  EXTENDED — validates the new fields
  metadata/
    marketplaceProfiles.ts  REWRITTEN — now loads from ../marketplaces (Section 9)
    contributorLinks.ts     REWRITTEN — derives from marketplaceProfiles.ts,
                             adds the 6-link-type MARKETPLACE_LINK_SETS (Section 6)
    marketplaceValidation.ts EXTENDED — 5 more checks + 'suggestion' severity (Section 3)
    exportPackage.ts        EXTENDED — buildMarketplacePackageProfile (Section 7)
    readinessScore.ts       NEW — Section 8, Readiness Score
    shutterstock.ts         EXTENDED — UNIVERSAL/CATEGORY_KEYWORDS exported for reuse
    submissionCenter.ts     EXTENDED — COMMERCIAL_TAG_CANDIDATES exported for reuse
  trend/
    seoHintEngine.ts        NEW — Section 4, SEO Hint Engine
    collectionPlan.ts       EXTENDED — buildCollectionMarketplaceFilenames (Section 5)
  components/
    StockSubmissionCenter.tsx EXTENDED — renders all 6 link types per marketplace
```

No existing module was rewritten from scratch — `marketplaceProfiles.ts`
and `contributorLinks.ts` changed their *data source*, not their public
shape (every existing field name, type, and consumer keeps working
unchanged). `marketplaceValidation.ts`, `exportPackage.ts`,
`shutterstock.ts`, and `submissionCenter.ts` were extended additively.

## Marketplace Profiles

Every marketplace's full profile now lives in one real, editable JSON file
under `src/marketplaces/` — e.g. `shutterstock.json`:

```json
{
  "id": "shutterstock", "label": "Shutterstock", "future": false,
  "contributorUrl": "...", "contributorUrlVerified": true,
  "titleRules": { "minLength": 20, "maxLength": 200 },
  "descriptionRules": { "required": true, "minLength": 20, "maxLength": 200 },
  "keywordRules": { "minCount": 7, "maxCount": 50, "termLabel": "keywords" },
  "filenameRules": { "template": "...", "maxLength": 100, "extension": "eps" },
  "defaultCategory": "Backgrounds/Textures",
  "exportPackageFiles": ["pattern.svg", "preview.png", "..."],
  "links": {
    "portal": { "url": "...", "verified": true },
    "submission": { "url": "...", "verified": true },
    "analytics": { "url": "...", "verified": false },
    "help": { "url": "...", "verified": false },
    "guidelines": { "url": "...", "verified": false },
    "support": { "url": "...", "verified": false }
  },
  "collectionNamingRules": { "template": "{primaryKeyword} Collection", "maxLength": 200 },
  "supportedFileTypes": ["svg", "eps", "png", "jpg"],
  "previewRequirements": { "minWidth": 1000, "minHeight": 1000, "format": "png", "notes": "..." },
  "categoryMapping": { "botanical": "Nature", "mandala": "Arts", "..." }
}
```

`metadata/marketplaceProfiles.ts` loads this via `../marketplaces`'s
`MARKETPLACE_DATA` and maps each entry into the same `MarketplaceProfile`
shape every consumer already used — adding a 7th marketplace is now one
new JSON file (registered in `marketplaces/index.ts`) plus one new branch
in `shutterstock.ts`'s `buildSiteMetadata` (the title/description/keyword
*text* generator, which profiles still don't own).

**Honesty notes, same convention the original Contributor Portal URLs
already established** (a `verified: false` flag rather than a confident-
sounding but unconfirmed URL):

- Every `links` entry that isn't a long-stable, well-known domain
  (currently: Adobe Stock's and Shutterstock's own Portal/Submission URLs)
  is `verified: false`. Many marketplaces route Submission/Analytics back
  into the same one contributor dashboard behind login — reusing the
  Portal URL for those is an honest choice, not a placeholder.
- `previewRequirements` states in its own `notes` field that the numbers
  are a conservative floor based on this app's own default PNG export
  size (3000×3000), not an independently-verified platform minimum.
- `categoryMapping` only exists for Shutterstock (ported 1:1 from
  `shutterstock.ts`'s pre-existing `SHUTTERSTOCK_SECONDARY` table — real
  data, not fabricated). Every other marketplace's `categoryMapping` is
  *absent*, not an empty/guessed object — `resolveMarketplaceCategory`
  honestly falls back to `defaultCategory` rather than inventing 5
  marketplaces' worth of category taxonomies this app has no verified
  basis for.

## Marketplace Validation

`metadata/marketplaceValidation.ts` now covers all 9 named fields:

| Field | Function | Severity used |
| --- | --- | --- |
| Title | `validateMarketplaceSeo` | error |
| Description | `validateMarketplaceSeo` | error/warning |
| Keywords | `validateMarketplaceSeo` | error/warning |
| Filename | `validateMarketplaceSeo` | error/warning |
| Collection Name | `validateCollectionName` (new) | suggestion/warning |
| Asset Name | `validateAssetName` (new) | warning |
| Preview | `validatePreview` (new) | error/warning |
| Export Package | `validateExportPackage` (new) | error |
| Display | `validateDisplay` (new) | suggestion |

`validateMarketplaceSubmission(input, profile)` runs the full surface in
one call, skipping any check whose input field isn't supplied (never a
false failure for data a caller doesn't have yet). `ValidationSeverity`
grew from `'error' | 'warning'` to include `'suggestion'` — a real,
non-blocking third tier (near-limit "this might get truncated" advice,
missing-but-not-required fields) that never affects `isMarketplaceReady`.

## SEO Hint Engine

`trend/seoHintEngine.ts`'s `buildSeoHints(spec, marketplaceId)` is
deliberately **not** `trend/designSpecSeo.ts`'s job — that module already
generates final, committed SEO and requires an already-built `TileData`.
The Hint Engine runs from the Design Specification alone, before any
pattern exists, and returns:

- `titleTarget`/`descriptionTarget`/`keywordCountTarget` — real ranges
  read straight off the marketplace's own profile.
- `keywordCandidates` — a generous, deduped candidate pool (2× the
  marketplace's own max) blending the Keyword Bundle's primary/secondary
  keywords, the matched generator category's real keyword set
  (`shutterstock.ts`'s `CATEGORY_KEYWORDS`, exported for reuse), and the
  universal seamless-pattern keyword pool (`UNIVERSAL`, also exported) —
  never a final trimmed list.
- `categorySuggestion` — via the new `resolveMarketplaceCategory`.
- `collectionNameSuggestion` — the profile's own `collectionNamingRules`
  template resolved with the spec's primary keyword.
- `hints` — real, rule-based advisory notes (low keyword-candidate count,
  future-ready marketplace, optional description, unverified contributor
  URL, default-category fallback) — every one traceable to a real
  condition, never generic copy.

## Filename Engine

`metadata/filenameEngine.ts` itself is unchanged (templates, user
customization via `customTemplate`, and `dedupeFilename` all already
existed and are genuinely complete). What's new is
`trend/collectionPlan.ts`'s `buildCollectionMarketplaceFilenames(collection,
marketplaceId)` — the Section 5 "Collection Specification JSON" consumer
requirement: one marketplace-optimized, deduped filename per pattern-type
asset in an already-generated Collection, built from each asset's own real
`GenerateParams` (`patternTiles`), reusing the Filename Engine's own
template resolution and dedup logic rather than re-implementing it.

## Contributor Center

`metadata/contributorLinks.ts` now exposes:

- `CONTRIBUTOR_LINKS` — the original single-URL (Portal only) list,
  backward compatible, now derived from `MARKETPLACE_PROFILES` instead of
  its own hardcoded array.
- `MARKETPLACE_LINK_SETS` — the full 6-link set (Portal, Submission,
  Analytics, Help, Guidelines, Support) per marketplace.
- `CONTRIBUTOR_LINK_TYPES` — the 6 link keys with display labels, for any
  UI that wants to iterate generically instead of hand-writing 6 buttons.

`components/StockSubmissionCenter.tsx`'s Stock Readiness cards render all
6 link types per marketplace (each opens in a new tab via a plain `<a
href>` — no automation, per the brief's explicit "do not implement upload
automation"), with the same honest `⚠️` marker unverified URLs already
used for the original single Contributor Portal link.

## Marketplace Package Profile

`metadata/exportPackage.ts`'s `buildMarketplacePackageProfile(marketplaceId)`
assembles the Section 7 "required export package" description — required
files, supported file types, primary format, and preview requirements —
into one structured object, entirely from the marketplace's own already-
real profile data. Per the brief's explicit "prepare metadata for future
export engine": no zip/file-writing code was added anywhere.

## Readiness Score

`metadata/readinessScore.ts`'s `computeMarketplaceReadiness(tileData,
marketplaceId)` unifies the 5 named dimensions into one real,
per-marketplace score:

- **SEO readiness** — title/keyword-count/keyword-quality compliance
  against this marketplace's own limits (from `validateMarketplaceSeo`'s
  real issues, filtered to the relevant codes).
- **Filename readiness** — filename validity/length against this
  marketplace's own rules.
- **Metadata readiness** — are title/description/keywords actually filled
  in at all (a blunter presence check, distinct from SEO readiness's
  limit-compliance check).
- **Marketplace compatibility** — does the underlying SVG structurally
  pass this app's own hard-reject rules (`engine/candidateEngine.ts`'s
  `applyHardRejectRules`, reused unmodified) — a pattern that fails this
  isn't compatible with *any* marketplace.
- **Commercial readiness** — real commercial-intent keyword coverage,
  reusing `submissionCenter.ts`'s own `COMMERCIAL_TAG_CANDIDATES` pool
  (exported for reuse, not duplicated).

`overall` is the unweighted average of the 5, 0-100. Deliberately distinct
from `submissionCenter.ts`'s pre-existing `analyzeSeo` (which is hardcoded
to read Shutterstock's own fields regardless of which site is asked
about) — every dimension here resolves against the *specific* marketplace
requested.

## JSON Schemas

`schemas/marketplaceProfile.schema.json` gained 4 new required top-level
properties (`links`, `collectionNamingRules`, `supportedFileTypes`,
`previewRequirements`) and one optional one (`categoryMapping`), validated
by the app's own hand-rolled, dependency-free JSON Schema validator
(`validators/jsonSchemaValidator.ts`, unmodified) — including a local
`$ref: "#/definitions/linkEntry"` for the repeated `{url, verified}` shape
across all 6 link types. Every real JSON profile file is asserted against
this schema in tests.

## Developer Guide

**Adding a 7th marketplace**: create `src/marketplaces/<id>.json` with
every field the schema requires (use an existing file as a template),
register it in `marketplaces/index.ts`'s `MARKETPLACE_DATA` array, and add
one branch to `shutterstock.ts`'s `buildSiteMetadata` for the actual
title/description/keyword text. `metadata/marketplaceProfiles.ts`,
`contributorLinks.ts`, validation, filenames, export packages, SEO hints,
and readiness scoring all pick it up automatically — no other file needs
to change.

**Adding a new Contributor Center link type**: extend
`MarketplaceLinks` in `marketplaces/index.ts`, add the field to every JSON
profile + the schema's `linkEntry`-shaped property list, and add an entry
to `contributorLinks.ts`'s `CONTRIBUTOR_LINK_TYPES` — the
`StockSubmissionCenter.tsx` UI iterates that list generically, so no
component change is needed.

**Adding a new validation check (Section 3)**: write a small, focused
function in `marketplaceValidation.ts` (see `validatePreview`/
`validateExportPackage` for the pattern — take exactly the real data you
need, return `ValidationIssue[]`), add its `code` to the union, and wire
it into `validateMarketplaceSubmission` behind an `if (input.x !==
undefined)` guard so callers without that data never get a false failure.

**Reading a marketplace's full commercial picture**: call
`computeMarketplaceReadiness(tileData, marketplaceId)` once — it already
assembles SEO generation, validation, and hard-reject checking, so there's
never a second source of truth to keep in sync.

## Tests

- `metadata/marketplaceProfiles.test.ts` (+8 tests) — `MARKETPLACE_PROFILES`
  built from real JSON (not a second hardcoded copy), every profile JSON
  file passes its own schema, all 6 link types present with real url+verified
  data, Collection Naming/Supported File Types/Preview Requirements present
  and real, `resolveMarketplaceCategory` resolves Shutterstock's real
  mapping and falls back to `defaultCategory` elsewhere.
- `metadata/marketplaceValidation.test.ts` (+21 tests) — every new check
  (Collection Name/Asset Name/Preview/Export Package/Display) covers its
  positive path, its real failure path, and the correct severity tier;
  `validateMarketplaceSubmission` skips absent fields and surfaces issues
  across every present section at once.
- `metadata/contributorLinks.test.ts` (NEW, 4 tests) — `CONTRIBUTOR_LINKS`
  and `MARKETPLACE_LINK_SETS` both trace to the same real profile data,
  `CONTRIBUTOR_LINK_TYPES` names exactly the 6 types in order.
- `trend/seoHintEngine.test.ts` (NEW, 11 tests) — runs without a `TileData`,
  targets/candidates/suggestions all trace to real profile/spec data,
  candidate pool is genuinely larger than the required minimum (never a
  pre-trimmed final answer), deterministic.
- `metadata/readinessScore.test.ts` (NEW, 7 tests) — every dimension 0-100
  for a real tile, marketplace compatibility is 100 for a structurally
  valid pattern, `overall` is the real unweighted average, future-ready
  marketplace flagged without being zeroed out, deterministic.
- `metadata/exportPackage.test.ts` (+2 tests) — `buildMarketplacePackageProfile`
  assembles real profile data, deterministic.
- `trend/collectionPlan.test.ts` (+4 tests) — `buildCollectionMarketplaceFilenames`
  produces one unique filename per pattern-type tile with the right
  extension per marketplace, in the real asset-id order, deterministic.
- `engine/borderCornerAssets.test.ts`, `validators/index.test.ts` — already
  covered the new JSON shape indirectly (unchanged, still passing).

**Full suite**: 1047/1047 tests passing across 75 files (`npx vitest run`),
up from 994 before this phase's additions. `npx tsc -b` and `npm run lint`
(oxlint) both clean.

**Browser verification**: generated a real pattern through the existing
(minimally extended) UI, scrolled to the Stock Readiness section, and
confirmed all 6 link types (Contributor Portal, Submission, Analytics,
Help, Guidelines, Support) render per marketplace card with the correct
honest `⚠️` unverified markers, zero console errors.

## Remaining weaknesses

- **`categoryMapping` only exists for Shutterstock** — the other 5
  marketplaces fall back to `defaultCategory` for every generator category,
  an honest limitation (see Marketplace Profiles above) rather than a
  fabricated table, but a real gap if per-category granularity turns out
  to matter for those sites' own upload forms.
- **`previewRequirements` numbers are a conservative internal floor, not
  independently verified against each marketplace's current published
  minimum** — each JSON file's own `notes` field says so explicitly; a
  future pass could research and confirm exact numbers per site.
- **The Readiness Score's `marketplaceCompatibility` dimension is binary**
  (0 or 100, from the hard-reject check) — it doesn't yet account for
  softer compatibility signals like tile size or aspect ratio fit per
  marketplace.
- **The SEO Hint Engine's keyword candidates aren't ranked by relevance
  score** — they're ordered by source priority (primary keyword first,
  then secondary, then category, then universal) rather than a real
  scored ranking.
- **No UI surfaces the SEO Hint Engine, Readiness Score, or Marketplace
  Package Profile yet** — all three are real, tested, callable modules,
  but (per this phase's "do not implement upload automation" / minimal-UI
  scope) only the Contributor Center's 6 link types got a UI hookup this
  phase.

## Recommendations for Phase 6

1. **Surface the SEO Hint Engine and Readiness Score in the UI** — a
   natural fit for the existing Trend Studio / Stock Submission Center
   panels, showing hints before generation and the unified score after.
2. **Research and confirm real per-marketplace preview requirements** —
   replace the conservative internal floor with each site's actual
   published minimum once verified.
3. **Extend `categoryMapping` to more marketplaces** as real per-category
   taxonomy data becomes available/verified for each one.
4. **Wire `buildMarketplacePackageProfile`/`buildCollectionMarketplaceFilenames`
   into the real export path** — `App.tsx`'s zip builder could consume
   these instead of its own ad hoc file lists, the same "Phase 6 wires up
   what Phase 5 prepared" pattern the Collection Engine's own
   `CollectionExportPrep` recommendation already follows.
5. **Rank SEO Hint Engine keyword candidates by a real relevance score**
   instead of source-priority ordering, once a scoring signal (e.g. search
   volume proxy, category-keyword co-occurrence) is available.
