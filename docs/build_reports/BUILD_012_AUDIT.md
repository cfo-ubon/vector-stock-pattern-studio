# Build 012 Audit — Evaluation Intelligence Engine V3

Read in full before writing any code: `engine/scoring.ts` (916 lines — every
metric, `QUALITY_PRESET_WEIGHTS`, `SOFT_PENALTY_RULES`, `computeOverallScore`,
`applySoftPenalties`), `engine/hierarchy.ts` (`REGULAR_LATTICE_LAYOUTS`,
`HIERARCHY_PRESETS`, `HIERARCHY_EXEMPT_LAYOUTS`), `engine/portfolioQuality.ts`,
`engine/patternBeautyScore.ts`, `engine/luxuryComposition.ts`,
`engine/commercialStyleAnalysis.ts`, `critic/commercialPatternCritic.ts`,
`critic/commercialAppealScore.ts`, `critic/problems.ts`,
`critic/visualAnalysis.ts`, `collection/productTargets.ts`,
`engine/candidateEngine.ts` (hard-reject rules), `engine/styleDna.ts`,
`src/style-dna/*.json` (all 15 preset declarations), `scripts/qualityReport.ts`,
`scripts/commercialRealityCheck.ts`, `docs/build_reports/BUILD_011_5_REPORT.md`
(the audit this build responds to).

This is an evaluation-correctness audit, not a generation-engine change. No
SVG generation code is touched by this build except where a metric itself
needed no change but its *consumer* (scoring) did.

## Executive summary

Build 011.5 found that 3 of 15 Style DNA presets (Minimal Botanical, Boutique
Packaging, Premium Textile) score catastrophically low (31–44 mean Absolute
Commercial Quality, 92–100% "failure" rate at the 50-point floor) despite
rendering legitimately well. This audit traces the mechanism precisely and
quantifies it with new empirical data (not available at Build 011.5 time):
the entire effect is caused by 8 of the 18 `SOFT_PENALTY_RULES` in
`engine/scoring.ts` firing at wildly different rates on **lattice-layout**
tiles (`grid`/`gridMinimal`/`halfDrop`/`brick`/`stripe` — the `REGULAR_LATTICE_LAYOUTS`
set `engine/hierarchy.ts` already defines) versus organic-layout tiles, with
zero layout awareness anywhere in the scoring pipeline. A controlled
experiment (below) rules out the alternative hypothesis that this is a
Style-DNA/hierarchy-preset problem, not a layout problem.

## Finding 1 (root cause, quantified): the scoring pipeline has zero layout
context anywhere

