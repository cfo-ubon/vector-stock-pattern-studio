# Build 011 Audit — Artistic Intelligence Engine

Read in full before writing any code: `engine/scoring.ts`,
`engine/patternBeautyScore.ts`, `engine/luxuryComposition.ts`,
`engine/commercialStyleAnalysis.ts`, `critic/commercialPatternCritic.ts`,
`engine/negativeSpaceDesigner.ts`, `engine/hierarchy.ts`,
`engine/eyeFlowEngine.ts`, `engine/compositionZones.ts`,
`engine/compositionIntelligence.ts`, `engine/styleDna.ts` +
`knowledge/registry/data/styles/*.json` (all 15), `collection/productTargets.ts`,
`engine/types.ts`, `generators/premiumHero.ts`, `generators/botanicalFamilies.ts`,
`engine/portfolioQuality.ts`, `generators/illustrationFamily.ts`,
`engine/botanicalBeautyMetrics.ts`, `engine/illustrationQualityV2.ts`,
`palettes/palettes.ts`, `palettes/commercialColorStories.ts`,
`engine/colorAnalysis.ts`, `engine/trendEngine.ts`, `engine/portfolioVariety.ts`,
`engine/heroComplexity.ts`, `engine/tile.ts`, `scripts/qualityReport.ts`,
`engine/depthEngine.ts`, `engine/clusterAvoidance.ts`, `engine/clusterEngine.ts`,
`knowledge/registry/speciesSchema.ts`.

## Key findings

1. **Section 7's "Commercial Trend Engine" is at serious risk of tripling an
   already-doubled taxonomy.** This codebase already has *two* independent
   systems of named art-direction profiles:
   - `engine/styleDna.ts`'s 15 `STYLE_DNA_PRESETS` (JSON-backed,
     `knowledge/registry/data/styles/*.json`), which already include
     `scandinavianOrganic`, `darkBotanical`, `vintageHerbarium`,
     `minimalBotanical`, `luxuryFloral`, `bohoFloral` — near-verbatim matches
     for 6 of the brief's 7 named profiles.
   - `engine/trendEngine.ts`'s `TREND_PRESETS` (`trendEngine.ts:47-90`), which
     already contains an entry literally named **`quietLuxury`** (label
     `'Quiet Luxury'`, `trendEngine.ts:48-54`) plus
     `darkAcademiaBotanical`/`cleanScandiMinimal`/`coastalCalm` — more
     near-matches for the same brief list, under a *different* mechanism
     (real-computed `computeTrendFit` against declared hue/saturation/
     lightness/density/overlap ranges, not Style DNA's category/layout/
     palette/hierarchy resolution).
   A Build 011 Section 7 that invents a *third* named-profile system (e.g. a
   fresh `ART_DIRECTION_PROFILES` table) would be adding a third parallel
   taxonomy for the same "named design identity" concept `styleDna.ts` and
   `trendEngine.ts` already both cover, each with its own resolution
   mechanism. See §7 below for the scoped recommendation (extend Style DNA's
   existing presets with the missing structural fields; do not build a
   parallel system).

