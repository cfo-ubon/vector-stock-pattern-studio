# Build 009 Audit — Commercial Art Director Engine

Read in full before writing any code: `engine/hierarchy.ts`,
`engine/compositionIntelligence.ts`, `engine/patternPhysics.ts`,
`engine/negativeSpaceDesigner.ts`, `engine/compositionZones.ts`,
`engine/portfolioQuality.ts`, `engine/commercialStyleAnalysis.ts`,
`critic/commercialPatternCritic.ts`, `engine/patternBeautyScore.ts`,
`engine/clusterEngine.ts`, `generators/premiumHero.ts`, `engine/scoring.ts`
(field list), `engine/types.ts` (`Placement`/`GenerateParams`).

## Key finding: this codebase already has an enormous amount of exactly
what Build 009 asks for — the real work is measurement, targeted
extension, and honest naming, not building from zero.

| Build 009 ask | Already real, already shipped |
|---|---|
| Visual Hierarchy (hero/secondary/filler/accent) | `engine/hierarchy.ts` — `MotifRole`, `HIERARCHY_PRESETS`, `ROLE_IMPORTANCE`, `ROLE_LAYER_PRIORITY`, `applyHierarchy` (Build 001/002) |
| Eye Flow (S-Curve/Diagonal/Editorial/Spiral) | `engine/compositionZones.ts` — 10 real named zones incl. `sCurve`, `diagonal`, `editorial`, `goldenRatio` (a real spiral), `zFlow`, `wave`, `radial`, `centerFocus`, `cornerFlow`, `offset` (Build 003). Operates on **cluster anchors**, not universal per-placement bias. |
| Eye Flow (directional bias) | `engine/compositionIntelligence.ts`'s `applyFlowBias` — but only 3 crude profiles (`calm`/`directional`/`dynamic`, from `styleDna.ts`'s `FlowProfile`), applied universally per-placement. |
| Negative Space per-product | `engine/negativeSpaceDesigner.ts` (Build 006) — a single scalar `negativeSpace` nudge per `ProductUseId`, not yet a richer per-product strategy (rhythm/cluster looseness). |
| Hero isolation / framing | `engine/scoring.ts`'s real `heroSeparation`/`isolationScore` metrics measure it; nothing in generation actively designs for it beyond Pattern Physics' generic role-attraction. |
| Asymmetry | `applyBalanceCorrection` only corrects *severe* imbalance (>0.5) — mild asymmetry already survives, but nothing *designs* controlled imbalance on purpose. |
| Silhouette diversity | Build 008B's `resolveHeroArchetype` (5-archetype weighted roll) — but Build 008B's own §15.2 explicitly deferred adding a portfolio-level measurement for it. |
| Luxury principles (golden balance, breathing room, cluster rhythm, hierarchy, hero isolation, overlap, complexity) | Nearly every one already has a real measured field: `quadrantBalance`, `largestEmptyRegion`, `clusterCohesion`, `heroSeparation`/`isolationScore`, `overlapQuality`, `motifShapeDiversity`/`heroDetailRatio` — only "golden balance" (hero anchor near a golden-ratio point) has no existing check. |
| Product-aware composition | `resolveNegativeSpaceForProduct` + `PRODUCT_USAGE_PROFILE`/`STYLE_USAGE_PROFILE` (Build 008B) are the precedent; no composition-ZONE-per-product mapping exists yet. |

## Two-parallel-systems finding (same pattern as every prior audit)

`FlowProfile` (styleDna.ts, 3 values, per-placement bias,
`compositionIntelligence.ts`) and `CompositionZone` (10 values,
cluster-anchor sampling, `compositionZones.ts`) are **two independent
"eye path" systems** that were never unified. Build 009's Eye Flow Engine
does not merge them (too invasive/risky for this build — `FlowProfile` is
a closed 3-key union with lookup tables keyed on it in `styleDna.ts`,
touched by dozens of call sites) — instead it adds a **third, small,
additive, opt-in mechanism** (`engine/eyeFlowEngine.ts`) that reuses the
real skeleton math `compositionZones.ts` already proved out (sCurve wave,
diagonal band, editorial rows, golden-angle spiral) as a placement-level
bias function, the same shape `applyFlowBias` already has, so it composes
into the existing pipeline without touching either closed system. This
duplication is documented here explicitly, the same honesty convention
every prior audit used for a two-parallel-systems finding, with a
recommendation (§ below) to unify in a future build.

