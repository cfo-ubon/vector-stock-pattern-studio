# Design Intelligence Core — Phase 1

Developer documentation for the data-first foundation added in this
milestone: JSON Schemas, editable JSON data libraries, a hand-rolled JSON
Schema validation engine, and a thin query/service layer over all of it.

**This phase shipped no UI and did not touch SVG generation.** Every file
here is new and additive; nothing under `engine/`, `generators/`,
`layouts/`, `components/`, `App.tsx`, or the already-shipped `trend/*`
module (Trend Intelligence Studio) was modified. See
["Relationship to the existing app"](#relationship-to-the-existing-app)
and ["Phase 2 recommendations"](#phase-2-recommendations) below for how
this layer is meant to eventually connect to the live app.

## Contents

1. [Architecture](#architecture)
2. [Folder structure](#folder-structure)
3. [Schema documentation](#schema-documentation)
4. [Developer guide](#developer-guide)
5. [Relationship to the existing app](#relationship-to-the-existing-app)
6. [Phase 2 recommendations](#phase-2-recommendations)

## Architecture

```
        ┌─────────────────┐
        │   /schemas       │  10 JSON Schema (draft-07 subset) documents —
        │   *.schema.json  │  the contract every data file below must satisfy.
        └────────┬─────────┘
                 │ validated by
        ┌────────▼─────────┐
        │   /validators     │  jsonSchemaValidator.ts   generic engine
        │                   │  index.ts                 schema registry + per-domain validators
        │                   │  relationshipValidator.ts cross-schema + marketplace-compatibility checks
        └────────┬─────────┘
                 │ consumes
   ┌─────────────┼─────────────────────────────────────────────┐
   │             │             │            │            │      │
┌──▼───┐   ┌─────▼────┐  ┌─────▼─────┐ ┌────▼─────┐ ┌────▼───┐ ┌▼──────────┐
│trend- │   │marketplaces│ │style-dna │ │pattern-  │ │motif-  │ │color-roles│
│packs  │   │           │  │          │ │grammar   │ │grammar │ │           │
└──┬───┘   └─────┬────┘  └─────┬─────┘ └────┬─────┘ └────┬───┘ └┬──────────┘
   │             │             │            │            │      │
   └─────────────┴─────────────┴──────┬─────┴────────────┴──────┘
                                       │ queried by
                              ┌────────▼─────────┐
                              │    /services      │  thin lookup/query wrappers,
                              │                    │  one per data library, plus
                              │                    │  keywordBundleEngine.ts
                              └────────────────────┘
```

Every data library is a **folder of individual JSON files + one `index.ts`
loader**. The JSON files are the actual editable data (the "no hardcoded
trend logic / marketplace rules / palettes / prompts" requirement); the
`index.ts` just imports them (via TypeScript's `resolveJsonModule`, no
runtime fetch/parse step), types them, and indexes them by `id` for O(1)
lookup. Nothing in `/validators` or `/services` hardcodes a trend, a
marketplace rule, a palette, or a prompt — they only read the JSON.

## Folder structure

```
app/src/
  schemas/                    10 JSON Schema (draft-07 subset) documents
    designSpecification.schema.json   full Design Specification shape
    trendPack.schema.json             full Trend Pack shape
    marketplaceProfile.schema.json    full Marketplace Profile shape
    keywordBundle.schema.json         full Keyword Bundle shape
    styleDna.schema.json              full Style DNA shape
    patternGrammar.schema.json        Pattern Grammar Library shape (new concept)
    motifGrammar.schema.json          Motif Grammar Library shape (new concept)
    colorRoleSystem.schema.json       Color Role System shape (new concept)
    palette.schema.json               one Palette shape
    qualityTarget.schema.json         Quality Target thresholds shape

  trend-packs/                 Trend Pack Library — 4 quarterly packs
    2026-Q1.json .. 2026-Q4.json, index.ts

  marketplaces/                Marketplace Profile System — 6 sites
    shutterstock.json, adobestock.json, freepik.json,
    creativefabrica.json, creativemarket.json, etsy.json, index.ts

  style-dna/                   Style DNA Library — 15 named identities
    editorialBotanical.json .. softWatercolorInspired.json, index.ts

  pattern-grammar/             Pattern Grammar Library — 6 composition styles (new)
    airy.json, balanced.json, dense.json, editorial.json,
    maximalist.json, minimal.json, index.ts

  motif-grammar/                Motif Grammar Library — 15 categories (new)
    geometric.json .. terrazzo.json, index.ts

  color-roles/                  Color Role System + Palette mirror (new)
    roleDefinitions.json, palettes.json (18 real palettes), index.ts

  validators/                   Validation Engine
    jsonSchemaValidator.ts      generic draft-07-subset validator (no deps)
    index.ts                    schema registry ($id -> schema) + one
                                 validate*Data() function per library
    relationshipValidator.ts    cross-schema + marketplace-compatibility checks
    *.test.ts

  services/                     Query/lookup layer, one file per library
    keywordBundleEngine.ts      deliverable #4: Keyword Bundle validation +
                                 Trend Pack / Style DNA suggestion
    trendPackService.ts
    marketplaceService.ts
    styleDnaService.ts
    patternGrammarService.ts
    motifGrammarService.ts
    colorRoleService.ts
    *.test.ts
```

## Schema documentation

All 10 schemas live in `src/schemas/`, are real [JSON Schema draft-07]
subset documents (`$schema`, `$id`, `type`, `properties`, `required`,
`additionalProperties`, `enum`, `items`, `minItems`/`maxItems`,
`minLength`/`maxLength`, `minimum`/`maximum`, `pattern`, `oneOf`, `$ref`,
`definitions`), and are registered by their own `$id` in
`validators/index.ts`'s `SCHEMA_REGISTRY` so any schema can `$ref` another
by filename.

| Schema | `$id` | Mirrors / introduces |
| --- | --- | --- |
| Design Specification | `designSpecification.schema.json` | `trend/designSpecTypes.ts`'s `DesignSpecification` — the single source of truth every downstream generator reads from. `$ref`s `keywordBundle.schema.json` and `qualityTarget.schema.json`; `trend` uses `oneOf [null, {...}]`. |
| Trend Pack | `trendPack.schema.json` | `trend/trendPacks.ts`'s `TrendPack`. |
| Marketplace Profile | `marketplaceProfile.schema.json` | `metadata/marketplaceProfiles.ts`'s `MarketplaceProfile`. |
| Keyword Bundle | `keywordBundle.schema.json` | `trend/designSpecTypes.ts`'s `KeywordBundle`. |
| Style DNA | `styleDna.schema.json` | `engine/styleDna.ts`'s `StyleDna`. |
| Pattern Grammar | `patternGrammar.schema.json` | **New.** Formalizes the implicit `COMPOSITION_STYLE_TO_HIERARCHY` / `COMPOSITION_STYLE_NEGATIVE_SPACE` lookup tables in `trend/designIntelligence.ts` as editable data: per composition style, which layouts/density/negative-space/flow/rhythm combinations are valid, plus named constraint `rules`. |
| Motif Grammar | `motifGrammar.schema.json` | **New.** Formalizes per-category composition rules that previously lived only implicitly inside each `generators/*.ts` file: which roles/complexity levels/orientation freedoms are valid per category, and which Pattern Grammars it composes well with. |
| Color Role System | `colorRoleSystem.schema.json` | **New.** Formalizes `trend/designIntelligence.ts`'s `deriveColorRoles()` fixed-position assignment (background/primary/secondary/accent) as editable `roleDefinitions.json`. |
| Palette | `palette.schema.json` | `palettes/palettes.ts`'s `Palette` — one curated color palette (`id`, `label`, `colors: string[]` of `#RRGGBB` hex). |
| Quality Target | `qualityTarget.schema.json` | `trend/designSpecTypes.ts`'s `DesignQualityTargets` — minimum score thresholds (0-100) a generated design should clear. |

[JSON Schema draft-07]: https://json-schema.org/draft-07/schema

## Developer guide

### Adding a new entry to a data library

1. Add a new `<id>.json` file to the library's folder (e.g.
   `pattern-grammar/newStyle.json`), matching that library's schema.
2. Import and add it to the `index.ts`'s exported array/`_BY_ID` map.
3. Add a test asserting the new entry passes its `validate*Data()`
   function (see `validators/index.test.ts` for the existing pattern —
   every real data file is asserted to validate cleanly against its own
   schema).

No code changes are needed anywhere else — every service/validator reads
the `index.ts` export, not a hardcoded list.

### Validating data

```ts
import { validateTrendPackData } from './validators';

const issues = validateTrendPackData(myTrendPackJson);
if (issues.length > 0) {
  // issues: Array<{ path: string; message: string }>
}
```

Every library has a matching `validate<Name>Data()` function in
`validators/index.ts`. Each is a thin wrapper around the generic
`validateAgainstSchema(data, schema, registry)` engine in
`validators/jsonSchemaValidator.ts`, pre-bound to that library's schema
and the shared `SCHEMA_REGISTRY` (so cross-file `$ref`s, like Design
Specification's `keywordBundle` field, resolve correctly).

### Validating relationships + marketplace compatibility

Schema validation alone can't catch "this `styleDnaId` doesn't exist" or
"this `repeatType` isn't valid for this `composition` style" — those are
cross-file relationship checks, in `validators/relationshipValidator.ts`:

```ts
import { validateDesignSpecificationRelationships } from './validators/relationshipValidator';

const issues = validateDesignSpecificationRelationships(designSpecLikeObject);
```

It checks: `marketplace.id` exists and its required export extension is
present in `exportHints.exportFormats`; `trend.trendPackId` (if set)
exists; `styleDnaId` exists; the palette has enough colors for the Color
Role System's `minPaletteColors`; `composition` names a real Pattern
Grammar whose `compatibleLayouts`/`densityRange`/`negativeSpaceRange`/
`compatibleFlowProfiles`/`compatibleRhythmProfiles` the spec's
`repeatType`/`density`/`negativeSpace`/`flow`/`rhythm` all satisfy; and
every motif reference (`heroMotifs`/`secondaryMotifs`/`fillers`) names a
real Motif Grammar category that allows the role it's used in and lists
the spec's `composition` as compatible.

### Querying a data library

Each library has a `services/<name>Service.ts` with `list*`/`get*`/
`find*By*` functions — no need to import the raw `*_DATA`/`*_DATA_BY_ID`
exports directly from application code:

```ts
import { getStyleDna, findStyleDnaByCategory } from './services/styleDnaService';
import { suggestTrendPacksForBundle } from './services/keywordBundleEngine';
```

## Relationship to the existing app

This is a **parallel, not-yet-wired-in** foundation. Every data file is a
faithful JSON port of an already-existing, still-live TypeScript source of
truth:

| New JSON data | Ported from (unmodified) |
| --- | --- |
| `trend-packs/*.json` | `trend/trendPacks.ts`'s `TREND_PACKS` |
| `marketplaces/*.json` | `metadata/marketplaceProfiles.ts`'s `MARKETPLACE_PROFILES` |
| `style-dna/*.json` | `engine/styleDna.ts`'s `STYLE_DNA_PRESETS` |
| `color-roles/palettes.json` | `palettes/palettes.ts` |

`pattern-grammar/*.json` and `motif-grammar/*.json` are **new concepts**
with no prior TS equivalent — they formalize logic that was previously
*implicit* (see the [schema table](#schema-documentation) above).

The already-shipped `trend/*` module (Trend Intelligence Studio) and all
SVG-generation code remain the live source of truth for the current app;
none of it reads from this new JSON layer yet.

## Phase 2 recommendations

1. **Wire, don't duplicate.** Replace each TS source-of-truth
   (`trend/trendPacks.ts`, `metadata/marketplaceProfiles.ts`,
   `engine/styleDna.ts`, `palettes/palettes.ts`) with a thin re-export from
   its JSON mirror here, so there's one editable copy instead of two.
   Lowest-risk order: `palettes.ts` first (smallest surface), then
   `trendPacks.ts`, `marketplaceProfiles.ts`, `styleDna.ts` last (most
   call sites).
2. **Wire the Validation Engine into the Trend Studio UI** — call
   `validateDesignSpecificationData` + `validateDesignSpecificationRelationships`
   before a Design Specification is committed/exported, surfacing issues
   in the existing `TrendStudioPanel.tsx` instead of only in tests.
3. **Wire Pattern Grammar / Motif Grammar into `designIntelligence.ts`** —
   replace `COMPOSITION_STYLE_TO_HIERARCHY`/`COMPOSITION_STYLE_NEGATIVE_SPACE`
   with lookups into `pattern-grammar/`, and use `motif-grammar/`'s
   `roles`/`compatiblePatternGrammars` to constrain which categories
   `designIntelligence.ts` picks as hero/secondary/filler for a given
   composition style — this directly fixes the class of bug the `dense-node-budget-risk`
   and `plaid-no-hero-role` rules describe (currently just advisory text,
   not enforced).
4. **Port `trend/keywordMap.ts`'s `KEYWORD_MAP`/`COMBO_RULES` to JSON** as
   a new `keyword-signals/` library, so `keywordBundleEngine.ts` can
   eventually absorb `resolveKeywordBundle()`'s token-matching logic
   instead of only doing cross-reference validation + suggestion.
5. **Add a `qualityTargets/` presets library** (e.g. "commercial-ready",
   "premium-wallpaper") mirroring `qualityTarget.schema.json`, so
   `DesignQualityTargets` stops being hand-typed per Design Specification.