2. **Section 9 ("Commercial Appeal Score V2... replace purely technical
   scoring with commercial evaluation") is functionally already shipped
   twice.** `critic/commercialPatternCritic.ts` (Build 006 §8) already
   computes `luxuryFeeling`/`editorialFeeling`/`premiumFeeling` plus
   `fabricFeeling`/`wallpaperFeeling`/`giftWrapFeeling` — i.e. exactly
   "Luxury Feel" + a "Product Suitability" per-product signal the brief asks
   for. `engine/commercialStyleAnalysis.ts` (Build 006 §1) independently
   scores 10 commercial dimensions against real portfolio-measured p10/p90
   bands. `engine/luxuryComposition.ts` (Build 009 §7) already aggregates 7
   luxury-composition principles into one `overall` score. A Build 011
   "Commercial Appeal Score V2" that doesn't explicitly reuse/aggregate these
   three would be a fourth parallel "how commercial does this look" number.
   See §9 below.

3. **Section 1 ("Artistic Balance Engine... visual mass, silhouette
   complexity, color dominance, detail density, negative space") has no
   single existing home, but every one of its five named sub-concepts
   already has a real, computed proxy elsewhere** (`computeWeight`'s
   role-weighted `scale²` in `compositionIntelligence.ts:75-78`,
   `heroDetailRatio`/`motifShapeDiversity` in `scoring.ts`,
   `paletteContrast`/`colorBalance` in `scoring.ts`, `largestEmptyRegion` in
   `scoring.ts`). Grepping this codebase for the literal terms `visualMass`,
   `colorDominance`, `detailDensity` returns zero hits — these exact names
   are genuinely new — but the underlying measurements are not. See §1.

4. **The FlowProfile/CompositionZone/EyeFlowPath eye-path pile (carried
   forward from Build 009's and Build 010's own audits) is still exactly
   three, still un-unified, and no Build 011 section needs to touch it.**
   None of the 10 brief sections ask for a new eye-path/flow mechanism —
   Section 4's "Editorial Layout Intelligence" is about per-product layout
   *archetypes* (composition zone + hierarchy preset + layout id bundles,
   already exactly what Style DNA resolves), not a new directional-pull
   mechanism. Build 011 should leave `FlowProfile`/`CompositionZone`/
   `EyeFlowPath` exactly as they are and not add a fourth. The recommendation
   to unify them stays deferred to its own dedicated build, unchanged from
   Build 009 §15 / Build 010 §16.

5. **Section 10's "1000 Pattern Consistency Portfolio" is a new 4th tier**,
   additive alongside the existing scenario-suite (30) / 100-pattern
   portfolio / `large` 300-pattern / `xl` 500-pattern tiers in
   `scripts/qualityReport.ts`. Following the exact precedent Build 010 set
   when it added the 500-pattern `xl` tier without touching the 300-pattern
   `large` tier (`qualityReport.ts:309-334`): 15 `STYLE_DNA_PRESETS` doesn't
   divide evenly into 1000 either (1000/15 = 66.67) — the harness will need
   ~67 seeds per preset (1005 pairs), deterministically trimmed to the first
   1000 in preset-major order, recording the 5 dropped pairs exactly like
   `xlPortfolio.droppedPairs` already does (`qualityReport.ts:328-334`). This
   is also the natural place Section 8's Portfolio Consistency Engine
   (style-drift detection across many tiles of the *same* preset) gets a
   real, large-n sample to measure against — the existing tiers only ever
   sample 20-34 seeds per preset, too few to measure "does this preset stay
   internally consistent across 1000 outputs" meaningfully.

6. **Real product taxonomy check**: `ProductUseId` (`collection/
   productTargets.ts:10-20`) is unchanged since Build 009/010's own audits —
   still exactly 10 values: `wallpaper`, `fabric`, `wrappingPaper`,
   `giftWrap`, `packaging`, `notebookCovers`, `stationery`, `homeDecor`,
   `textile`, `digitalPaper`. Every "Editorial"/"Magazine"/"Luxury Floral"/
   "Luxury textile"/"Greeting card"/"Poster" term in the brief has to map
   through this real 10-value set (or the separate, real `StyleDna` preset
   taxonomy) — see the full mapping table at the end of this document. Two
   terms (**Magazine**, **Editorial** as a product) have no honest 1:1
   `ProductUseId` — flagged, not invented.

---

## Real taxonomy reuse (per every prior build's own convention)

- `ProductUseId` (10 values, see Key Finding 6) is still the only real
  product taxonomy.
- `MotifRole` stays the closed 4-value union (`hero`/`secondary`/`filler`/
  `accent`, `hierarchy.ts:4`) — no Build 011 section needs a 5th value.
  Section 1's "visual mass" and Section 6's "detail hierarchy" both already
  have real per-role scaffolding (`ROLE_WEIGHT`/`computeWeight` in
  `compositionIntelligence.ts:73-78`; `ROLE_DETAIL_LEVEL` in
  `heroComplexity.ts:42-47`) keyed on this exact same 4-value union.
- `STYLE_DNA_PRESETS` (15 values, `styleDna.ts:199-201`) is the real,
  already-shipped "named art-direction profile" taxonomy — see Key Finding 1
  and §7 below for why Section 7 must extend this (and `TREND_PRESETS`), not
  invent a third.
- `CompositionZone` (10 values, `compositionZones.ts:32-46`),
  `HIERARCHY_PRESETS` (7 values, `hierarchy.ts:63-89`), and `LayoutId` (14
  values, `types.ts:124-138`) are the three real structural building blocks
  every Style DNA preset already resolves from — Section 4's "layout
  archetypes per product" is a real combination of these three tables, not a
  new concept (see §4).
- `ClusterArchetype` (13 values, `clusterEngine.ts:22-45`) vs.
  `HERO_ARCHETYPE_POOL` (5 values, `premiumHero.ts:277`) — same distinction
  Build 009/010 already drew; Section 5's silhouette-diversity work must
  keep using `HERO_ARCHETYPE_POOL` as the honest denominator for
  hero-silhouette measurements, never the full 13-value union.
- `BotanicalFamily` (19 values, `botanicalFamilies.ts:28-47`) and
  `BOTANICAL_SILHOUETTES` (8 values, `botanicalFamilies.ts:100-102`) are the
  real species/silhouette taxonomies Section 5's "silhouette diversity"
  measurement must reuse (`computeHeroDiversity`,
  `portfolioQuality.ts:109-115`), not a new one.
- `ColorStrategy` (4 values: `dominantDuo`/`fullPalette`/`monochromeAccent`/
  `highContrast`, `styleDna.ts:53`) is the closest existing thing to Section
  3's "dominant/supporting/accent color roles" — see §3.

---

## Section 1 — Artistic Balance Engine

**Brief ask**: true perceived visual-weight balancing (visual mass,
silhouette complexity, color dominance, detail density, negative-space
influence), replacing simple geometric balance.

**Already exists**:
- `compositionIntelligence.ts:73-78` — `ROLE_WEIGHT`/`computeWeight`
  already compute a real *perceptual* weight (`scale² × role bump`, hero
  1.5x, secondary 1.15x, filler 0.85x, accent 0.6x) rather than raw
  geometric area — this is already "visual mass, not just geometric
  balance." `applyGridBalanceCorrection`/`applyBalanceCorrection`
  (`compositionIntelligence.ts:119-173`) already redistribute placements
  using this weighted measure, at 2x2 (macro) resolution.
- `scoring.ts:150-177`'s `computeBalance` (`quadrantBalance`/
  `horizontalBalance`/`verticalBalance`) is the "simple geometric balance"
  the brief wants replaced — but it's a *measurement*, not the thing that
  moves placements; the thing that moves placements
  (`applyGridBalanceCorrection`) already uses the perceptual weight above,
  not raw counts.
- Silhouette complexity: `scoring.ts`'s `motifShapeDiversity`
  (`computeMotifShapeDiversity`, `scoring.ts:434-446`, Shannon entropy over
  real shape-topology signatures) and `heroDetailRatio`
  (`computeHeroDetailRatio`, `scoring.ts:493-502`, hero vs. filler/accent
  average node count) are real, already-measured detail/complexity signals.
- Color dominance: `scoring.ts:209-216`'s `computeColorBalanceAndContrast`
  (`colorBalance`/`paletteContrast`) and `colorAnalysis.ts:64-71`'s
  `colorSetStats` (mean hue/saturation/lightness of the real resolved
  palette) are the existing color-weight signals.
- Negative-space influence: `scoring.ts:289-322`'s
  `computeLargestEmptyRegion` is the real existing measurement;
  `compositionIntelligence.ts:196-198`'s `applyNegativeSpaceCorrection` (an
  8x8-resolution version of the same weighted-redistribution mechanism) is
  the existing mover.
- `heroComplexity.ts:42-47`'s `ROLE_DETAIL_LEVEL` (hero 100/secondary
  55/filler+accent 0) is a real, already-shipped "detail density by role"
  scaffold — see also §6.