## Real taxonomy reuse (Section 3/8 "Phone Case"/"Poster"/"Canvas"/"Greeting Card")

Per every prior build's own convention: reuse the real, already-validated
`ProductUseId` (10 values: wallpaper, fabric, wrappingPaper, giftWrap,
packaging, notebookCovers, stationery, homeDecor, textile, digitalPaper).
Greeting Card -> `stationery`; Phone Case -> `packaging` (a small,
protective, single-focal-object print, the closest real analog); Poster/
Canvas -> `homeDecor`. Documented here, not invented as new categories
nothing else in the app validates against.

## Section-by-section scope decisions

1. **Visual Hierarchy Engine V2** — do NOT add a 5th `MotifRole` enum
   value (used across dozens of call sites: `ClusterMember`, paint order,
   Pattern Physics importance, `ROLE_SCALE_RANGE`, botanical part
   selection — too large a blast radius for this build). Instead: (a) a
   real, deterministic "secondary hero" promotion — the single largest
   `'secondary'`-role placement per tile gets a real scale boost toward a
   band between secondary and hero, opt-in via a new
   `secondaryHeroBoost` field (default 0 = today's exact behavior); (b) a
   real measured `computeVisualHierarchyScore` (how distinctly the 4
   existing tiers separate in rendered scale) feeding Section 9.
2. **Eye Flow Engine** — new `engine/eyeFlowEngine.ts`, 6 named paths,
   reusing `compositionZones.ts`'s real skeleton formulas as a bias
   function (not a from-scratch sampler); `asymmetrical` (one-sided pull)
   and `wallpaper` (intentionally near-zero — a repeat print should NOT
   direct the eye down one path) are the 2 genuinely new formulas. Wired
   as a new optional, additive `CompositionIntelligenceParams` field.
3. **Negative Space Designer V2** — extend the existing single-scalar
   adjustment into a real 3-field per-product strategy (spacing
   adjustment unchanged + new rhythm-strength multiplier + cluster
   looseness), reusing the existing table's values for the field already
   covered.
4. **Hero Framing Engine** — extend `premiumHero.ts`: a real empty-buffer
   push-away for any member landing too close to the hero's own center,
   plus ensuring supporting members cover real angular framing zones
   around the hero rather than pure archetype-driven placement alone.
5. **Natural Asymmetry Engine** — new `applyControlledAsymmetry` pass in
   `compositionIntelligence.ts`: a bounded, seed-stable one-sided mass
   nudge (real, designed imbalance) rather than leaving asymmetry to
   chance below the existing severe-imbalance correction threshold.
6. **Silhouette Optimization** — thread Build 008B's `resolveHeroArchetype`
   choice back through `buildPremiumHero`'s return value to
   `scripts/qualityReport.ts`, add `computeHeroArchetypeDiversity` to
   `portfolioQuality.ts` — directly fulfilling Build 008B's own §15.2
   deferred recommendation.
7. **Luxury Composition Rules** — new `engine/luxuryComposition.ts`,
   mostly a real aggregation of already-real metrics (`quadrantBalance`,
   `largestEmptyRegion`, `clusterCohesion`, `heroSeparation`/
   `isolationScore`, `overlapQuality`, `motifShapeDiversity`/
   `heroDetailRatio`, Section 1's new hierarchy score), plus one genuinely
   new geometric check: how close the hero's own anchor sits to a real
   golden-ratio point (0.382/0.618) of the tile.
8. **Product-aware Composition** — extend Section 3's per-product
   strategy with a hand-authored `compositionZone` bias per product
   (reusing the real 10-zone taxonomy), same editorial-judgment
   convention as Build 008B's `STYLE_USAGE_PROFILE`.
9. **Commercial Portfolio Evaluation** — extend
   `scripts/qualityReport.ts` (itself never modified since Build 002) to
   thread through the new measurements, re-run 30/100/300 against the
   Build 008B baseline.
10. **Documentation** — this file + `BUILD_009_REPORT.md` + USER_GUIDE +
    ROADMAP.

## Recommendation carried forward (not this build's scope)

Unifying `FlowProfile` and `CompositionZone` into one real eye-path
taxonomy is the single highest-leverage architectural cleanup this audit
found — deferred because `FlowProfile` is a closed union with lookup
tables in `styleDna.ts` touched by dozens of call sites, and unifying it
safely needs its own dedicated build, not a subsection of this one.
