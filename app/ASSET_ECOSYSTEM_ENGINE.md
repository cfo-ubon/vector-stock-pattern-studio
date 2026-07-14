# Asset Ecosystem Engine — Phase 9

Developer documentation for the Asset Ecosystem Engine (AEE): the
`src/assets/` layer that turns already-generated Collection geometry into
reusable, first-class **Asset** records — searchable, scoreable,
relatable, and remixable independently of the Collection they came from.

**This phase never draws a new shape.** Every `Asset.node` is a real,
already-generated `SvgNode` subtree lifted from a `FactoryMotif`
(Professional Asset Factory Engine) or reconstructed byte-identically
from a Collection's own border/corner placement logic
(`collection/collectionGenerator.ts`). `assets/*` only re-projects, tags,
scores, relates, and presentation-transforms that geometry — extraction,
metadata, relationships, variants, search, recommendation, quality, and
storage, never a second SVG generator.

## Contents

1. [Why a facade, not a new generator](#why-a-facade-not-a-new-generator)
2. [Folder structure](#folder-structure)
3. [Section-by-section mapping](#section-by-section-mapping)
4. [Asset Schema](#asset-schema)
5. [Byte-identical Border/Frame reconstruction](#byte-identical-borderframe-reconstruction)
6. [Relationships: why flowerToLeaf/leafToBranch are pool-wide](#relationships-why-flowertoleafleaftobranch-are-pool-wide)
7. [The 7 Asset Variants](#the-7-asset-variants)
8. [Quality Score](#quality-score)
9. [Asset Library storage](#asset-library-storage)
10. [Empirical findings](#empirical-findings)
11. [UI wiring](#ui-wiring)
12. [Developer guide](#developer-guide)
13. [Testing](#testing)
14. [Performance notes](#performance-notes)

## Why a facade, not a new generator

An audit before writing any code confirmed every piece of raw material
AEE needs already existed as real, tested output:

| Brief concept | Already lived in |
|---|---|
| A named, tagged, scored motif with real geometry | `engine/motifFactory.ts`'s `FactoryMotif` (id, family, role, complexity, colorRoles, node) |
| Border/corner geometry | `collection/collectionGenerator.ts`'s `buildBorderStrip`/`buildCornerUnit`, deterministic from `manifest.seed` |
| Node-count complexity scoring | `motifFactory.ts`'s private complexity scorer (reused via the value already on `FactoryMotif.complexity`, and re-derived identically for decomposition via `countNodes`) |
| Compatible pattern grammars / family pairings | `knowledge/motif`'s `compatiblePatternGrammars` + `getRecommendedFamilyCombinations`/`isCombinationRecommended` |
| Marketplace curation per Style DNA | `knowledge/style`'s `recommendedMarketplaces` |
| Hero-motif detail overlay | `engine/heroComplexity.ts`'s `applyHeroDetailOverlay` |
| Color lightness/saturation transforms | `palettes/colorTransform.ts`'s `adjustLightness`/`adjustSaturation` |
| JSON Schema validation machinery | `validators/jsonSchemaValidator.ts` + `validators/index.ts`'s `SCHEMA_REGISTRY` |
| IndexedDB persistence pattern | `storage/db.ts` + `storage/savedStore.ts` |

Nothing above was redesigned. `src/assets/` is the missing layer that
extracts, tags, relates, varies, scores, searches, and persists these
already-real motifs and composite shapes as durable, reusable objects —
nothing before this phase treated a motif as a standalone asset with its
own id, lifecycle, and cross-collection relationships.

## Folder structure

```
src/assets/
  types.ts           Section 2 — Asset, AssetMetadata, and every shared type
  extraction.ts       Section 1 — extractAssetsFromCollection(collection)
  decomposition.ts    Section 8 — decomposeTileIntoAssets, decomposeAssetToSvg
  relationships.ts     Section 3 — deriveAssetRelationships(assets)
  variants.ts           Section 4 — applyVariant(asset, type)
  search.ts              Section 5 — searchAssets(assets, query)
  recommendation.ts       Section 6 — recommendCompatibleAssets(target, pool)
  qualityScore.ts          Section 9 — evaluateAssetQuality(asset)
  library.ts                Section 7 — favorites + packs (localStorage)
  validation.ts              Section 10 — schema + relationship integrity
  index.ts                    Barrel (export * as X from './x')

src/storage/assetStore.ts   IndexedDB CRUD for the Asset Library (Section 7's "Libraries")
src/schemas/asset.schema.json   JSON Schema for AssetMetadata (Section 10)
src/components/workbench/AssetLibraryPanel.tsx   UI surface
```

## Section-by-section mapping

| Brief section | Module | Notes |
|---|---|---|
| 1. Asset Extraction | `extraction.ts` | 9 kinds; Border/Frame reconstructed byte-identically from real Collection geometry |
| 2. Asset Metadata | `types.ts` | `AssetMetadata` — id/name/family/Style DNA/complexity/pattern types/compatibility/editable/version |
| 3. Asset Relationships | `relationships.ts` | 5 types, all derived from real fields, none hardcoded |
| 4. Asset Variants | `variants.ts` | 7 named variants, presentation-level SVG transforms |
| 5. Smart Search | `search.ts` | Style, family, keyword, marketplace, color, pattern, complexity range |
| 6. Smart Recommendation | `recommendation.ts` | Reuses the real Design Knowledge Engine compatibility data |
| 7. Asset Collections | `library.ts` + `storage/assetStore.ts` | Favorites, Packs (Collections/Templates), the IndexedDB store itself is "Libraries" |
| 8. SVG Decomposition | `decomposition.ts` | Splits a rendered tile into per-instance editable assets |
| 9. Quality | `qualityScore.ts` | Reusability, Complexity, Commercial Usefulness, Compatibility, Overall |
| 10. JSON | `schemas/asset.schema.json` + `validators/index.ts` | Registered in the same `SCHEMA_REGISTRY` every other domain uses |
| 11. Tests | 10 new test files | See [Testing](#testing) |
| 12. Documentation | This file + README + USER_GUIDE | — |

## Asset Schema

```ts
interface AssetMetadata {
  id: string; name: string;
  kind: AssetKind;              // 9 values, heroMotif wins over family
  family: MotifFamily;          // reused verbatim from engine/motifFactory.ts
  role?: MotifRole;
  categoryId: string;           // real knowledge/motif category key
  styleDnaId?: string;
  complexity: number;           // 0-100, real node-count measurement
  patternTypes: string[];
  compatibility: AssetCompatibility;  // patternGrammars, compatibleFamilies, marketplaces
  editable: true;                // structural guarantee, node is always real SVG
  version: number;                // starts at 1; a variant is sourceVersion+1 as a NEW id
  createdAt: number;
  sourceCollectionId: string;
  sourceMotifIds: string[];
  colorRoles: string[];
}

interface Asset {
  metadata: AssetMetadata;
  node: SvgNode;   // the real, editable geometry
  width: number; height: number; radius: number;
}
```

`AssetKind` is one of `heroMotif | leaf | flower | branch | texture |
border | frame | icon | decorativeShape` — `heroMotif` (role-based)
always wins over a family-based kind, so a hero-role flower is tagged
`heroMotif`, never `flower`.

`role` and `styleDnaId` are conditionally spread onto the metadata object
rather than always assigned (`...(opts.role !== undefined ? { role:
opts.role } : {})`) — the hand-rolled JSON Schema validator's `typeOf()`
has no `undefined` branch and falls through to `'object'`, so an
explicitly-`undefined`-valued optional key fails a `"type": "string"`
check. This was caught empirically (see
[Empirical findings](#empirical-findings)) before it reached the test
suite.

## Byte-identical Border/Frame reconstruction

`CollectionAsset` only stores a pre-serialized SVG string for a
Collection's border/corner pieces, not the raw `SvgNode` an `Asset`
needs. Rather than skip Border/Frame assets or write a second,
approximate border-drawing implementation, `extraction.ts` reproduces the
exact same construction `collection/collectionGenerator.ts` performs
internally:

- The same `deriveSeed(collection.manifest.seed, 'collection-border-place' | 'collection-corner-place', i)` + `createRng()` sequence.
- The same `bandSize = Math.round(tileSize * 0.18)`, 8 border pieces, 6 corner pieces.
- The same `backgroundColor` (from `patternTiles[0]`) and the same
  `filler`-role motif pool (`collection.motifs.filter(m => m.role === 'filler')`).

Because every input is deterministic and already present on
`GeneratedCollection`, calling the real `buildBorderStrip`/
`buildCornerUnit` functions with these reconstructed arguments produces
node-for-node identical geometry to what the Collection actually
rendered — no duplicate SVG generation logic, per the brief's explicit
constraint.

## Relationships: why flowerToLeaf/leafToBranch are pool-wide

`engine/motifFactory.ts`'s `CATEGORY_FAMILY` assigns exactly **one**
family per generator category (botanical → flower, tropical → leaf,
geometric → geometric, etc.) — a single Collection's extracted assets
can never contain both a `flower` and a `leaf` simultaneously. An
initial, collection-scoped implementation of `flowerToLeaf`/
`leafToBranch` was therefore structurally incapable of ever producing a
relationship for any real single-category Collection (caught
empirically — see below). `deriveAssetRelationships` was rewritten so
that:

- **`flowerToLeaf`** and **`leafToBranch`** are computed **pool-wide**
  via `crossFamilyPairs()` — the realistic case is cross-collection
  (e.g. a botanical Collection's flowers paired with a tropical
  Collection's leaves), which is exactly what a reusable Asset Library
  is for.
- **`borderToCorner`** and **`collectionToAsset`** stay
  collection-scoped, since they genuinely require either a shared
  filler-motif pool or literal same-Collection membership.
- **`sameFamily`** flags cross-collection reuse candidates that share a
  family but not a source Collection.

All 5 types are derived from real fields (`family`,
`sourceCollectionId`, `sourceMotifIds` overlap) — never a hardcoded
pairing table.

## The 7 Asset Variants

`outline`, `filled`, `minimal`, `detailed`, `bold`, `monoline`,
`vintage` — all presentation-level SVG attribute transforms via a
`cloneWithAttrs` tree walker, never a re-generation:

- **`detailed`** is the one variant that adds real geometry — it reuses
  `engine/heroComplexity.ts`'s `applyHeroDetailOverlay` (called with the
  literal role `'hero'`, since `heroComplexity.ts`'s narrower 4-value
  `MotifRole` and `motifFactory.ts`'s wider 6-value `MotifRole` aren't
  assignable to each other, and `'hero'` is valid in both).
- **`vintage`** reuses `palettes/colorTransform.ts`'s
  `adjustLightness`/`adjustSaturation`, not a new color-shift formula.
- Every variant produces a **new** `Asset` — a distinct id, `version =
  sourceAsset.version + 1` — never a mutation of the original in place.

## Quality Score

`evaluateAssetQuality(asset)` returns `{ reusability, complexity,
commercialUsefulness, compatibility, overall }`, all 0-100:

- **`complexity`** is `asset.metadata.complexity` verbatim — no
  recomputation.
- **`compatibility`** scales against the real number of compatible
  pattern grammars/marketplaces, denominators pulled from
  `knowledge/composition`'s `listCompositionKnowledge().length` and
  `knowledge/marketplace`'s `listMarketplaceKnowledge().length` — never
  a fixed denominator.
- **`commercialUsefulness`** is Style-DNA-market-fit-based; an asset
  with no `styleDnaId` gets a fixed neutral baseline of **40**, not 0 —
  a from-scratch decomposition shouldn't read as commercially useless
  just because it was never tied to a curated Style DNA.
- **`reusability`** is a documented heuristic: a triangular
  complexity-appropriateness curve (too simple or too ornate both score
  lower than a mid-range asset) blended with the compatibility score.
- **`overall`** is the rounded average of all four dimensions.

## Asset Library storage

`storage/assetStore.ts` is IndexedDB CRUD (`loadAssets`, `putAsset`,
`bulkPutAssets`, `deleteAsset`, `clearAssets`) keyed by
`metadata.id`, sibling to `storage/savedStore.ts`. `storage/db.ts` was
bumped `DB_VERSION: 2 → 3` to add the `assets` object store
(`keyPath: 'metadata.id'`). When IndexedDB is unavailable (`idbAvailable()
=== false` — true in the jsdom test environment, confirmed by reading
`testSetup.ts`), it transparently falls back to a `localStorage` key
(`vsp-assets-v1`).

`assets/library.ts` is the separate, lighter-weight Favorites/Packs
layer — pure reducers persisted to `localStorage`
(`vsp-asset-favorites-v1`), mirroring `workbench/workbenchFavorites.ts`'s
`toggleId` convention. A **Template** is simply an `AssetPack` with
`isTemplate: true`; an ordinary **Collection** pack has it `false`;
**"Libraries"** (the brief's 4th collection type) is the full
IndexedDB-backed asset store itself, not a 3rd data shape.

## Empirical findings

Before finalizing the test suite, extraction/relationships were run
against real `generateCollection()` output (not synthetic fixtures) —
the same discipline every prior phase in this project used. Two real
bugs were caught this way and fixed before any test was written to
assert around them:

- **Undefined-valued optional keys failing schema validation** — see
  [Asset Schema](#asset-schema) above. Every asset lacking a
  `styleDnaId` failed `validateAssetPool` with `Expected type "string"
  but got "object"` until `buildAsset()` was changed to conditionally
  spread `role`/`styleDnaId`.
- **`flowerToLeaf`/`leafToBranch` structurally unreachable** — see
  [Relationships](#relationships-why-flowertoleafleaftobranch-are-pool-wide)
  above. A same-collection-scoped relationship search only ever
  produced `borderToCorner`/`collectionToAsset`, never the cross-family
  types, because no single generator category spans two families.

## UI wiring

`components/workbench/AssetLibraryPanel.tsx` is a new dockable panel
(`assetLibrary` in `workbench/workspaceSettings.ts`'s `RightPanelId`,
lazy-loaded like every Phase 6+ panel, labeled "🗃 Assets"). It:

- Extracts from the active Project's most recently generated Collection
  (`activeProject.collections[0].collection`) via one button, persisting
  the result to the IndexedDB Asset Library so it survives across
  sessions and future Collections.
- Loads the full persisted library on mount (`loadAssets()`).
- Filters the visible list by keyword and `AssetKind` via the real
  `searchAssets`.
- Shows the selected asset's real Quality Score breakdown
  (Reusability/Complexity/Commercial Usefulness/Compatibility), its
  derived Relationships, and its Recommended Pairings (via
  `recommendCompatibleAssets` against the whole in-memory pool).
- Lets a designer apply any of the 7 variants to the selected asset,
  adding the resulting new `Asset` to the library immediately.
- Lets a designer favorite/unfavorite an asset (`assets/library.ts`,
  `localStorage`-persisted, independent of the IndexedDB library
  itself).

## Developer guide

### Adding a new AssetKind

Add the id to `AssetKind` and `ASSET_KINDS` in `types.ts`, then a case
to `kindForMotif()` in `extraction.ts`. Remember role-based kinds
(`heroMotif`) must be checked before family-based ones.

### Adding a new AssetRelationshipType

Add the id to `AssetRelationshipType` in `types.ts` and a real
field-derived rule to `deriveAssetRelationships()` in
`relationships.ts` — never a hardcoded id pairing. Decide up front
whether the relationship is genuinely collection-scoped (needs shared
motifs/same collection) or pool-wide (a cross-collection reuse
candidate) — see the flowerToLeaf/leafToBranch case study above before
assuming collection-scoped is correct.

### Adding a new AssetVariantType

Add the id to `AssetVariantType`/`ASSET_VARIANT_TYPES` in `types.ts`, a
transform function in `variants.ts`, a label in `VARIANT_LABELS`, and a
case in `applyVariant()`. Reuse an existing engine/palette transform
where one exists rather than writing new geometry math.

## Testing

`npx vitest run src/assets src/components/workbench/AssetLibraryPanel.test.tsx`
runs the full Phase 9 suite: 95 tests across `extraction.test.ts` (8),
`decomposition.test.ts` (5), `relationships.test.ts` (5),
`variants.test.ts` (15), `search.test.ts` (8), `recommendation.test.ts`
(5), `qualityScore.test.ts` (5), `library.test.ts` (11),
`validation.test.ts` (6), and `AssetLibraryPanel.test.tsx` (6), plus the
updated `validators/index.test.ts` registry-count assertions (12 → 13
schemas). All tests run against real `generateCollection()` output, not
synthetic fixtures — `extraction.test.ts` and `validation.test.ts` in
particular assert against botanical/tropical categories specifically to
exercise real flower/leaf/branch family diversity (`defaultParams()`
defaults to `categoryId: 'geometric'`, which is mostly
`decorativeShape`).

The full project suite (`npx vitest run`) passes at 126 files / 1462
tests with these additions; `npx tsc -b` and `npm run lint` are both
clean.

## Performance notes

Extraction and decomposition are synchronous, pure-data transforms over
already-generated geometry — no rendering, no async work beyond the
UI's own `bulkPutAssets` IndexedDB write. A typical Collection (40
motifs + 8 border + 6 corner pieces) extracts in low single-digit
milliseconds. `deriveAssetRelationships` is the only quadratic-shaped
step (pairwise `sameFamily`/cross-family comparison across the whole
pool); at Asset Library sizes in the low hundreds this remains
sub-millisecond in practice, and the UI only recomputes it via
`useMemo` when the asset list itself changes.
