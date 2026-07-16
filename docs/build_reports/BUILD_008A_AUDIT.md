# Build 008A Audit — Knowledge Infrastructure

Audits every piece of knowledge currently hardcoded inside Style DNA,
Botanical rules, Palette rules, and Composition preferences, and
categorizes each into one of four buckets:

- **migrate now** — moved into the new versioned Knowledge Registry this build
- **keep temporary** — stays as TS this build, but is a real candidate for a
  future migration once its own subsystem gets scoped
- **compatibility** — a pre-existing system that must keep working exactly
  as-is; not touched by this build
- **future** — explicitly out of scope per the brief's "DO NOT" list
  (Botanical Engine, Composition Engine, Creative/Product/Marketplace
  Intelligence); real migration candidates for Build 008B+

## 0. A critical finding: two parallel "Style DNA" systems already exist

Before cataloging individual rules, one structural fact has to be named
plainly because it changes what "migrate Style DNA" can honestly mean:

**This codebase already has a JSON-backed Style DNA system** —
`src/style-dna/*.json` (15 files) + `src/services/styleDnaService.ts` +
`src/knowledge/style/index.ts` — built during an earlier "Design
Intelligence Core Phase 1" effort. Its own header comment says exactly
what Build 008A is asking for: *"every one of the 15 built-in identities
is real editable JSON, ported 1:1 from app/src/engine/styleDna.ts's
STYLE_DNA_PRESETS... see the Phase 1 report's Phase 2 recommendations for
wiring these two together."*

That wiring never happened. The REAL, actively-used Style DNA — the one
`App.tsx`, `collectionGenerator.ts`, every `trend/*` module, and every
generator build 001-007 touched — is still `engine/styleDna.ts`'s
hardcoded `STYLE_DNA_PRESETS` object literal. The JSON snapshot is now
**stale**: comparing `style-dna/luxuryFloral.json` to
`engine/styleDna.ts`'s live `luxuryFloral` entry, the JSON is missing
`preferredZones`, `preferredFamilies`, `preferredClusterArchetypes`,
`premiumHero`, and `exportRecommendation.bestProductTargets` — five
real fields added across Builds 003-005 that the JSON snapshot never
received. The JSON system is consumed only by a few Design Workbench UI
panels (`FavoritesPanel`, `PropertyInspector`, `TrendStudioForm`) and a
couple of validators (`services/keywordBundleEngine.ts`,
`validators/relationshipValidator.ts`) that only check "does this id
exist" — never by the actual generation pipeline.

**Decision for this build:** Build 008A migrates the REAL source of
truth — `engine/styleDna.ts`'s `STYLE_DNA_PRESETS` — into the new
Knowledge Registry, using a schema that matches its full, current,
7-builds-evolved shape. The legacy `style-dna/*.json` system is left
completely untouched (compatibility requirement, §7) since retiring or
reconciling it is a real decision that deserves its own scoped build, not
a side effect of this one. This is flagged as the top recommendation for
a future build in §BUILD_008A_REPORT.md.

## 1. Style DNA (`engine/styleDna.ts`)

| Rule / field | Category | Notes |
|---|---|---|
| `STYLE_DNA_PRESETS` (15 preset records, ~24 fields each) | **migrate now** | The actual hardcoded knowledge — moves to versioned JSON + Knowledge Registry |
| `StyleDna` TS interface (the shape) | **migrate now** (as schema) | Becomes the versioned Style Schema (§4); the TS type itself stays exported unchanged so every consumer's import keeps working |
| `resolveStyleDna`, `computeStyleDrift`, `resetToStyleDna` | **keep temporary** | Pure functions operating ON a `StyleDna` record — real engine logic, not data; unaffected by where the record came from |
| `computeStyleDnaConsistency`, `isStyleDnaCompatible` | **keep temporary** | Same — scoring/validation logic over a resolved record |
| `deriveStyleDnaFromParams`, `duplicateStyleDna` | **keep temporary** | User-facing "create style from current params" / "duplicate" — construct plain `StyleDna` objects at runtime, no static data involved |
| `exportStyleDnaJson` / `importStyleDnaJson` (+ `StyleDnaExport`, `STYLE_DNA_SCHEMA_VERSION = 1`) | **compatibility** | The app's own public per-style JSON export/import format (Style DNA Manager's Export/Import buttons) — must keep accepting exactly what it already accepts |
| `FLOW_ROTATION_JITTER`, `COMPLEXITY_SCALE_JITTER`, `RHYTHM_STRENGTH`, `CLUSTER_BALANCE_STRENGTH`, `CLUSTER_ATTRACTION_STRENGTH`, `FLOW_BIAS_STRENGTH`, `COLOR_STRATEGY_*`, `BACKGROUND_FILLER`, `DEPTH_SHADOW` | **keep temporary** | Small enum→number lookup tables that translate a style's *named* profile fields (`flowProfile`, `motifComplexity`, ...) into concrete engine parameters — real engine constants, not per-style knowledge; every style shares the same table |
| `engine/hierarchy.ts`'s `HIERARCHY_PRESETS` (8 named presets) | **keep temporary** | Referenced by id from `StyleDna.hierarchyPreset`; a real, separate "Hierarchy Engine" subsystem (Build 001) with its own 8 hand-tuned presets — legitimate future migration target, not touched this build |
| `storage/styleDnaStore.ts` (custom styles + favorites, localStorage) | **compatibility** | Must keep loading a user's already-saved custom `StyleDna[]` unchanged |