**Genuinely missing**: no single function combines all five named factors
into one "true perceived visual weight" number per placement — today
`computeWeight` only factors in scale+role (not shape complexity, not color
saturation/contrast, not the placement's own local negative-space context).
Grepped explicitly: `visualMass`, `colorDominance`, `detailDensity` all
return zero hits anywhere in `app/src` — these exact terms are new, even
though every ingredient is real.

**Recommendation**: extend `computeWeight` (`compositionIntelligence.ts:75`)
into a richer `computePerceivedWeight(p: Placement, context)` that blends
the existing `scale² × ROLE_WEIGHT` term with a real per-instance shape-
complexity factor (reuse `MotifInstance.nodeCount`, already extracted by
`svgGeometry.ts` for `computeHeroDetailRatio`/`computeMotifShapeDiversity` —
no new SVG parsing needed) and a real per-instance color-saturation/contrast
factor (reuse `colorAnalysis.ts`'s `hexToHsl` on the placement's own
resolved color, not a re-derived formula). Feed this richer weight into
`applyGridBalanceCorrection` in place of the current `computeWeight` call
(both call sites, `applyBalanceCorrection` and
`applyNegativeSpaceCorrection`) so both macro and meso balance correction
become perceptually-weighted, not just scale-weighted. Do not build a
parallel "Artistic Balance Engine" module — this is a real, scoped extension
of `compositionIntelligence.ts`'s existing weighted-redistribution
mechanism, the same "one mechanism, two resolutions" precedent that module's
own doc comment (`compositionIntelligence.ts:110-118`) already established
for balance vs. negative-space correction.

---

## Section 2 — Luxury Negative Space Engine

**Brief ask**: dedicated spacing philosophy per product category
(Wallpaper, Fabric, Gift Wrap, Packaging, Editorial, Luxury Floral).

**Already exists, extensively**: `engine/negativeSpaceDesigner.ts` is
already exactly this, three builds deep:
- `PRODUCT_NEGATIVE_SPACE_ADJUSTMENT` (Build 006 §5, `negativeSpaceDesigner
  .ts:21-38`) — a real per-`ProductUseId` negative-space nudge (wallpaper
  -0.05, fabric -0.03, giftWrap +0.12, packaging +0.05, etc.).
- `ProductSpacingStrategy` (Build 009 §3 + Build 010 §7,
  `negativeSpaceDesigner.ts:81-104`) — `rhythmMultiplier`/
  `clusterLooseness`/`preferredZones`/`depthStrength`/`premiumRhythm`/
  `professionalRules`, all keyed by the real `ProductUseId`
  (`PRODUCT_SPACING_STRATEGY`, `negativeSpaceDesigner.ts:108-130`) —
  wallpaper/fabric/textile get tighter rhythm + tighter clusters (a busier
  all-over field); giftWrap/wrappingPaper/packaging/stationery get looser
  rhythm + real cluster isolation + depth-plane separation (a focal
  gift-worthy moment).
- Wired end-to-end in `tile.ts:241` (`resolveNegativeSpaceForProduct`) and
  `tile.ts:322` (`applyProductSpacingStrategy`).

**Genuinely missing**: only 2 of the brief's 6 named categories
(Wallpaper, Fabric, Gift Wrap, Packaging) have a direct 1:1 `ProductUseId`.
"Editorial" and "Luxury Floral" have no `ProductUseId` at all (see the
mapping table) — the existing per-product strategy table cannot express a
spacing philosophy for either term under those exact names today.

**Recommendation**: this section's real, scoped job is narrower than the
brief implies — extend `PRODUCT_SPACING_STRATEGY`'s existing 10-entry table
with one more real dimension only if Sections 1/3/5/6 below produce new
tunable fields worth a per-product default (following the identical
`IDENTITY_SPACING_STRATEGY` no-op convention, `negativeSpaceDesigner.ts:106`).
For "Editorial" and "Luxury Floral" specifically: do not invent a fake
`ProductUseId`. "Editorial" already has a real, if less commercial-target-
shaped, analog in `CompositionZone`'s `'editorial'` zone
(`compositionZones.ts:40`) and the `editorialBotanical` Style DNA preset
(`hierarchyPreset: 'balancedEditorial'`,
`preferredZones: ['editorial', ...]`,
`bestProductTargets: ['stationery', 'digitalPaper']` — knowledge/registry/
data/styles/editorialBotanical.json:12-16,48-51). "Luxury Floral" is
literally the existing `luxuryFloral` Style DNA preset id
(`bestProductTargets: ['wallpaper', 'homeDecor']`,
knowledge/registry/data/styles/luxuryFloral.json:54-57). Both terms should
resolve through the Style DNA layer's own product-target hints, not a new
product enum value.

---

## Section 3 — Color Harmony Intelligence

**Brief ask**: dominant/supporting/accent color roles, temperature balance,
contrast rhythm, palette energy — avoid equal-distribution coloring.

**Already exists**:
- `styleDna.ts:53`'s `ColorStrategy` (`dominantDuo`/`fullPalette`/
  `monochromeAccent`/`highContrast`) is a real, already-resolved
  "how should this palette's colors be weighted" dial — `dominantDuo` is
  functionally "2 dominant colors + occasional pops," already closer to
  "dominant/accent roles" than an equal distribution.
- `tile.ts:209-222`'s Color Story mechanism (`useStory`/`storyColors`) is
  the actual *runtime* implementation of dominant-vs-accent weighting:
  "pick 2 dominant accents once per tile; most placements draw with just
  those [~72% of the time, `tile.ts:376`], the rest keep the full palette
  as accent pops" — this is the real, already-shipped mechanism that avoids
  equal-distribution coloring today.
- `palettes/commercialColorStories.ts` (Build 006 §4) already computes real
  `temperature`/`contrast`/`neutralBalance` per named color story —
  `computeTemperature` (`commercialColorStories.ts:66-78`, saturation-
  weighted warm/cool hue balance) and `computeContrast`
  (`commercialColorStories.ts:53-59`, lightness range) are exactly the
  brief's "temperature balance"/"contrast rhythm" concepts, already real
  and computed from actual hex colors (never hand-typed).
  `CommercialColorStory.accentColors` (`commercialColorStories.ts:32-33`)
  is a real, curated "which colors are the accent/hero colors" field.