`engine/scoring.ts` imports only `TileData`, `svgAst`, `svgGeometry` — it
never imports `LayoutId` or `REGULAR_LATTICE_LAYOUTS`. `computeOverallScore`
and `applySoftPenalties` take only `(metrics, presetId)` — no layout, no
style, no product. Every one of the 18 `SOFT_PENALTY_RULES` fires (or
doesn't) purely off `CompositionMetrics`, with the exact same threshold for
every layout and every Style DNA preset. `critic/problems.ts` (`detectProblems`)
and `critic/visualAnalysis.ts` (`detectVisualIssues`'s own separate
`gridAppearance` issue, duplicating the scoring-side rule at the same `<40`
threshold — see Finding 4) inherit the identical bias, since both read
straight off the same universal rule set/metrics.

`engine/hierarchy.ts` (`hierarchy.ts:117-138`) already documents, in its own
`REGULAR_LATTICE_LAYOUTS` doc comment, that Composition Intelligence V2 had to
be **disabled** for these 5 layouts because "the 'flaw' they'd be correcting
(even spacing, axis/band alignment) is the deliberate point of the layout."
That lesson was applied to the *generation* side (Build 001) but never to the
*scoring* side — `engine/scoring.ts` was never updated to know about the same
distinction, so the exact same "even spacing / axis alignment is deliberate"
tiles that generation correctly treats as intentional get scored as if they
were organic-layout defects.

### Empirical bias measurement (new, this audit)

30 tiles per preset × 15 presets (n=300, seeds `diag-1`..`diag-30`), split by
whether the resolved `layoutId` is in `REGULAR_LATTICE_LAYOUTS` (81 lattice
tiles, 219 organic tiles — the natural mix across the whole portfolio):

| Rule | Lattice fire rate | Organic fire rate | Bias |
|---|---|---|---|
| `gridAppearance` | **100%** | 0% | extreme |
| `equalSpacingDetected` | **70%** | 1% | extreme |
| `repeatedMotifOrientation` | **25%** | 0% | severe |
| `largeEmptyHole` | 23% | 2% | moderate |
| `edgeImbalance` | 16% | 0% | moderate |
| `weakHierarchy` | 10% | 3% | moderate (see control below) |
| `heroInsufficientDetail` | 11% | 2% | moderate (see control below) |
| `mechanicalComposition` | 1% | 0% | logical (compound of the 3 extreme rules above) |
| `adjacentRepetition`, `monotonousScale`, `zeroMotifOverlap`, `lowClusterCohesion` | ≤1% either side | ≤1% either side | none |
| `quadrantImbalance`, `heroClustering`, `lowPaletteContrast`, `cornerDeadZone`, `repetitiveMotifShapes`, `tooManyIsolatedObjects` | 0% both | 0% both | none |

### Ruling out the "hierarchy preset" alternative hypothesis (control experiment)

`minimalBotanical` uses `hierarchyPreset: 'minimalRepeat'` (heroScale 1.2 vs
secondaryScale 1.0 — the two lowest hero-prominence values of any of the 7
`HIERARCHY_PRESETS`, alongside `allOverTextile`'s 1.3/1.0, used by
`boutiquePackaging`/`premiumTextile`). One might expect `weakHierarchy`/
`heroInsufficientDetail` to fire because these presets *intentionally*
suppress hero prominence, not because of layout. `organicAbstract` is the
control that rules this out: it uses the **exact same** `minimalRepeat`
hierarchy preset, but its declared `layouts` are `['scatter', 'airy']` — both
organic. Over the same 30-seed sample, `organicAbstract` triggers **zero** of
the 18 penalty rules, and its Absolute Commercial Quality mean is 88.07 (the
highest of all 15 presets). This proves the effect is caused by the layout
class, not by the hierarchy preset's own intentionally low hero-prominence
values.

### Direct correlation: preset layout-pool composition vs. Absolute Commercial Quality

| Preset | Declared `layouts` | Lattice fraction | Build 011.5 ACQ mean | Failure rate |
|---|---|---|---|---|
| `minimalBotanical` | `gridMinimal`, `grid` | 100% | 31.56 | 99% |
| `boutiquePackaging` | `stripe`, `gridMinimal` | 100% | 37.34 | 92% |
| `premiumTextile` | `halfDrop`, `brick` | 100% | 44.09 | 100% |
| `luxuryWallpaper` | `densePremium`, `halfDrop` | 50% | 70.45 | 34% |
| `vintageHerbarium` | `scatter`, `halfDrop` | 50% | 64.5 | 46% |
| (all other 10 presets) | (2 organic layouts each) | 0% | 75–88 | 0–14% |

The correlation is exact and total: every preset whose declared layout pool is
100% lattice fails catastrophically; both 50%-lattice presets land at an
intermediate penalty; every 0%-lattice preset scores in the healthy 75–88
range. No other variable (density, negative space, hierarchy preset, category)
predicts the failure pattern this cleanly.

### Simulated recovery (validates the Section 2/5 fix before writing it)

Re-scoring the same 15×30 sample with the 8 biased rules exempted specifically
for lattice-layout tiles (leaving all 10 unbiased rules fully active,
unchanged, for every tile regardless of layout):

| Preset | Old mean (fail%) | New mean (fail%) |
|---|---|---|
| `minimalBotanical` | 35.43 (90%) | 77.30 (0%) |
| `boutiquePackaging` | 32.43 (97%) | 76.87 (0%) |
| `premiumTextile` | 44.43 (97%) | 80.43 (0%) |
| `luxuryWallpaper` | 66.20 (37%) | 85.03 (0%) |
| `vintageHerbarium` | 68.33 (33%) | 83.83 (0%) |
| (all 10 organic-only presets) | unchanged | **byte-identical to old** |

The 10 already-healthy, organic-only presets are mathematically guaranteed
unchanged by this fix: none of the 8 exempted rules fires above 3% on organic
layouts in the first place (see bias table above), so removing them from the
organic-layout evaluation path changes nothing for those tiles. This is the
direct evidence that the fix is a bias correction, not a score inflation.

## Finding 2: duplicated penalty logic across two modules

`engine/scoring.ts`'s `gridAppearance` soft-penalty rule
(`m.gridAppearanceScore < 40`) and `critic/visualAnalysis.ts`'s own
`gridAppearance` visual-issue detector (`visualAnalysis.ts:180-184`,
`detected: m.gridAppearanceScore < 40`) are the same check, re-implemented
twice at the same threshold, in two different modules. `critic/problems.ts`
is not a third duplicate — it explicitly wraps `SOFT_PENALTY_RULES` rather
than re-deriving the check (`problems.ts:1-11`'s own doc comment already
states this). Only `visualAnalysis.ts`'s independent re-implementation is a
true duplicate that needs to inherit the Section 2 layout-awareness fix
separately, since it doesn't call into `scoring.ts`'s rule list at all.

## Finding 3: universal assumptions that only hold for organic/cluster layouts

Beyond the 8 penalty rules above, three of `QUALITY_PRESET_WEIGHTS`'
underlying *metrics* (not penalty rules — the ordinary weighted-average
layer) encode an implicit "organic is normal" assumption in their own
"ideal" bands, though at materially lower severity than the penalty rules
since they only pull a weighted average, never subtract a fixed block:

- `computeComposition`'s fullness "ideal" band (0.3–0.8 occupancy) is a
  single universal target regardless of a style's own *declared* `density`/
  `negativeSpace` fields (e.g. `minimalBotanical` declares `density: 0.3,
  negativeSpace: 0.45` — deliberately below the "ideal" band's low end by
  design, not by accident).
- `computeGridAppearanceScore`/`computeSpacingUniformity` are the metrics the
  Finding-1 penalty rules already threshold — same axis-alignment/uniformity
  assumption, just at the weighted-average layer instead of the fixed-penalty
  layer. Lower-severity but directionally the same bias.

These are addressed by Section 3 (Style-aware Evaluation) using each style's
own *declared* `density`/`negativeSpace` fields as the real "ideal" reference
instead of one universal band — never a fabricated per-style number.

## Finding 4: hard-reject rules are NOT biased (control-checked, no fix needed)

`engine/candidateEngine.ts`'s `applyHardRejectRules` (empty pattern, invalid
SVG geometry, `<image>` elements, external hrefs, duplicate ids, node-count
budget) are purely structural safety checks with no aesthetic judgment and no
layout/style dependency. Confirmed no layout-conditional logic exists there;
no change needed for this build's scope.