## 2. Botanical rules (`generators/botanicalFamilies.ts`, `generators/flowerAnatomy.ts`, `generators/leafAnatomy.ts`)

| Rule / field | Category | Notes |
|---|---|---|
| `BOTANICAL_SPECIES` (19 species × `silhouette`/`growthPreset`/`stemLengthScale`/`leafDensityScale`/`bouquetRole`/`companionFamilies`) | **future** | Real, substantial per-species knowledge — explicitly the Build 008B-scale "Species" migration the brief's own closing section names. `KnowledgeRegistry.getSpecies()` is added this build as a read-only proxy over this exact table (§2/§9), so the call-site contract exists before the data itself moves |
| `FLOWER_ANATOMY` (Build 007, 9 species' sepal/filament/openness data) | **future** | Same bucket as `BOTANICAL_SPECIES` — added one build ago, real per-species data, not touched here |
| `LEAF_ANATOMY` (Build 007, 19 species' edge/vein/width data) | **future** | Same bucket |
| `GROWTH_PRESETS` (`generators/growth.ts`, 8 named growth presets) | **future** | Referenced by species via `growthPreset` id — its own small subsystem |
| `illustrationFamily.ts`'s `ILLUSTRATION_TEMPLATES` (3 templates: bouquet/spray/branch) | **future** | Real named knowledge, small and stable; not touched |

Explicitly out of scope per the brief's "DO NOT rewrite Botanical Engine"
— none of the above is restructured, only read from (via the new
`getSpecies()` accessor, which changes nothing about where the data lives
or how `premiumHero.ts` consumes it).

## 3. Palette rules (`palettes/palettes.ts`, `palettes/commercialColorStories.ts`)

| Rule / field | Category | Notes |
|---|---|---|
| `PALETTES` (18 hand-authored palettes) | **future** | Real color knowledge; a genuine migration candidate but not Style DNA, and the brief scopes this build to "Replace only one real subsystem: Style DNA" |
| `COMMERCIAL_COLOR_STORIES` (Build 006, 8 named stories with computed contrast/temperature/neutralBalance) | **future** | Same bucket — already has real *computed* metadata (not just color arrays), a good future candidate once a Palette Schema exists |
| `resolveColors`, `blendHex`, `accentColors` | **keep temporary** | Pure color-math functions, not data |

Style DNA's own `paletteIds` field just stores string ids that resolve
against whichever `PALETTES` array exists at runtime — migrating Style
DNA does not require touching palette data at all; the reference is by
id, exactly like `hierarchyPreset`.

## 4. Composition preferences (`engine/compositionZones.ts`, `engine/clusterEngine.ts`, `engine/rotationFamilies.ts`, `engine/designKnowledge.ts`)

| Rule / field | Category | Notes |
|---|---|---|
| `COMPOSITION_ZONES` (10 named zones) + per-zone density-field math | **future** | Mostly *algorithmic* (real geometry functions per zone), not a lookup table of "knowledge" the way Style DNA/Species/Palette are — a real but lower-priority migration candidate since there's very little pure data to move (10 stable enum names) |
| `CLUSTER_ARCHETYPES` (named cluster archetypes) + placement math | **future** | Same shape as zones — mostly algorithmic |
| `rotationFamilies.ts`'s named rotation-angle families | **future** | Same |
| `engine/designKnowledge.ts` (`computeDesignKnowledgeProfile`, `resolveDesignRules`, their lookup tables) | **keep temporary** | This is the layer Build 008A's own Style Schema (§4) draws its "design philosophy" language from — it's a pure *derivation* function over a `StyleDna` record's existing fields (hero count, cluster density, negative space, stem/leaf tiers), not a second copy of style knowledge. Stays exactly as-is; it will keep working unchanged once `STYLE_DNA_PRESETS` is registry-backed, since it only ever sees the resolved `StyleDna` object, never the storage mechanism |

Style DNA's `preferredZones`/`preferredClusterArchetypes` fields are, once
again, plain string-id arrays resolved against these still-hardcoded
tables — migrating Style DNA doesn't require migrating Composition data.

## 5. Summary table

| Bucket | Count | Examples |
|---|---|---|
| Migrate now | 1 system (15 records) | `STYLE_DNA_PRESETS` → Knowledge Registry |
| Keep temporary | 6 subsystems | Style DNA resolver functions, lookup tables, `HIERARCHY_PRESETS`, `designKnowledge.ts` |
| Compatibility | 3 systems | `exportStyleDnaJson`/`importStyleDnaJson`, `storage/styleDnaStore.ts`, the legacy `style-dna/*.json` + `knowledge/style/*` system |
| Future | 9 subsystems | `BOTANICAL_SPECIES`, `FLOWER_ANATOMY`, `LEAF_ANATOMY`, `GROWTH_PRESETS`, `ILLUSTRATION_TEMPLATES`, `PALETTES`, `COMMERCIAL_COLOR_STORIES`, Composition Zones, Cluster Archetypes/Rotation Families |

## 6. Recommendation feeding into Build 008B

See `BUILD_008A_REPORT.md` §Remaining Work / Recommendation for the full
writeup — summarized here as the audit's own conclusion: Species is the
most valuable and lowest-risk next migration (already has a clean,
self-contained per-family record shape from Build 007, and
`KnowledgeRegistry.getSpecies()` already exists as a contract to fill in),
followed by Palette. Composition Zones/Cluster Archetypes are real but
lower-value migrations since most of their content is algorithmic, not
data. The legacy `style-dna/*.json` duplication should be explicitly
addressed (reconciled or retired) before it drifts further from the real
engine.