- `engine/colorAnalysis.ts`'s `colorSetStats`/`hexToHsl`/`meanHue` (circular
  hue mean, since hue wraps at 360°) are the real HSL primitives
  `engine/trendEngine.ts`'s `computeTrendFit` already uses to measure a
  *generated tile's* actual hue/saturation/lightness against a declared
  target — this is the reuse point for a genuine "palette energy" score.
- `scoring.ts:209-216`'s `paletteContrast`/`colorBalance` are the existing
  per-tile measured color metrics.
- `portfolioVariety.ts:117-120`'s `colorHarmony: ColorStrategy` field (Build
  004 §11) already tracks color-strategy diversity across a portfolio batch.

**Genuinely missing**: nothing computes a per-tile "dominant color role"
(which specific hex is *the* dominant one vs. which are accents) as a
first-class, inspectable field — today `storyColors` (`tile.ts:216-222`)
picks 2 *accent* indices at random each generation; there's no persistent
"role" concept for individual palette colors the way `MotifRole` exists for
placements. "Palette energy" as a single named score doesn't exist anywhere
(grepped `energy` — only hits in unrelated contexts).

**Recommendation**: extend `Palette`/`CommercialColorStory`
(`palettes/palettes.ts:5-10`, `commercialColorStories.ts:25-42`) with an
optional `colorRoles?: { dominant: string[]; accent: string[] }` field
(defaulting to the current `colors[0]`-is-background /
`accentColors(colors)`-is-everything-else convention when unset — a strict
no-op for every existing palette), and thread it into `tile.ts`'s existing
Color Story block (`tile.ts:209-222`) so `storyColors` picks from the
declared `dominant` set specifically rather than a fresh random index each
time. Add one new real measured field to `CompositionMetrics` or as a small
new module (`computePaletteEnergy`) built from `colorSetStats`'s existing
saturation/lightness spread — reusing `colorAnalysis.ts`, never
re-implementing HSL math. Do not invent a new color-role type parallel to
`ColorStrategy` — extend it.

---

## Section 4 — Editorial Layout Intelligence

**Brief ask**: layout archetypes per product (Magazine, Luxury textile,
Wallpaper, Greeting card, Gift wrap, Poster), each with distinct visual
hierarchy.

**Already exists**: this is, structurally, exactly what a Style DNA preset
already is — a bundle of `layouts` + `preferredZones` + `hierarchyPreset` +
density/negativeSpace/overlap, resolved deterministically per seed
(`resolveStyleDna`, `styleDna.ts:300-393`). Concretely, per named term:
- **Wallpaper**: `luxuryWallpaper` preset — `layouts: ['densePremium',
  'halfDrop']`, `hierarchyPreset: 'denseLayered'`,
  `bestProductTargets: ['wallpaper', 'homeDecor']`
  (knowledge/registry/data/styles/luxuryWallpaper.json).
- **Luxury textile**: `premiumTextile` preset — `layouts: ['halfDrop',
  'brick']`, `hierarchyPreset: 'allOverTextile'`,
  `bestProductTargets: ['fabric', 'textile']`
  (knowledge/registry/data/styles/premiumTextile.json).
- **Gift wrap / Packaging**: `boutiquePackaging` preset — `layouts:
  ['stripe', 'gridMinimal']`, `hierarchyPreset: 'allOverTextile'`,
  `bestProductTargets: ['packaging', 'giftWrap']`
  (knowledge/registry/data/styles/boutiquePackaging.json); also
  `PRODUCT_SPACING_STRATEGY.giftWrap`/`.packaging`
  (`negativeSpaceDesigner.ts:125,127`) already gives these products their
  own `preferredZones: ['centerFocus', 'goldenRatio']`/`['centerFocus',
  'cornerFlow']`.
- **Greeting card**: no `ProductUseId` named this; the established Build
  009/010 audit precedent (`BUILD_010_AUDIT.md`'s "Real taxonomy reuse")
  maps Greeting Card → `stationery`. `editorialBotanical`'s
  `bestProductTargets: ['stationery', 'digitalPaper']` and
  `softWatercolorInspired`'s `STYLE_USAGE_PROFILE` entry `'greetingCard'`
  (`styleDna.ts:229`, a real `UsageProfileId`,
  `knowledge/registry/speciesSchema.ts:61-70`) are the two real, existing
  handles for this concept.
- **Magazine / Poster**: neither has a `ProductUseId` nor a dedicated Style
  DNA preset. The closest real analogs: `CompositionZone`'s `'editorial'`
  zone (row-banded skeleton, `compositionZones.ts:160-169`) for "Magazine,"
  and the established Build 010 audit precedent Poster/Canvas → `homeDecor`
  for "Poster." Neither is an honest exact match — flagged, not invented.

**Genuinely missing**: no product-keyed *layout archetype table* exists
independent of the Style DNA preset system — today, "which layout suits
Wallpaper" is only discoverable by reading `luxuryWallpaper`'s own
hand-authored `layouts` field, not from a queryable
`LAYOUT_ARCHETYPE_FOR_PRODUCT` table the way `PRODUCT_SPACING_STRATEGY`
exists for spacing. `resolveCompositionZoneForProduct`
(`negativeSpaceDesigner.ts:171-174`) resolves a zone per product but not a
full layout+hierarchy bundle.

**Recommendation**: add a `LAYOUT_ARCHETYPE_FOR_PRODUCT: Record<ProductUseId,
{ layouts: LayoutId[]; hierarchyPreset: keyof typeof HIERARCHY_PRESETS }>`
table in `negativeSpaceDesigner.ts` (sibling to `PRODUCT_SPACING_STRATEGY`,
same shape/no-op convention), populated from the *already-real* values each
matching Style DNA preset already declares (wallpaper from
`luxuryWallpaper`, fabric/textile from `premiumTextile`, giftWrap/packaging
from `boutiquePackaging`, stationery from `editorialBotanical`) rather than
inventing new layout/hierarchy combinations — a `productTarget`-only caller
(no Style DNA active) gets a real, already-tuned layout archetype as a
fallback, the same "product's own best fit, only when nothing more specific
already chose" convention `resolveCompositionZoneForProduct` established.
Do not build a parallel "layout archetype" enum — reuse `LayoutId` +
`HIERARCHY_PRESETS` directly.

---

## Section 5 — Silhouette Intelligence

**Brief ask**: increase silhouette diversity, avoid repeating hero
silhouettes, measure silhouette uniqueness across a portfolio.

**Already substantially shipped** (Build 008B §7 + Build 009 §6):
- `premiumHero.ts:268`'s `HERO_SILHOUETTE_ARCHETYPES` (7-entry weighted pool
  over 5 distinct `ClusterArchetype`s: `bouquet`×3, `cascade`, `diagonal`,
  `asymmetric`, `editorial`) already diversifies hero silhouette shape away
  from a single circular bouquet.