## Finding 5: `commercialPatternCritic.ts` / `luxuryComposition.ts` / `commercialAppealScore.ts` are lower-risk but inherit the bias transitively

None of these three modules hard-codes a grid/uniformity penalty directly —
they aggregate already-real `CompositionMetrics` fields
(`heroDetailRatio`, `paletteContrast`, `cornerContinuity`, `flowCoherence`,
`clusterCohesion`, `hierarchy`, etc.) with fixed weights, not the 18 soft
penalty rules. Two observations:

- `flowCoherence` (used heavily by `editorialFeeling`) is *naturally high*
  for lattice layouts (a strict lattice's nearest-neighbor chain is, by
  construction, directionally consistent — `hierarchy.ts:123-127`'s own doc
  comment on `flowCoherence` sitting 85-94 for these layouts vs 64-80 for
  organic) — so `editorialFeeling` is not biased *against* lattice layouts;
  if anything it is mildly biased *toward* them. Not a defect to fix, but
  worth stating plainly since it is the mirror image of Finding 1.
- Because none of these three modules reads `SOFT_PENALTY_RULES` directly,
  they do not need the Section 2/5 layout-exemption fix themselves — only
  `computeOverallScore`/`applySoftPenalties` (and their duplicate in
  `visualAnalysis.ts`, Finding 2) do. This keeps the fix's blast radius small
  and precisely targeted, per the brief's "no fake improvements" rule: nothing
  gets touched that isn't actually part of the measured bias.

