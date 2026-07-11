# Commercial Collection Engine — Phase 4

This document covers the Commercial Collection Engine Phase 4 milestone:
turning a single Design Specification into a fully coordinated commercial
collection, on top of the existing Collection Studio Engine (v1.33) and
Design-Spec-driven Collection Generator (v1.36 Phase 5) — neither of which
this phase redesigns.

**Phase 4b addendum**: a follow-up, more detailed brief for the same-named
milestone arrived after the first Phase 4 pass shipped (v1.39). Rather than
duplicate what already existed, Phase 4b audited it against the new brief's
sections and closed the genuine remaining gaps: the 2 missing named asset
kinds (Dense Pattern, Airy Pattern), the 3 missing Color Story variants
(Earth Tone, Luxury, Pastel), a real Motif Reuse Engine (Section 6 — new;
the first pass never built one), `CollectionPlan`'s own `marketplaceTargets`
field, `CollectionSpecification`'s `motifVariants` field, Section 10's
remaining named preview fields (Collection Cover, Asset Order, Palette/
Layout Story, Motif Family description), and Section 12's collection-size
scaling (10/25/50/100 assets). Sections of this doc below are updated
in-place to reflect the current, combined state — additions are called out
explicitly as "Phase 4b" where the distinction matters.

## Contents