- `premiumHero.ts:277`'s `HERO_ARCHETYPE_POOL` (the 5 real, reachable
  archetypes) is the honest denominator already established for
  hero-silhouette diversity measurement.
- `premiumHero.ts:284-286`'s `resolveHeroArchetype` is the real resolver;
  `types.ts:38-50`'s `Motif.heroArchetype` threads the *actual* resolved
  archetype back through `TileData.premiumHeroArchetypes`
  (`types.ts:329-333`) for portfolio-level measurement.
- `portfolioQuality.ts:136-140`'s `computeHeroArchetypeDiversity` already
  measures "fraction of the 5 reachable archetypes a portfolio run's
  premium heroes actually used" — wired into `qualityReport.ts:568`
  (`heroArchetypeDiversity`) for the 100-pattern portfolio already.
- `portfolioQuality.ts:109-115`'s `computeHeroDiversity` separately measures
  fraction of the real 8-value `BOTANICAL_SILHOUETTES` taxonomy
  (`botanicalFamilies.ts:100-102`) a portfolio's species selection covered —
  a genuinely different facet (species-level silhouette vs.
  cluster-arrangement-level silhouette), both already real.

**Genuinely missing**: there's no mechanism that actively *avoids
repeating* a specific hero silhouette *within one batch/portfolio run* —
today `resolveHeroArchetype` is a plain weighted random roll
(`rngPick(rng, HERO_SILHOUETTE_ARCHETYPES)`, no memory of what prior
patterns in the same batch already rolled). This is exactly the gap
`portfolioVariety.ts`'s `assignBatchValues` shuffled-bag mechanism
(`portfolioVariety.ts:48-68`) already solves for `CompositionZone` and 8
other dimensions (`assignPortfolioDiversity`, `portfolioVariety.ts:151-179`)
— but `ClusterArchetype`/hero archetype specifically is not yet one of the
8 dimensions that function's `PortfolioDiversityCandidates` covers as a
constrained hero-archetype pool (it covers general `clusterType` via
`CLUSTER_ARCHETYPES`, the full 13-value union, not the 5-value
`HERO_ARCHETYPE_POOL` specifically).