## Finding 6: no product-aware evaluation exists at all today

`collection/productTargets.ts`'s `evaluateProductTargets` scores 10 product
uses (`wallpaper`, `fabric`, `wrappingPaper`, `giftWrap`, `packaging`,
`notebookCovers`, `stationery`, `homeDecor`, `textile`, `digitalPaper`) from
input-side signals (category/keywords/tileSize/density/heroVisibility) —
this is a real, tested, pre-existing product-*suitability* recommender, but
it is entirely separate from the pattern *quality* score
(`computeOverallScore`) — a pattern's Absolute Commercial Quality is
identical no matter which product it's being evaluated for. The Build 012
brief's Section 4 ask ("Wallpaper/Fabric/Gift Wrap/Packaging/Notebook/
Greeting Card/Poster/Canvas... evaluate accordingly") requires quality
*penalties themselves* to vary by intended product (e.g., `gridAppearance`
is not just permissible but often *desirable* for wallpaper/packaging, while
a poster or canvas — single-image products, not repeat yardage — have no
seamless-repeat requirement at all and should not be scored on
`cornerContinuity`/`seamlessIntegrity`/`adjacentRepetition` the way a fabric
repeat must be). Three of the 8 named products
(`notebookCovers`→Notebook, `giftWrap`→Gift Wrap, `packaging`→Packaging,
`wallpaper`→Wallpaper, `fabric`/`textile`→Fabric) already have a real
`ProductUseId`; **Greeting Card, Poster, and Canvas have no existing product
id anywhere in the codebase** (Build 011.5 used `stationery` as an honest
proxy for Greeting Card, documented explicitly as a proxy, not a real
mapping) — these 3 need new, real `ProductUseId` entries with their own rule
definitions (Section 4), not a fabricated score.

## Finding 7: the brief's 8 named "layouts" (Section 2) don't literally match the engine's 14 real `LayoutId`s

Section 2 names: Organic, Grid, Half Drop, Brick, Stripe, Diamond, Mirror,
Editorial. The engine's real `LayoutId` union (`engine/types.ts:124-138`) is:
`grid`, `brick`, `radial`, `scatter`, `halfDrop`, `heroFlow`, `heroScatter`,
`sCurve`, `bouquet`, `airy`, `toss`, `densePremium`, `gridMinimal`, `stripe`.

- `Grid`, `Half Drop`, `Brick`, `Stripe` map directly to real `LayoutId`s
  (`grid`/`gridMinimal`, `halfDrop`, `brick`, `stripe`).
- `Organic` is not one `LayoutId` but the natural name for the other 9
  (`scatter`, `toss`, `airy`, `bouquet`, `sCurve`, `radial`, `heroFlow`,
  `heroScatter`, `densePremium`) — exactly the complement of
  `REGULAR_LATTICE_LAYOUTS`.
- **`Diamond` does not exist as a layout anywhere in this codebase** — no
  generator, layout function, or Style DNA preset produces a diamond-grid
  arrangement. Inventing one would be a new rendering mechanism, explicitly
  forbidden by this build's brief ("Do NOT invent new rendering mechanisms").
  This audit does not add one; Section 2's evaluation-profile system is built
  against the real, existing taxonomy only.