- [Scope decision](#scope-decision)
- [Architecture](#architecture)
- [Collection Engine](#collection-engine)
- [Collection JSON Schema](#collection-json-schema)
- [Developer Guide](#developer-guide)
- [Tests](#tests)
- [Performance](#performance)
- [Remaining weaknesses](#remaining-weaknesses)
- [Recommendations for Phase 5](#recommendations-for-phase-5)

## Scope decision

By the time this milestone started, the app already had two working layers
this brief's sections overlap heavily with:

- **Collection Studio Engine** (`collection/collectionGenerator.ts`,
  `collection/collectionScore.ts`, `engine/motifFactory.ts`,
  `engine/borderCornerAssets.ts`, v1.33) — already generated a 10-asset
  commercial collection (Hero/Secondary/Blender/Mini/Stripe patterns,
  Border/Corner assets, Spot Motif Sheet, Decorative Elements Sheet,
  Collection Preview) sharing one Style DNA/palette/motif family, with a
  real 5-dimension Collection Score.
- **Collection Generator** (`trend/designSpecCollection.ts`, v1.36 Phase 5)
  — already wired that engine directly to a Design Specification JSON.

Rather than rebuild either, this phase audited both and invested new
engineering effort specifically where the brief's 12 sections named a real,
honest gap:

- **Section 1 (Collection Planner)** and **Section 7 (Collection JSON)**
  had no dedicated "plan" or "specification" object — the manifest existed,
  but nothing assembled Collection Name/Theme/Category/Marketplace/Style
  DNA/Color Story/Product Uses/Size/Version into one high-level brief.
  **New**: `trend/collectionPlan.ts`.
- **Section 2 (Collection Structure)** was missing 2 of the 10 named asset
  types (Background Texture, Individual Motifs). **New**: both, added to
  `collection/collectionGenerator.ts`.
- **Section 3 (Color Story Engine)** did not exist — the app's existing
  "colorStory" concept (`GenerateParams.colorStory`) is an unrelated
  boolean toggle for dominant/accent color role split within *one*
  palette, not palette *variant* generation. **New**:
  `palettes/colorTransform.ts` + `collection/colorStory.ts`.
- **Section 5 (Layout Variation)** was partially real (Secondary Pattern
  already got a distinct layout) but Mini Pattern silently inherited Hero
  Pattern's layout. **Fixed**: `allocateLayout` in
  `collection/collectionGenerator.ts` now guarantees every pattern-type
  asset gets a genuinely distinct layout.
- **Section 6 (Product Targets)** did not exist at all. **New**:
  `collection/productTargets.ts`.
- **Section 9 (Collection Quality)**'s "Variation"/"Motif diversity"/
  "Layout diversity" dimensions did not exist — the existing Collection
  Score only measured *consistency* (do assets agree), never *diversity*
  (are assets meaningfully different). **New**: two real dimensions added
  to `collection/collectionScore.ts`.
- **Section 4 (Motif Consistency)** and **Section 8 (Collection Preview)**
  were mostly already real (motif sharing via `generateMotifSet`,
  `verifyConsistency`, the visual preview composite) — this phase
  strengthened Section 4 (factory-motif family check, not just pattern
  params) and added Section 8's structured *preview metadata* (the visual
  preview SVG itself, `buildCollectionPreview`, is untouched).
- **Section 10 (Export Preparation)** — structured data only, per the
  brief's explicit "do not implement export yet." **New**:
  `prepareCollectionExport` in `trend/collectionPlan.ts`; no zip/download
  logic was added anywhere.

**Not touched**: SVG generation algorithms (`engine/tile.ts`,
`generators/*`, `layouts/*` themselves), the Design Intelligence Core, the
Trend Intelligence Engine's schema, Marketplace modules, SEO, Prompt
Factory, or any UI component.

### Phase 4b scope decision

The follow-up brief's sections mapped onto the already-shipped Phase 4 code
as follows:

- **Section 2 (Collection Structure)**: 10 of 12 named asset kinds already
  existed (Coordinate Pattern under the pre-existing `blenderPattern`
  alias). **New**: `densePattern`/`airyPattern`, reusing the already-
  registered `densePremium`/`airy` layouts (Project PHOENIX's Cluster
  Composition Engine, unmodified).
- **Section 4 (Color Story Engine)**: 10 of 13 named variants already
  existed. **New**: Earth Tone, Luxury, Pastel — 3 more `VARIANT_TRANSFORMS`
  entries in `collection/colorStory.ts`, same pattern as the existing 7.
- **Section 5 (Layout Variation Engine)**: the brief names Editorial/
  Organic Scatter/Diagonal/Border as strategies. These already exist, just
  one layer down — as Cluster Composition Engine archetypes
  (`engine/clusterEngine.ts`'s `'editorial'|'organicScatter'|'diagonal'`)
  used *inside* the `heroFlow`/`scatter`/`toss` layouts, and as Border's own
  dedicated (non-tile) builder (`engine/borderCornerAssets.ts`). No new
  `LayoutId` was added — that would duplicate engine work the brief
  explicitly says not to redesign. Honestly documented here rather than
  silently claimed as literal new layouts.
- **Section 6 (Motif Reuse Engine)**: did not exist at all — Border,
  Corner, and Decorative Elements Sheet each independently generated their
  own motif set from a different seed, so nothing was ever *actually*
  shared, even though they looked similar. **New**:
  `collection/motifReuse.ts`, plus a real shared `fillerMotifPool` in
  `collectionGenerator.ts` (see below).
- **Section 1/7/8 gaps**: `CollectionPlan` had `targetMarketplace` (single)
  but the brief names "Marketplace Targets" (plural) as a Plan-level field;
  `CollectionSpecification` had no `motifVariants` key; `CollectionPreviewMetadata`
  had no Collection Cover / Asset Order / Palette Story / Layout Story /
  Motif Family fields. **New**: all of the above, in `trend/collectionPlan.ts`.
- **Section 12 (Performance)**: `collectionSize` was tracked as metadata
  only, never wired into generation, and the fixed asset count (~27) was
  already inside the 10/25 tiers but not 50/100. **New**: a reuse-first
  padding mechanism in `generateCollection` (see Performance below).

**Not touched in 4b either**: the same exclusion list as the first pass,
plus no changes to `engine/clusterEngine.ts`, `engine/heroComplexity.ts`,
or any other Project PHOENIX file — Dense/Airy asset types consume those
layouts as-is.

## Architecture

```
src/
  palettes/
    colorTransform.ts     NEW — hex<->HSL math (Section 3's building block)
  collection/
    colorStory.ts         NEW — Section 3, Color Story Engine (13 variants incl. Phase 4b's 3)
    productTargets.ts     NEW — Section 6, Product Targets
    motifReuse.ts          NEW (Phase 4b) — Section 6, Motif Reuse Engine
    collectionGenerator.ts EXTENDED — Sections 2, 4, 5 (schema v2->v3->v4, additive)
    collectionScore.ts    EXTENDED — Section 9, two new real dimensions
  trend/
    collectionPlan.ts     NEW — Sections 1, 7, 8, 10
  project/
    projectManager.ts     EXTENDED — normalizeProject backfills patternTiles
                           for collections persisted before this phase
```

No existing module was rewritten. `collection/collectionGenerator.ts` and
`collection/collectionScore.ts` were extended additively (new fields, new
asset types, new score dimensions) — every existing field, asset id, and
the fixed `patternParams` 5-element hero/secondary/blender/mini/stripe
order `components/ProjectPanel.tsx` indexes into are unchanged.

## Collection Engine

### Color Story Engine (`palettes/colorTransform.ts`, `collection/colorStory.ts`)

`palettes/colorTransform.ts` is generic hex<->HSL math (`hexToHsl`,
`hslToHex`, `adjustLightness`, `adjustSaturation`, `rotateHue`,
`setLightness`, `setHue`) with no knowledge of palettes or collections.

`collection/colorStory.ts`'s `buildColorStory(baseColors)` derives all 13
named variants from one base color set, deterministically:

| Variant | Transform |
| --- | --- |
| Original | passthrough |
| Light | lightness +18, saturation −6 |
| Dark | lightness −20, saturation +4 |
| Muted | saturation −30 |
| Bold | saturation +25, lightness −3 |
| Spring | hue +8°, saturation +10, lightness +6 (warm, bright, light) |
| Summer | hue −6°, saturation −12, lightness +10 (cool, soft, light) |
| Autumn | hue +20°, saturation +5, lightness −8 (warm, deep, muted) |
| Winter | hue −15°, saturation +8, lightness −12 (cool, deep, contrast) |
| Monochrome | every color's hue set to one shared hue (the palette's second color's hue — index 0 is the background), lightness untouched so a real light-to-dark ramp survives |
| Earth Tone *(Phase 4b)* | hue +18°, saturation −28, lightness −10 (warm, desaturated, deepened — ochre/terracotta) |
| Luxury *(Phase 4b)* | hue −12°, saturation +18, lightness −18 (deep jewel-tone — emerald/sapphire/aubergine) |
| Pastel *(Phase 4b)* | saturation −22, lightness +30 (very light, softly desaturated) |

The four seasonal variants follow the standard "4-season color analysis"
convention real colorists use — not an invented scheme. Every variant keeps
the same color count and background/accent ordering as the input (index 0
stays the background color in every variant, transformed like every other
color, not left untouched — a "Dark" variant's background genuinely reads
as dark).

### Product Targets (`collection/productTargets.ts`)

`evaluateProductTargets({categoryId, tileSize, density, keywordText})`
scores all 10 named product uses (Wallpaper, Fabric, Wrapping Paper, Gift
Wrap, Packaging, Notebook Covers, Stationery, Home Decor, Textile, Digital
Paper). Each product has a real rule: keyword hints (explicit intent, e.g.
"gift wrap" in the commercial category/keywords), well-suited generator
categories, and tile-size/density fit bands. A score is the sum of exactly
which rules fired (baseline 40, +35 keyword match, ±10 tile-size fit, ±10
density fit, +15 well-suited category), clamped 0-100, with every bump/cut
traceable in the result's `reasons` array — no fabricated confidence
number. `recommendedProductUses` takes the top-scoring, "suitable"
(score ≥ 60) subset for the Collection Plan's single recommendation field.

### Collection Structure (`collection/collectionGenerator.ts`)

Two new asset types, both real `buildTile`/`FactoryMotif` output, nothing
placeholder:

- **Background Texture** — a subtle, low-contrast, tone-on-tone wash for
  digital-paper/background-layer use. Built via `buildTile` with the
  collection's own actual resolved colors (`heroTile.colors`) run through
  the Color Story Engine's "Light" variant, a reduced color count, smaller
  motif size, and a `gridMinimal`-preferred layout. Deliberately excluded
  from the CSV/metadata pattern list (it is not a 6th sellable focal
  pattern) — the same way Border/Corner assets already were.
- **Individual Motifs** — 6 of the collection's own hero motifs (reused
  directly from the existing Spot Motif set, not regenerated), each
  centered and exported as its own standalone SVG document. Grows past 6
  when a larger `collectionSize` is requested — see Performance below.

**Phase 4b** adds the remaining 2 named asset kinds:

- **Dense Pattern** — a real, independent `buildTile` output on the
  `densePremium` layout (Project PHOENIX's Cluster Composition Engine,
  unmodified), density ×1.4, negative space reduced, `denseLayered`
  hierarchy preset.
- **Airy Pattern** — the density-inverse: `airy` layout, density ×0.55,
  negative space increased, `minimalRepeat` hierarchy preset.

Both are appended to `patternTiles` (never `patternParams`, same rule
Background Texture already followed) and — unlike Background Texture,
which is a background-layer wash — are real sellable focal patterns, so
they're included in the SEO CSV pattern list Background Texture is
deliberately excluded from.

### Motif Reuse Engine (`collection/motifReuse.ts`, Phase 4b)

Before Phase 4b, Border, Corner, and the Decorative Elements Sheet each
called `generateMotifSet` independently with a different seed — three sets
that *looked* like the same family (same category/palette) but shared zero
actual motif ids. Section 6 asks for genuine reuse (Shared Fillers, Shared
Decorative Elements), not just family-level similarity.

`collectionGenerator.ts` now builds one `fillerMotifPool` (8 motifs, role
`filler`) and passes the *same array* to both `buildBorderStrip` (all 4
edges) and `buildCornerUnit` (all 4 corners), plus the first 4 slots of the
Decorative Elements Sheet — 9 assets now genuinely reference the same
underlying motif geometry, each with its own real rotation/scale variant
(`engine/borderCornerAssets.ts`'s builders now return a `placements` array
alongside the SVG, recording exactly which motif id got which variant at
each spot — additive, non-breaking).

`collection/motifReuse.ts`'s `buildMotifReuseReport(relationships, motifs,
placements)` aggregates the manifest's real asset↔motif relationships into:

```ts
interface MotifReuseReport {
  sharedHeroMotifs: MotifReuseEntry[];        // role === 'hero', reuseCount > 1
  sharedLeaves: MotifReuseEntry[];            // family === 'leaf', reuseCount > 1
  sharedFillers: MotifReuseEntry[];           // role === 'filler', reuseCount > 1
  sharedDecorativeElements: MotifReuseEntry[]; // role === 'accent', reuseCount > 1
  totalDistinctMotifs: number;
  reusedMotifCount: number;
  reuseRatio: number; // 0-100
}
```

Every field is read off already-computed data — no regeneration, no
guessing. `sharedHeroMotifs` picks up the pre-existing Spot Motif Sheet ↔
Individual Motifs sharing "for free" (that reuse already existed before
Phase 4b; the report just now measures it). `sharedLeaves` is honestly
scoped to real `MotifFamily === 'leaf'` motifs — empty for a category with
no leaf-family motifs (e.g. geometric/mandala), non-empty for
tropical/some botanical collections; this codebase has no "leaf" *role*,
only a "leaf" *family*, and this report doesn't invent one.

`GeneratedCollection.motifReuse` carries this report; `CollectionSpecification.motifVariants`
(Section 7/8) surfaces the same data in the JSON spec.

### Layout Variation (`allocateLayout`)

```ts
function allocateLayout(preferred: LayoutId, used: Set<LayoutId>): LayoutId {
  if (!used.has(preferred)) return preferred;
  const idx = LAYOUT_LIST.findIndex((l) => l.id === preferred);
  for (let i = 1; i <= LAYOUT_LIST.length; i++) {
    const candidate = LAYOUT_LIST[(idx + i) % LAYOUT_LIST.length].id;
    if (!used.has(candidate)) return candidate;
  }
  return preferred;
}
```

Every pattern-type asset now gets a `preferred` layout with real design
intent (Secondary: a Style DNA alternate family member or the next
registry layout; Blender: `scatter`; Mini: `halfDrop`, a conventional
small-scale ditsy repeat; Background Texture: `gridMinimal`; Stripe:
`stripe`) and `allocateLayout` guarantees it never collides with an
already-used layout. With 14 registered layouts and at most 6 pattern-type
assets, collisions are resolved well before the list is exhausted.

### Motif Consistency (`verifyConsistency`)

Extended with an optional second parameter — the collection's full
factory-generated motif set — checking that every border/corner/spot/
decorative/individual motif shares one `category` (motif family), not just
the 5 core pattern-type assets' params. Backward compatible: the parameter
defaults to `[]`, so every existing caller is unaffected.

### Collection Quality (`collection/collectionScore.ts`)

Two new real dimensions, added to the existing 5 (Style/Palette/Motif/Flow
Consistency + Commercial Readiness):

- **Layout Diversity** — `distinct layoutIds / total pattern-type tiles`,
  read from the new `patternTiles` field. 100 for a real generated
  collection by construction (`allocateLayout`'s guarantee).
- **Motif Shape Diversity** — Shannon-entropy diversity of shape-topology
  signatures (rotation/scale/position-invariant) pooled across every
  pattern-type tile's placed motifs, reusing
  `engine/svgGeometry.ts`'s `extractMotifShapeSignatures` (the SVG
  Intelligence Engine's own primitive — consumed, not modified) at
  collection scope instead of per-tile scope. Not expected to hit a
  perfect 100 even in a healthy collection (generators reuse shapes across
  placements; that's normal, not a bug) — this is a deliberately honest,
  non-fake measurement.

`overall` is now a 7-dimension average; `REQUIRED_ASSET_TYPES` grew from
10 to 12 core creative asset types in the first Phase 4 pass, then 12 to 14
in Phase 4b (adding `densePattern`/`airyPattern`).

### Collection Planner (`trend/collectionPlan.ts`)

Pure orchestration — consumes the Design Specification JSON and an
already-generated `GeneratedCollection`, never re-implements SVG
generation or scoring:

- `buildCollectionPlan(spec)` — Section 1. Works from the spec alone (no
  generated collection required): name (reuses
  `designSpecSeo.ts`'s `buildDesignSpecCollectionName`), theme (Trend Pack
  theme or primary keyword), commercial category, target marketplace, a
  Phase 4b-added plural `marketplaceTargets` (primary marketplace plus the
  active Style DNA's curated recommended sites — the same real data
  `CollectionSpecification.marketplaceTargets` already derived, now also on
  the Plan itself per Section 1's own field list), Style DNA id, full Color
  Story (from `spec.palette.colors`), recommended product uses, collection
  size, and `collectionVersion` (the real `COLLECTION_SCHEMA_VERSION`, not
  an invented parallel number).
- `buildProductTargets(spec)` — Section 6's full 10-product evaluated
  table (not just the Section 1 recommended subset).
- `buildCollectionSpecification(spec, collection)` — Section 7's full JSON
  (see schema below), now including Phase 4b's `motifVariants` (read
  straight off `collection.motifReuse`).
- `buildCollectionPreviewMetadata(collection)` — Section 8: asset
  relationships, Color Story variant count, real layout-diversity numbers,
  motif consistency, commercial readiness — describing the existing visual
  preview composite (`buildCollectionPreview`, untouched), not replacing
  it. Phase 4b adds Section 10's remaining named preview fields, all real
  and fact-derived: `coverAssetId` (always `'hero'`, the same asset the
  preview composite itself places first), `assetOrder` (the manifest's own
  real asset order, never re-sorted), `paletteStory`/`layoutStory` (one
  deterministic line each, listing the real variant ids / real layout ids
  in use — never fabricated marketing copy, same convention
  `buildCommercialNotes` already follows), and `motifFamily` (the
  manifest's own real dominant family plus a one-line description).
- `prepareCollectionExport(spec, collection)` — Section 10: collection id/
  name, a slugified filename prefix, the real asset manifest, marketplace
  targets, product uses. Structured data only — no zip/file-writing code
  was added anywhere this phase.

### Backward compatibility

`GeneratedCollection` gained `patternTiles: TileData[]` (the same 6
pattern tiles now built, including Background Texture) — additive, kept
separate from the pre-existing `patternParams` (5 elements, fixed
hero/secondary/blender/mini/stripe order) that `components/ProjectPanel.tsx`
indexes into by position. `project/projectManager.ts`'s `normalizeProject`
(already the established place every loader runs persisted records
through, per its pre-existing `designSpecs` backfill) was extended to
reconstruct `patternTiles` via a real `buildTile(p)` call per
`patternParams` entry for any collection persisted before this field
existed — never an empty placeholder, never a crash on old data.

## Collection JSON Schema

`CollectionSpecification` (Section 7), from `trend/collectionPlan.ts`:

```ts
interface CollectionSpecification {
  metadata: {
    schemaVersion: number;       // COLLECTION_SCHEMA_VERSION (4)
    collectionId: string;
    generatedAt: number;
    plan: CollectionPlan;        // Section 1, see below
  };
  assets: CollectionManifest['assets'];        // id/type/label/filename/motifIds
  colorVariants: ColorStorySet;                 // = plan.colorStory
  layoutVariants: Array<{ assetId: string; layoutId: LayoutId }>;
  motifRelationships: CollectionManifest['relationships']; // = manifest.relationships
  motifVariants: MotifReuseReport;              // Phase 4b — Section 6/8, = collection.motifReuse
  marketplaceTargets: MarketplaceId[];          // primary marketplace first, then Style DNA's recommended sites
  commercialNotes: string[];                    // deterministic, fact-derived
}

interface CollectionPlan {
  collectionName: string;
  collectionTheme: string;
  commercialCategory: string;
  targetMarketplace: MarketplaceId;
  marketplaceTargets: MarketplaceId[];          // Phase 4b — Section 1's own plural field
  styleDnaId: string;
  colorStory: ColorStorySet;                    // all 13 named variants
  recommendedProductUses: ProductUseId[];
  collectionSize: number;
  collectionVersion: number;                    // = COLLECTION_SCHEMA_VERSION
}
```

`ColorStorySet` is `Record<ColorStoryVariantId, { id, label, colors: string[] }>`
across the 13 ids listed in the Color Story table above.

`MotifReuseReport` (Phase 4b, `collection/motifReuse.ts`) — see the Motif
Reuse Engine subsection above for its full shape.

## Developer Guide

**Adding a new named product use (Section 6)**: add its id to
`ProductUseId`/`PRODUCT_USE_IDS` and a `ProductUseRule` entry to `RULES` in
`collection/productTargets.ts` (keywords/categories/tile-size/density
bands) — `evaluateProductTargets` and `recommendedProductUses` need no
other change.

**Adding a new Color Story variant (Section 3)**: add its id to
`ColorStoryVariantId`/`COLOR_STORY_VARIANT_IDS` and either a
`VARIANT_TRANSFORMS[id]` entry (a `(hex: string) => string` built from
`palettes/colorTransform.ts`'s primitives) or special-case it in
`buildColorStory` the way `monochrome` is (a whole-palette rule, not a
per-color one).

**Adding a new Collection asset type (Section 2)**: extend `AssetType` in
`collection/collectionGenerator.ts`, build it inside `generateCollection`
(reuse `buildTile`/`generateMotifSet`/`buildMotifSheet` — never a new
generation primitive), add it to the `assets` array, and consider whether
it belongs in `collection/collectionScore.ts`'s `REQUIRED_ASSET_TYPES`.

**Reading a Collection Specification downstream**: call
`buildCollectionSpecification(spec, collection)` once; every other Section
7/8/10 field is derived from that single call's inputs, so there's never a
second source of truth to keep in sync.

**Adding a new shared motif pool (Section 6, Phase 4b)**: generate the pool
once with `generateMotifSet`, pass the *same array reference* to every
builder that should share it (`buildBorderStrip`/`buildCornerUnit` both
already accept a `motifs: FactoryMotif[]` and cycle through it
independently), then include the pool once (not once per consumer) when
assembling `allMotifs` — `uniqueMotifsById` already dedupes by id, so
passing the same array to 3 builders never triples it in the manifest.

**Scaling collection size (Section 12, Phase 4b)**: `generateCollection`'s
4th parameter (`requestedCollectionSize`) only ever grows the Individual
Motif count — every other asset kind is structurally required
(`REQUIRED_ASSET_TYPES`) and never shrinks. To add a new reuse source to
the padding queue, extend `reusableExtraMotifs` in
`collection/collectionGenerator.ts` before the `generateMotifSet` fallback
— always prefer an already-generated pool over new geometry.

## Tests

- `palettes/colorTransform.test.ts` (17 tests) — hex/HSL round-trip
  accuracy, clamping at 0/100 for lightness/saturation, hue wraparound,
  `setLightness`/`setHue` override semantics.
- `collection/colorStory.test.ts` (12 tests) — all 10 variants present,
  color count preserved, deterministic, Light measurably lighter than
  Dark, Bold measurably more saturated than Muted, Monochrome collapses
  hue while preserving a lightness ramp, seasonal variants differ from
  each other and from Original, background color (index 0) is
  transformed too, safe on empty/minimal input.
- `collection/productTargets.test.ts` (10 tests) — all 10 products always
  returned, sorted descending, explicit keyword match wins, deterministic,
  category/tile-size fit measurably outscores a mismatch, scores clamped
  0-100, case-insensitive matching, `recommendedProductUses` never empty
  even with no strong match.
- `collection/collectionGenerator.test.ts` (+13 tests) — Background
  Texture/Individual Motifs presence and validity, layout diversity across
  a real collection and a Style DNA sweep, Mini no longer inherits Hero's
  layout, `patternTiles` additive without disturbing `patternParams`,
  `verifyConsistency`'s new motif-family check (positive + regression
  guard + backward-compatible no-motifs-arg call).
- `collection/collectionScore.test.ts` (+5 tests) — Layout Diversity is
  100 by construction, drops on a forced collision (regression guard),
  Motif Shape Diversity is a real deterministic number, `REQUIRED_ASSET_TYPES`
  updated to 12.
- `trend/collectionPlan.test.ts` (13 tests) — every `CollectionPlan` field
  traces to the real spec, theme fallback (Trend Pack vs. primary
  keyword), Color Story/Product Targets wiring, `CollectionSpecification`
  assembly correctness and determinism, preview metadata's real
  layout/consistency/readiness numbers, export-prep's slugified filename
  and asset manifest.
- `project/designerAssistant.test.ts` and `collection/collectionScore.test.ts`'s
  pre-existing "healthy collection" tests were updated to expect a
  realistic ≥95 (not a hardcoded 100) now that Motif Shape Diversity is a
  genuinely-measured, non-perfect-by-default dimension.

**Phase 4b additions**:
- `collection/colorStory.test.ts` (+4 tests) — Earth Tone/Luxury/Pastel
  each differ from Original and from each other, Pastel measurably
  lighter/less saturated, Luxury measurably darker, Earth Tone measurably
  less saturated.
- `collection/collectionGenerator.test.ts` (+16 tests) — Dense/Airy asset
  presence, distinctness, and layout allocation; Motif Reuse Engine report
  presence/variants/determinism/leaf-family scoping; collection-size
  scaling at every named tier (default/10/25/50/100/clamped-500), real
  motif-id relationships on padded assets, determinism, and a performance
  bound (< 10s to scale to 100 assets).
- `collection/motifReuse.test.ts` (NEW, 10 tests) — reused-vs-not-reused
  counting, duplicate-relationship de-duplication, role/family bucketing
  (hero/filler/accent/leaf), real placement-variant attachment, reuseRatio
  math, empty-collection and unknown-motif-id safety.
- `engine/borderCornerAssets.test.ts` (+2 tests) — `buildBorderStrip`/
  `buildCornerUnit` report exactly `count` real placement decisions, each
  referencing a real motif id with finite rotation/positive scale.
- `trend/collectionPlan.test.ts` (+3 tests) — Plan-level `marketplaceTargets`
  starts with the spec's own marketplace and has no duplicates,
  `CollectionSpecification.motifVariants` equals the real
  `collection.motifReuse`, and every Section 10 preview field (cover,
  asset order, palette/layout story, motif family) is real, fact-derived
  data traceable to the manifest.
- `collection/collectionScore.test.ts` — `REQUIRED_ASSET_TYPES` assertion
  updated from 12 to 14 entries.
- `trend/designSpecCollection.test.ts` — the pre-existing determinism test
  (which builds 2 full collections) had its explicit timeout raised
  15000ms → 30000ms; 8 pattern-type tiles now build per collection instead
  of 6.

**Full suite**: 994/994 tests passing across 72 files (`npx vitest run`),
up from 961 before Phase 4b's additions. `npx tsc -b` and `npm run lint`
(oxlint) both clean.

**Browser verification (first Phase 4 pass)**: generated a real Collection
through the existing (untouched) UI — "Generate Collection" → downloaded
zip contained `background-texture.svg`, all 6 `individual-motif-N.svg`
files, and a `Collection.json` with `schemaVersion: 3` and
`consistency.consistent: true`; the existing Project Dashboard correctly
showed the resulting 25-asset collection with zero console errors,
confirming the new asset types and `patternTiles` field flow cleanly
through UI that was never modified this phase. Phase 4b did not touch any
UI component either (same "no new UI" scope constraint), so this pass
relied on the expanded automated suite above (which round-trips
`generateCollection` end-to-end, including the new size-scaling path) plus
the studio production build succeeding cleanly.

## Performance

- `allocateLayout` is O(L) worst case per pattern asset (L = 14 registered
  layouts), called at most 6 times per collection — negligible next to the
  Motif Factory's own generation cost.
- The Color Story Engine's `buildColorStory` runs 10 × N small HSL
  conversions (N = palette color count, typically 2-6) — a handful of
  arithmetic operations, no measurable cost even called once per
  Background Texture build.
- `collection/collectionScore.ts`'s Motif Shape Diversity pools
  `extractMotifShapeSignatures` output across 6 pattern tiles instead of
  1 — still a single linear pass per tile, no new O(n²) work introduced.
- No change to the Collection Generator's overall cost profile — no new
  `buildTile` calls beyond the one Background Texture tile, and Individual
  Motifs reuse already-generated `FactoryMotif`s rather than generating new
  ones.

**Phase 4b — Section 12, collection-size scaling**: the structural asset
count grew from 25 to 27 (Dense + Airy Pattern), which already covers the
10 and 25 tiers with no scaling logic at all. For 50/100, `generateCollection`
pads Individual Motif count *reuse-first*: the still-unused remainder of
`spotMotifs` (6 of 12 were already unused), then the entire
`fillerMotifPool` (8, already generated for Border/Corner/Decorative), then
`decorativeAccents` (12, already generated for the Decorative sheet) — 26
motifs' worth of zero-cost padding (one cheap SVG-document wrap each, no
`buildTile`/`generateMotifSet` call) before any genuinely new geometry is
generated. Only the remainder beyond that (relevant once a request nears
100) falls back to `generateMotifSet` for real new motifs, and only for the
exact shortfall — never more than needed. Measured: scaling a real
collection to 100 assets completes in well under 10 seconds in the test
suite (same order of magnitude as the unpadded 27-asset case), because the
overwhelming majority of the padding is pure reuse, not regeneration.
Requesting a size below the structural floor (e.g. 10) never shrinks the
collection — every `REQUIRED_ASSET_TYPES` entry stays present.

## Remaining weaknesses

- **`ProjectPanel.tsx`'s Collection Score display still shows only the
  original 5 dimensions** — Layout Diversity and Motif Shape Diversity are
  computed and tested but not yet surfaced in that UI (out of scope this
  phase per its own "no new UI" pattern — see Phase 5 recommendations).
- **Product Targets' rules are hand-authored, not learned or market-
  validated** — honest and inspectable, but a real stock-marketplace
  dataset could sharpen the keyword/category tables over time.
- **`CollectionExportPrep` is not wired into any actual export path** — by
  design this phase (Section 10 explicitly asked for structured data only),
  but it means `App.tsx`'s `buildAndDownloadCollectionZip` doesn't yet
  consume the recommended filename prefix or marketplace targets it
  computes.
- **The Color Story Engine's palette variants are not yet offered as
  alternate Collection asset color sets** — `buildColorStory` produces the
  10 variants, but nothing yet regenerates the collection's pattern assets
  in each variant color (only Background Texture consumes one variant,
  "Light"). A full "colorway collection" (all core assets × all 10 Color
  Story variants) is a real, substantial Phase 5 candidate.
- **Individual Motifs always draws from the hero-role Spot Motif set** —
  it does not yet offer a way to select which motif role/family to export
  standalone.
- **Section 5's "Editorial"/"Organic Scatter"/"Diagonal"/"Border" layout
  strategies are honestly real but one abstraction layer down** (Cluster
  Composition Engine archetypes inside `heroFlow`/`scatter`/`toss`, and
  Border's own dedicated builder) rather than literal standalone
  `LayoutId`s a Collection asset can pick by that exact name. This was a
  deliberate Phase 4b scope decision (adding new `LayoutId`s would
  duplicate/redesign engine work outside this milestone's remit), but it
  means `buildLayoutVariants`' output still reports `heroFlow`/`scatter`/
  `toss`, not `'editorial'`/`'organicScatter'`/`'diagonal'` literally.
- **`fillerMotifPool` sharing is currently one fixed pool per collection**
  — Border, Corner, and 4 Decorative slots all draw from the *same* 8
  motifs. A richer version could offer 2-3 named pools (e.g. "leaves" vs.
  "berries") for collections whose category naturally has more than one
  filler family, at real generation cost.
- **The Motif Reuse Engine's `variants` array is only populated for
  Border/Corner placements** — `buildMotifSheet` (Spot/Decorative sheets)
  has no per-instance rotation (it's a plain reference grid), so shared
  motifs placed there show up in `usedInAssetIds`/`reuseCount` but with an
  empty `variants` array for that placement. Honestly reflects what's
  real rather than fabricating a rotation value that was never applied.

## Recommendations for Phase 5

1. **Wire Color Story variants into full asset regeneration** — let a
   Collection Plan's chosen Color Story variant(s) actually regenerate the
   collection's pattern-type assets in that palette, not just inform
   Background Texture's colors.
2. **Surface Layout/Motif Shape Diversity in `ProjectPanel.tsx`** — small,
   additive UI change once a UI-focused phase is in scope.
3. **Wire `CollectionExportPrep` into the real export path** — have
   `App.tsx`'s zip builder consume `recommendedFilenamePrefix` and
   `marketplaceTargets` instead of only its own ad hoc naming.
4. **Data-driven Product Targets** — replace/augment the hand-authored
   rule table with real marketplace category performance data, if such
   data becomes available.
5. **Cluster Engine dependency** — resolved since this was written: Project
   PHOENIX V2 shipped a real Cluster Composition Engine
   (`engine/clusterEngine.ts`), and Phase 4b's Dense/Airy Pattern assets
   already consume it via the `densePremium`/`airy` layouts.
6. **Promote Cluster Composition Engine archetypes to real standalone
   layouts** — if a future milestone is in scope to touch `layouts/`, give
   Editorial/Organic Scatter/Diagonal their own `LayoutId`s so
   `buildLayoutVariants` can report them by their literal Section 5 names
   instead of the umbrella layout (`heroFlow`/`scatter`/`toss`) they
   currently live inside.
7. **Surface the Motif Reuse Engine in Collection Quality scoring** —
   `collection/motifReuse.ts`'s `reuseRatio` is computed but not yet folded
   into `collectionScore.ts`'s `overall` average; a low reuse ratio is a
   real signal ("this collection's assets don't feel like a family") the
   score currently can't see.
8. **`variants`-aware sheets** — extend `buildMotifSheet` to record its own
   (currently uniform, no-rotation) per-cell placement the same way
   `buildBorderStrip`/`buildCornerUnit` now do, so the Motif Reuse Engine's
   `variants` array is populated for Spot/Decorative sheet placements too.