**Recommendation**: extend `assignPortfolioDiversity`
(`portfolioVariety.ts:151`) with a `heroSilhouette` dimension using
`HERO_ARCHETYPE_POOL` (not the full `CLUSTER_ARCHETYPES`) as its candidate
pool — this makes "avoid repeating hero silhouettes across a batch" a real,
shuffled-bag guarantee the same way Composition Zone repetition was already
solved, for the one archetype pool this really applies to
(`premiumHero.ts`'s own reachable subset). For "measure silhouette
uniqueness across a portfolio," `computeHeroArchetypeDiversity` already
exists and is already wired — no new metric needed; Build 011's real job
here is wiring `HERO_ARCHETYPE_POOL` into the batch-assignment mechanism (a
`buildPremiumHero` caller passing an explicit `archetype` from the assigned
batch value instead of leaving `resolveHeroArchetype`'s roll unconstrained),
not adding a second diversity metric alongside the existing one.

---

## Section 6 — Premium Detail Distribution

**Brief ask**: detail hierarchy (hero highest, secondary medium, background
simplified), avoid uniform illustration density.

**Already exists, almost exactly as specified**:
- `heroComplexity.ts:42-47`'s `ROLE_DETAIL_LEVEL` is *precisely* this:
  `{ hero: 100, secondary: 55, filler: 0, accent: 0 }` — "hero highest,
  secondary medium, background [filler/accent] simplified" is the existing
  doc-commented intent (`heroComplexity.ts:37-41`: "Secondary gets a real
  but smaller boost than hero... filler and accent get none — they stay
  exactly the generator's own baseline shape, which is what keeps them
  cheap in both node count and visual weight relative to hero/secondary").
- `heroComplexity.ts:186-189`'s `sizeFactorFor` (Build 005 §7, Premium
  Detail System) already refines this role-based level continuously by the
  placement's *actual rendered scale*, not just discrete role tiers — a
  hero placed unusually large gets a real detail boost past baseline; one
  placed unusually small gets pulled back toward filler-like simplicity.
  This is already "avoid uniform illustration density" at the per-instance
  level.
- `heroComplexity.ts:191-201`'s `densityDamping` already reduces detail
  overlay probability once a tile's own instance count passes 400 — a
  real, already-shipped "detail density should adapt to how busy the tile
  already is" mechanism.
- `scoring.ts:493-502`'s `computeHeroDetailRatio` already *measures*
  whether "hero" genuinely means more detail (avg hero node count vs. avg
  filler/accent node count) — this is the existing verification metric for
  exactly this section's own ask.
- `illustrationQualityV2.ts`'s `computeLeafRealism` (`illustrationQualityV2
  .ts:110-131`) and `computeBouquetQuality`/`computeGestureQuality`/
  `computeFlowerRealism` already measure detail-completeness specifically
  for botanical sub-parts (leaves/companion-foliage/gesture-lean/flower-
  center), a finer-grained detail-distribution signal than the flat
  hero/secondary/filler/accent tiers alone.

**Genuinely missing**: `ROLE_DETAIL_LEVEL` is a flat 2-tier reality (hero,
secondary get detail; filler, accent get none) rather than a true 3+-tier
gradient the brief's "hero highest, secondary medium, background
simplified" implies (filler and accent are both currently 0 — "background"
isn't distinguished from "slightly-more-than-background"). There's also no
detail-distribution measurement at the *portfolio* level (does this
preset's detail gradient stay consistent across many generations) — only
per-tile (`computeHeroDetailRatio`).

**Recommendation**: this section's honest, scoped job is small: give
`filler` a nonzero (but still clearly below secondary's 55) detail level in
`ROLE_DETAIL_LEVEL` — e.g. `filler: 15, accent: 0` — so "background" reads
as "simplified but not featureless" rather than "identical to accent,"
which is the literal brief distinction ("background simplified" implies
*some* detail, just less). This is a one-line, fully backward-compatible-if-
gated change (new field could stay `0` by default via a `detailDistribution`
opt-in flag on `GenerateParams`, following the exact "undefined = prior
behavior" convention every other optional field in this codebase uses) —
not a new module. Do not build a parallel detail-overlay system;
`applyHeroDetailOverlay` (`heroComplexity.ts:217-234`) already IS the
Premium Detail Distribution mechanism.

---

## Section 7 — Commercial Trend Engine

**Brief ask**: structural art-direction profiles (Quiet Luxury, Scandinavian
Organic, Vintage Botanical, Modern Cottagecore, Dark Botanical, Minimal
Organic, Maximal Floral) — structural design profiles, not copies of
existing artwork.

**Already exists, in two separate systems** (see Key Finding 1):

| Brief profile | Closest existing match | Where |
|---|---|---|
| Quiet Luxury | `TREND_PRESETS.quietLuxury` (label **"Quiet Luxury"**, exact) | `trendEngine.ts:48-54` |
| Scandinavian Organic | `STYLE_DNA_PRESETS.scandinavianOrganic` (label **"Scandinavian Organic"**, exact) | `knowledge/registry/data/styles/scandinavianOrganic.json` |
| Vintage Botanical | `STYLE_DNA_PRESETS.vintageHerbarium` (label "Vintage Herbarium" — close, not exact) | `knowledge/registry/data/styles/vintageHerbarium.json` |
| Modern Cottagecore | No exact match. `bohoFloral` (warm/terracotta/layered) or `TREND_PRESETS.coastalCalm` are the nearest existing structural neighbors, neither an honest match | — |
| Dark Botanical | `STYLE_DNA_PRESETS.darkBotanical` (label **"Dark Botanical"**, exact) *and* `TREND_PRESETS.darkAcademiaBotanical` (close) | `knowledge/registry/data/styles/darkBotanical.json`, `trendEngine.ts:69-75` |
| Minimal Organic | `STYLE_DNA_PRESETS.minimalBotanical` (close) *and* `TREND_PRESETS.cleanScandiMinimal` (close, geometric not organic) | `knowledge/registry/data/styles/minimalBotanical.json`, `trendEngine.ts:83-89` |
| Maximal Floral | `TREND_PRESETS.softMaximalism` (close, "Soft Maximalism") — no floral-specific maximal preset exists | `trendEngine.ts:76-82` |

Every existing profile in both systems is already "structural" in exactly
the brief's intended sense — a bundle of real engine parameters (category,
layout, palette, hierarchy, density, overlap, and for `TREND_PRESETS`
specifically a real declared hue/saturation/lightness/density/overlap
*signature* checked against actual generated output via `computeTrendFit`,
`trendEngine.ts:153-171`), never a copied reference image.

**Genuinely missing**: 3 of the 7 brief names (Vintage Botanical, Modern
Cottagecore, Maximal Floral) have no *exact*-label match in either system,
though close structural neighbors exist in all three cases. There is no
single unified place that resolves "Quiet Luxury" the same way regardless
of whether it's approached as a Style DNA preset or a Trend preset — they
remain two independent mechanisms (Style DNA resolves category/layout/
palette/hierarchy deterministically per seed; Trend only patches
density/overlap/palette-story and separately *measures* fit against a
declared signature).

**Recommendation**: do **not** build a third named-profile table. Two real,
narrow, additive options, both reusing what exists:
1. Add the 3 missing exact labels as new `TREND_PRESETS` entries (Vintage
   Botanical, Modern Cottagecore, Maximal Floral), following the exact
   existing `TrendPreset` shape (`trendEngine.ts:30-45`) and reusing already-
   real categories/layouts/palettes (e.g. Vintage Botanical ≈
   `vintageHerbarium`'s own `categoryId: 'botanical'`,
   `paletteId: 'earth-tone'`/`'terracotta'`, `hierarchy: 'allOverTextile'`)
   rather than inventing new engine parameters.
2. For the 4 that already have an exact-or-close `STYLE_DNA_PRESETS` label,
   Section 7's real, scoped job is cross-referencing: add an optional
   `trendPresetId?: string` field to `StyleDna`
   (`styleDna.ts:76-141`) so a Style DNA preset can declare which
   `TREND_PRESETS` entry it structurally corresponds to (or vice versa) —
   letting `computeTrendFit`'s real signature-matching apply to Style-DNA-
   originated tiles too, unifying measurement without unifying the two
   resolution mechanisms (which is out of scope — see Key Finding 4's
   general principle applied here: don't merge working systems inside a
   refinement build).

---

## Section 8 — Portfolio Consistency Engine

**Brief ask**: measure whether 1000 generated images feel like one premium
brand; consistency metrics; style-drift detection.

**Already exists, partially**:
- `styleDna.ts:451-457`'s `computeStyleDnaConsistency` (SVG Intelligence
  Engine Phase 3 §12) already measures **per-tile** style drift: declared
  `density`/`motifComplexity` vs. measured `occupancyRatio`/
  `rotationDiversity` — real "does the rendered geometry actually match this
  style's own declared intent" drift detection, already wired into
  `qualityReport.ts:162` (`styleFitQuality`) for every portfolio tile.
- `portfolioQuality.ts:161-173`'s `computeSignatureFingerprintDistinctness`
  (Build 010 §9) already measures cross-*preset* consistency — the
  opposite direction (do 15 different presets stay genuinely distinct from
  each other) rather than within-one-preset consistency across many seeds,
  but the exact same "fraction of pairs whose signature differs" idiom is
  directly reusable for the opposite question (do many *same-preset*
  outputs share a genuinely *similar* fingerprint).
- `styleDna.ts:413-424`'s `computeStyleDrift` measures a different thing
  again — declared vs. currently-applied *input params* (has the user
  hand-edited away from the style), not rendered-output consistency.
- `qualityReport.ts`'s existing `byStyleDna` breakdown (`breakdownBy`,
  `qualityReport.ts:429-436`, wired for `portfolio`/`largePortfolio`/
  `xlPortfolio`) already reports per-style aggregate stats (mean/median/p10/
  p90) across every tier — the raw material a real cross-tile consistency
  measurement (e.g. "how tight is the p10-p90 spread for
  `absoluteCommercialQuality` within `luxuryFloral` specifically, across 500
  seeds") already sits inside every existing report.

**Genuinely missing**: nothing measures *within-preset* output-to-output
similarity directly (i.e. "do these 500 `luxuryFloral` tiles look like they
came from one coherent brand, or do they visually scatter") — the existing
`stats()` p10/p90 spread per metric per style (already in every
`byStyleDna` breakdown) is a real proxy but nobody has named it "consistency"
or blended it into one score. "Style drift" across a *sequence* (does
quality/character degrade or wander as you go seed-1 → seed-1000) isn't
measured at all — every existing measurement is a flat aggregate over the
whole sample, order-independent.

**Recommendation**: add a `computePortfolioConsistency` function to
`portfolioQuality.ts` (sibling to `computeSignatureFingerprintDistinctness`)
that, given one preset's `EvalResult[]` slice from the new 1000-pattern
tier (see §10), computes the **inverse** of the coefficient-of-variation
across a small, real, already-computed set of headline metrics
(`absoluteCommercialQuality`, `luxuryComposition.overall`,
`commercialPatternCritique.luxuryFeeling`) for that one preset's samples —
low variance = high consistency, following the same "coefficient of
variation, inverted" idiom `scoring.ts`'s own `computeSpacing`/
`computeSpacingUniformity` already use. Do not invent a new "brand
consistency" concept from scratch — reuse the stats already computed by
`stats()` (`qualityReport.ts:73-89`), just regrouped per-preset instead of
per-metric, and reuse `computeStyleDnaConsistency`'s existing per-tile drift
number as one input rather than re-deriving drift. This is squarely a
`scripts/qualityReport.ts` + `portfolioQuality.ts` extension, not a new
top-level module.

---

## Section 9 — Commercial Appeal Score V2

**Brief ask**: replace purely technical scoring with commercial evaluation
(Luxury Feel, Editorial Quality, Shelf Impact, Premium Impression, Product
Suitability, Collection Consistency) — derived from measurable heuristics
only, no invented numbers.

**Already shipped, three times over** (see Key Finding 2):
- **Luxury Feel** = `commercialPatternCritique.luxuryFeeling`
  (`commercialPatternCritic.ts:74`, `heroDetailRatio×0.4 + paletteContrast
  ×0.3 + cornerContinuity×0.3`) — already real and named almost identically.
- **Editorial Quality** = `commercialPatternCritique.editorialFeeling`
  (`commercialPatternCritic.ts:75`, `flowCoherence×0.5 + rhythmRegularity
  ×0.3 + spacing×0.2`).
- **Premium Impression** = `commercialPatternCritique.premiumFeeling`
  (`commercialPatternCritic.ts:76`) *and* `botanicalBeautyMetrics.ts:187`'s
  `luxuryFeeling` *and* `illustrationQualityV2.ts:151`'s `premiumFeel` — three
  independently-named "premium" scores already exist for botanical tiles
  specifically.
- **Product Suitability** = `evaluateProductTargets`
  (`collection/productTargets.ts:121-176`, already a real rule-based score
  per `ProductUseId`) plus `commercialPatternCritique.fabricFeeling`/
  `wallpaperFeeling`/`giftWrapFeeling` (`commercialPatternCritic.ts:86-88`).
- **Shelf Impact**: no exact existing name, but `computeHeroVisibilityScore`
  (`scoring.ts:776-780`, "does the hero motif actually read as the focal
  point of the tile, at a glance") is functionally identical in intent — a
  stock-thumbnail's "shelf impact" *is* hero visibility at a glance.
- **Collection Consistency**: this is Section 8's own Portfolio Consistency
  Engine, not a sixth independent dimension — see §8 above.
- `engine/commercialStyleAnalysis.ts`'s 10-dimension `overallFit`
  (`commercialStyleAnalysis.ts:147-173`) and `luxuryComposition.ts`'s
  7-dimension `overall` (`luxuryComposition.ts:97-109`) are two more
  already-shipped "one commercial number" composites.

**Genuinely missing**: no single function currently combines *all six*
brief-named dimensions under one `CommercialAppealScoreV2` umbrella — they
exist scattered across `commercialPatternCritic.ts`,
`commercialStyleAnalysis.ts`, `scoring.ts`'s `computeHeroVisibilityScore`,
and `botanicalBeautyMetrics.ts`/`illustrationQualityV2.ts` (the latter two
botanical-only). A caller wanting "the one commercial appeal number" has to
know to check 3-4 different modules today.

**Recommendation**: this section's real, scoped job is a **thin aggregator**,
not a new scoring computation — a `computeCommercialAppealScoreV2` function
(new small module or added to `commercialPatternCritic.ts`) that assembles:
`luxuryFeel = commercialPatternCritique.luxuryFeeling`,
`editorialQuality = commercialPatternCritique.editorialFeeling`,
`shelfImpact = computeHeroVisibilityScore(metrics)`,
`premiumImpression = commercialPatternCritique.premiumFeeling`,
`productSuitability = average of evaluateProductTargets scores` (or the max,
for "best-fit product"), `collectionConsistency = ` Section 8's new
per-preset consistency number when available (undefined/omitted for a
single non-portfolio tile, the same "only real inputs, never padded"
convention `commercialStyleAnalysis.ts`'s own doc comment already
establishes at `commercialStyleAnalysis.ts:114-116`). Every one of the six
sub-scores is a direct read of an already-real, already-tested number —
zero new heuristics need inventing, exactly matching the brief's own "no
invented numbers" requirement. Do not replace `computeOverallScore`
(`scoring.ts:900-916`, the *technical* score used by `candidateEngine.ts`'s
reject/retry loop) — that remains the geometry-only gate; Commercial Appeal
Score V2 is a parallel, commercially-framed *reporting* number, not a
scoring-loop replacement, the same "Absolute vs. commercial" separation
`qualityReport.ts`'s own header comment (`qualityReport.ts:54-64`) already
establishes and requires staying separate.

---

## Section 10 — Evaluation & Shipping

Not scoped in depth per the brief's own instruction — noting the real,
existing state per the task:

- The frozen harness is `app/scripts/qualityReport.ts`. Four tiers exist
  today: the 30-scenario suite (`SCENARIO_SUITE`, `qualityReport.ts:221-233`,
  always run), the 100-pattern portfolio (`runPortfolio`,
  `qualityReport.ts:281-287`, always run, 105→100 trim), the `large`
  300-pattern tier (`runLargePortfolio`, `qualityReport.ts:305-307`, 15×20
  seeds, opt-in CLI flag), and the `xl` 500-pattern tier
  (`runXlPortfolio`, `qualityReport.ts:328-334`, 15×34 seeds trimmed
  510→500, opt-in CLI flag, mutually exclusive with `large` per
  `qualityReport.ts:447-451`'s `process.argv[3]` check).
- A 1000-pattern tier is a genuine **5th** addition (30 / 100 / 300 / 500 /
  1000), not a resize of any existing one — see Key Finding 5 for the
  15-preset non-divisibility wrinkle (67 seeds/preset = 1005 pairs, trim to
  1000, record 5 dropped pairs). Given `xl` already roughly triples runtime
  over `large` per Build 010's own report, a 1000-pattern tier will need its
  own opt-in flag (e.g. `xxl` or `consistency`) rather than folding into
  `xl`, and should very likely become the dedicated large-sample input for
  Section 8's new per-preset consistency metric specifically (the existing
  tiers' 20-34 seeds/preset are too thin a sample for a meaningful
  within-preset spread measurement).
- `docs/build_reports/baselines/BUILD_010_final.json` (if committed per
  Build 010 §13's methodology) is the frozen baseline Build 011 should diff
  against, following the same convention every prior build report used.

---

## Product-name mapping (brief loose terms → real `ProductUseId` values)

The real, current `ProductUseId` enum (`collection/productTargets.ts:10-20`)
has exactly these 10 values — **verbatim**:

```
wallpaper | fabric | wrappingPaper | giftWrap | packaging |
notebookCovers | stationery | homeDecor | textile | digitalPaper
```

| Brief term (section) | Real mapping | Honest? |
|---|---|---|
| Wallpaper (§2, §4) | `wallpaper` | Exact |
| Fabric (§2) | `fabric` | Exact |
| Gift Wrap (§2, §4) | `giftWrap` (also `wrappingPaper` exists as a distinct, real second value for the same general concept) | Exact |
| Packaging (§2, §4) | `packaging` | Exact |
| Editorial (§2) | **No exact `ProductUseId`.** Nearest real handles: `CompositionZone.editorial` (`compositionZones.ts:40`) and the `editorialBotanical` Style DNA preset, whose own `bestProductTargets: ['stationery', 'digitalPaper']` (knowledge/registry/data/styles/editorialBotanical.json:48-51) is the closest real, hand-authored product mapping that exists. | Not honest as a `ProductUseId` — flagged |
| Luxury Floral (§2) | Not a `ProductUseId` at all — it's the `luxuryFloral` **Style DNA preset id**, whose `bestProductTargets: ['wallpaper', 'homeDecor']` (knowledge/registry/data/styles/luxuryFloral.json:54-57) is its real product mapping. | Real, but a different taxonomy (Style DNA, not ProductUseId) |
| Magazine (§4) | **No real mapping at all.** Nearest structural analog: `CompositionZone.editorial` (row-banded skeleton) + `HIERARCHY_PRESETS.balancedEditorial`. No `ProductUseId`, no Style DNA preset literally named/targeted at "magazine." | Not honest — flagged, do not invent |
| Luxury textile (§4) | `textile` (`ProductUseId`, exact) + `premiumTextile` Style DNA preset (`bestProductTargets: ['fabric', 'textile']`, knowledge/registry/data/styles/premiumTextile.json:43-46) | Exact + reinforcing preset |
| Greeting card (§4) | `stationery` — the same mapping Build 009/010's own audits already established (`BUILD_010_AUDIT.md`'s "Real taxonomy reuse": "Greeting Card → `stationery`"), reinforced by `softWatercolorInspired`'s `UsageProfileId: 'greetingCard'` (`styleDna.ts:229`, a *different*, real taxonomy — species usage profile, not product target) | Real via established precedent, not a literal `ProductUseId` match |
| Poster (§4) | `homeDecor` — same established Build 010 audit precedent ("Poster/Canvas → `homeDecor`") | Real via established precedent, not a literal match |

**Two terms have no honest real mapping and should not be given an invented
one**: **Magazine** and **Editorial-as-a-product-category**. Both should be
handled the way Build 009/010 already handled similar gaps — either resolved
through the existing `CompositionZone`/Style-DNA layer (never a fabricated
`ProductUseId` member) or explicitly left unmapped in whatever new table
Build 011 adds, exactly like `resolveCompositionZoneForProduct`
(`negativeSpaceDesigner.ts:171-174`) already returns `undefined` rather than
guessing for a product with no declared zone preference.