- **`Mirror` is not a distinct layout** — `LayoutParams.mirror: boolean`
  (`engine/types.ts:146`) is an orthogonal modifier flag any layout can carry,
  not a separate `LayoutId`. No fix needed beyond documenting this; a
  mirror-modified tile is evaluated under its own real `layoutId`'s profile
  exactly as before.
- **`Editorial` is not a layout** — it is a Style DNA descriptor
  (`editorialBotanical`'s label) whose own declared layouts (`heroFlow`,
  `sCurve`) are both organic. No separate "editorial layout" evaluation
  profile is needed; `editorialBotanical` is correctly covered by the
  organic-layout profile plus its own Section 3 style profile.

Section 2 is therefore implemented against the real, honest taxonomy — 2
layout evaluation classes (`lattice`, `organic`) derived directly from the
already-existing `REGULAR_LATTICE_LAYOUTS` set (reused, never redefined) —
rather than fabricating categories the generation engine doesn't actually
produce.

## Scope decisions for Sections 2–9

1. **Section 2 (Layout-aware Evaluation)**: new `layoutEvaluationClass(layoutId)`
   derived from the existing `REGULAR_LATTICE_LAYOUTS`; `PENALTY_RULES_V2`
   (Section 5) gates the 8 empirically-biased rules to `applicableLayouts:
   ['organic']`, leaving the other 10 universal.
2. **Section 3 (Style-aware Evaluation)**: a real `StyleEvaluationProfile`
   derived from each Style DNA preset's own already-declared fields
   (`layouts`, `density`, `negativeSpace`, `hierarchyPreset`'s real
   `heroScale`/`secondaryScale` ratio) — never a hand-tuned per-preset
   number. Since Finding 1's control experiment shows layout (not hierarchy
   preset) is the actual cause, style-awareness's real, honest job is
   narrower than it first appears: (a) formal per-style profiles for all 15
   presets as the brief requires, (b) a genuinely style-driven adjustment
   for the `composition`/occupancy "ideal band" (Finding 3) using each
   style's own declared density/negativeSpace, and (c) a documented,
   evidence-based statement — not silent omission — that hero-prominence
   suppression itself is not the failure mode for the remaining dimensions.
3. **Section 4 (Product-aware Evaluation)**: add `greetingCard`, `poster`,
   `canvas` as new, real `ProductUseId`s with the same rule-based structure
   every existing product use already has (Finding 6); thread product
   context into penalty applicability (Section 5) — e.g. seamless-repeat
   penalties (`cornerDeadZone`, `adjacentRepetition`) don't apply to
   `poster`/`canvas` (single-image products, no tiling requirement).
4. **Section 5 (Penalty System V2)**: `PenaltyRuleV2` — every rule gets
   `reason`, `applicableLayouts`, `applicableStyles`, `applicableProducts`,
   `confidence` (derived from the empirical bias tables above — `high` for
   ≥50pp lattice/organic gap, `medium` for 10-49pp, `low`/`n/a` for the 10
   unbiased rules that stay universal).
5. **Section 6 (Commercial Judge V2)**: an umbrella that reuses
   `commercialPatternCritique`/`luxuryComposition`/`commercialAppealScoreV2`
   (Finding 5 — none of these three need the bias fix themselves) plus the
   new layout/style/product context, without recomputing any existing
   sub-score.
6. **Section 7 (Explainability)**: every score result carries which rule
   fired, which profile (layout/style/product) was active, and the specific
   metric evidence — extending `ScoreResult.penaltyReasons` into a
   structured trace rather than replacing it (keeps existing callers of the
   string-array shape working).
7. **Sections 8–9 (Regression + Commercial Validation)**: re-run all 4
   portfolio tiers against Build 011.5's stored baseline; confirm the 3
   target presets recover into the healthy 75-88 band (already validated by
   this audit's simulation above) with zero change to the other 10 presets.
