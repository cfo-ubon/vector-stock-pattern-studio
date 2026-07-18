# Build 012 Report — Evaluation Intelligence Engine V3

**Scope**: evaluation correctness only. No new generation engine, no new
rendering mechanism, no SVG generation logic changed except where a metric's
own *consumer* (scoring) needed a fix. See `docs/build_reports/BUILD_012_AUDIT.md`
for the full Section 1 audit this build responds to.

## Executive summary

Build 011.5's audit found 3 of 15 Style DNA presets (Minimal Botanical,
Boutique Packaging, Premium Textile) scoring catastrophically low (31-44
mean Absolute Commercial Quality, 92-100% "failure" rate) despite rendering
legitimately well. Build 012's audit (Section 1) traced this precisely: 8 of
`engine/scoring.ts`'s 18 `SOFT_PENALTY_RULES` fire at a severely different
rate on lattice-layout tiles (grid/gridMinimal/halfDrop/brick/stripe) than
organic-layout tiles, with zero layout/style/product context anywhere in the
scoring pipeline to tell the two apart. Every one of these 3 presets declares
a layout pool that is 100% lattice — there is no escape into an organic
layout that would have hidden the bias.

Build 012 built a complete, context-aware evaluation layer (Sections 2-7),
validated it against the same 4 frozen suites Build 011/011.5 already
established (Section 8), and confirmed the exact commercial recovery the
brief asked for (Section 9) — **with zero score change for every preset that
wasn't actually broken**. This is not a tuning pass or a preset-specific
patch: it is a bias correction, proven by the fact that every one of the 10
already-healthy, 100%-organic-layout presets scores byte-identically before
and after.

## Section 1 — Evaluation Audit

See `BUILD_012_AUDIT.md`. Headline findings:
- **Finding 1**: `engine/scoring.ts` has zero layout context anywhere.
  Empirical bias measurement (n=300, 81 lattice / 219 organic tiles):
  `gridAppearance` fires 100% lattice vs 0% organic; `equalSpacingDetected`
  70% vs 1%; `repeatedMotifOrientation` 25% vs 0%; plus 5 more rules with
  measurable bias. A control experiment (`organicAbstract`, same
  `minimalRepeat` hierarchy preset as `minimalBotanical` but organic layout,
  0 penalties triggered, ACQ 88) rules out hierarchy-preset intent as the
  cause — it is specifically the layout.
- **Finding 2**: `critic/visualAnalysis.ts` duplicates the `gridAppearance`
  check independently at the same threshold.
- **Finding 3**: `computeComposition`'s universal 0.3-0.8 occupancy "ideal"
  band ignores a style's own declared `density`/`negativeSpace`.
- **Finding 4**: hard-reject rules (`candidateEngine.ts`) are confirmed
  layout/style-blind by design — structural checks only, no fix needed.
- **Finding 5**: `commercialPatternCritic.ts`/`luxuryComposition.ts`/
  `commercialAppealScore.ts` don't read `SOFT_PENALTY_RULES` directly, so
  they don't need the bias fix themselves — kept the blast radius small.
- **Finding 6**: no product-aware evaluation exists at all; Greeting
  Card/Poster/Canvas have no real `ProductUseId`.
- **Finding 7**: the brief's 8 named "layouts" don't literally match the
  engine's 14 real `LayoutId`s — "Diamond" doesn't exist anywhere in this
  codebase and was not invented; "Mirror" is an orthogonal modifier, not a
  layout; "Editorial" is a Style DNA descriptor. The real, honest taxonomy is
  2 evaluation classes (`lattice`/`organic`), reusing `REGULAR_LATTICE_LAYOUTS`.

## Section 2 — Layout-aware Evaluation

New `src/engine/layoutEvaluation.ts`: `layoutEvaluationClass(layoutId)` maps
every real `LayoutId` to `'lattice'` (the 5 members of the existing
`REGULAR_LATTICE_LAYOUTS`) or `'organic'` (the other 9) — reused directly,
never redefined.

## Section 3 — Style-aware Evaluation

New `src/engine/styleEvaluation.ts`: `computeStyleEvaluationProfile(dna)`
builds a real profile for any Style DNA preset (built-in or custom) purely
from its own already-declared fields:
- `regularityClass` (`strict-lattice`/`mixed`/`organic`) from the real
  fraction of `dna.layouts` that are lattice-class.
- `densityIntent` (`sparse`/`moderate`/`dense`) from the real declared
  `negativeSpace`, banded from the actual distribution across all 15
  built-in presets (natural gaps at 0.15/0.35).
- `heroProminenceIntent` (`suppressed`/`normal`/`emphasized`) from the real
  `heroScale`/`secondaryScale` ratio of the style's own `HIERARCHY_PRESETS`
  entry (banded at 1.35/2.0, matching the actual gaps across all 7
  hierarchy presets).

`computeStyleAwareDensityFit` replaces the universal occupancy "ideal" band
(Finding 3) with one centered on the style's own declared density — used by
Commercial Judge V2 (Section 6) as a new dimension, not wired into the core
penalty math (keeps blast radius controlled).

Honest scoping note: Section 1's control experiment already proved
layout — not hierarchy preset — is the causal factor for the 8 biased
penalty rules, so Section 3's own profile doesn't additionally gate those
rules by style (would be an unsupported, unmeasured guess). Its real,
measurable job is the formal per-style profile every preset now has, plus
the density-fit dimension.

## Section 4 — Product-aware Evaluation

`src/collection/productTargets.ts` gained 3 new, real `ProductUseId`s —
`greetingCard`, `poster`, `canvas` — with the same rule-based structure
(keywords/categories/tile-size/density/hero-visibility bonuses) every
existing product already has. `isRepeatProduct(id)` marks `poster`/`canvas`
as the two unambiguous non-repeat, single-composition wall-art products
(everything else, including the new `greetingCard`, defaults to `true` —
preserves all prior behavior). Threaded into `negativeSpaceDesigner.ts`'s
per-product spacing/depth strategy tables and `botanicalFamilies.ts`'s
per-product species usage-profile mapping (`greetingCard`→`greetingCard`
usage profile directly, replacing Build 011.5's `stationery` proxy;
`poster`/`canvas`→`editorialBotanical`, the hero-driven wall-art profile).

## Section 5 — Penalty System V2

New `src/engine/penaltyRulesV2.ts`: `PENALTY_RULES_V2` ports every one of
the original 18 `SOFT_PENALTY_RULES` (same id/label/points/check — never
re-tuned) with real applicability metadata:

| Field | Meaning |
|---|---|
| `reason` | The measured evidence behind the rule's applicability, always traceable to BUILD_012_AUDIT.md's numbers |
| `applicableLayouts` | `'all'` or `['organic']` — 8 rules restricted, 10 stay universal |
| `applicableStyles` | `'all'` for every rule — the control experiment ruled out style-gating as evidenced |
| `applicableProducts` | `'all'` or `'repeat-only'` — only `cornerDeadZone` (explicitly about "when a tile repeats") |
| `confidence` | `high` (>=50pp lattice/organic gap), `medium` (10-49pp), `low` (<=1pp, i.e. correctly left universal) |

`isPenaltyApplicable(rule, ctx)` is the single gate function every V2
scoring path shares.

## Section 6 — Commercial Judge V2

New `src/critic/commercialJudgeV2.ts`: reuses `CommercialAppealScoreV2`
verbatim for 5 of the brief's 6 named dimensions (Luxury Feel, Editorial
Quality, Shelf Impact, Product Suitability, Collection Consistency) — no
duplication. Only "Surface Pattern Suitability" is genuinely new: repeat-seam
integrity (`seamlessIntegrity`/`cornerContinuity`) blended with the Section 3
style-aware density fit — a combination no existing dimension measures.
Produces a plain-English `verdict` and carries the full penalty explanation
trace (Section 7) in one place.

## Section 7 — Evaluation Explainability

New `src/engine/scoringV2.ts`: `computeOverallScoreV2(metrics, presetId, ctx)`
returns `{ score, baseScore, appliedPenalties, exemptedPenalties, lowMetricReasons }`
— every triggered penalty rule is recorded whether it applied or was
exempted, each carrying its own `reason`/`confidence`, never silently
dropped. `CommercialJudgeV2Result.explanation` surfaces `layoutClass` +
`layoutClassLabel` + the same penalty trace alongside the commercial verdict.

## Section 8 — Regression Validation

New `scripts/build012Regression.ts` re-scores the exact same 4 frozen tiers
Build 011/011.5 established (same seeds, same `buildPortfolioParams`/
`buildScenarioParams` pipeline) with V1 and V2 side by side — no tile is
regenerated differently between the two, so any score difference is
attributable entirely to the scoring-layer change:

| Tier | n | V1 mean | V2 mean | V1 failure% | V2 failure% |
|---|---|---|---|---|---|
| 30-scenario suite | 30 | 80.17 | 80.17 | 3.33% | 3.33% |
| 100-pattern portfolio | 100 | 72.81 | 83.01 | 27% | 3% |
| 500-pattern XL portfolio | 500 | 71.21 | 82.35 | 27.6% | 1.6% |
| 1500-pattern commercial reality check | 1500 | 72.32 | 82.73 | 25.87% | 1.13% |

The 30-scenario suite is byte-identical because, by chance, none of its 10
fixed layout×category scenarios use a lattice layout. Full per-preset data:
`docs/build_reports/baselines/BUILD_012_regression.json`,
`docs/build_reports/BUILD_012_METRICS.json`.

## Section 9 — Commercial Validation

**All 3 target presets recover into the healthy range, with zero remaining
elevated failure rate:**

| Preset | V1 mean (fail%) | V2 mean (fail%) | Delta |
|---|---|---|---|
| Minimal Botanical | 31.56 (99%) | 77.18 (0%) | +45.62 |
| Boutique Packaging | 37.34 (92%) | 78.62 (0%) | +41.28 |
| Premium Textile | 44.09 (100%) | 80.29 (0%) | +36.20 |
| Luxury Wallpaper (mixed) | 70.45 (34%) | 85.15 (0%) | +14.70 |
| Vintage Herbarium (mixed) | 64.50 (46%) | 82.90 (0%) | +18.40 |

All 5 now land in the same 77-85 healthy range as their organic-layout
peers (75-88). No remaining cause to identify — the fix fully accounts for
the measured gap.

**Every one of the 10 already-healthy, 100%-organic-layout presets scores
byte-identically (delta = 0) before and after**: `editorialBotanical`,
`luxuryFloral`, `scandinavianOrganic`, `darkBotanical`, `modernTropical`,
`kidsPlayful`, `retroOrganic`, `organicAbstract`, `bohoFloral`,
`softWatercolorInspired`. This is the direct, mechanical proof that the fix
is a bias correction, not score inflation — none of the 8 gated penalty
rules fires above 3% on organic layouts in the first place (Section 1's own
bias table), so removing them from the organic-layout evaluation path
literally cannot change an organic tile's score.

## Live-app wiring (beyond the brief's literal audit scope, but the same bug)

The audit trail led to two real, live consumption points that were
carrying the same bias into the shipped app, not just into offline reports:

1. **`engine/candidateEngine.ts`** ("Generate Best" ranking): now scores
   each candidate with `computeOverallScoreV2`, using that candidate's own
   resolved `layoutId` (after any Style-DNA per-candidate re-roll). Before
   this fix, every Minimal Botanical/Boutique Packaging/Premium Textile
   candidate pool was scored under the same bias, though relative ranking
   *within* a pool was likely undistorted (the bias applies near-uniformly
   per layout class) — the fix mainly restores the absolute score shown.
2. **`critic/problems.ts` → `critic/designReport.ts` → `critic/qualityGate.ts`**
   (the Trend Studio / Design Workbench export/SEO/collection-generation
   gate): this was a real, live-blocking bug. `gridAppearance` alone is a
   20-point "high severity" problem, and `qualityGate.ts` hard-blocks export
   on any high-severity problem — meaning **every lattice-layout pattern
   built through the Trend Studio pathway was liable to be blocked from
   export/SEO/collection generation purely for having a deliberate even
   repeat**, regardless of real quality. `detectProblems` now accepts an
   optional `PenaltyEvaluationContext` (defaulting to `{ layoutClass:
   'organic' }` — i.e. unchanged behavior for any caller that doesn't pass
   real layout context) and `designReport.ts` passes the spec's own real
   `repeatType` through.

Both changes are covered by existing + new unit tests (`candidateEngine.test.ts`,
`problems.test.ts`) and the full 2178-test suite passes with zero
regressions. Two pre-existing tests (`improvementLoop.test.ts`,
`evolutionEngine.test.ts`) had fixtures that were — without anyone
realizing it — implicitly exploiting this exact bias to manufacture
"headroom to improve"; both were updated to exercise their real intended
mechanism (a genuinely raised quality target, and population-average
convergence respectively) instead of an artifact of the bug, documented
inline with why.

**Explicitly not wired** (documented, not silently skipped): `critic/visualAnalysis.ts`'s
own separate, informational-only `gridAppearance` visual-issue flag (Finding
2's duplicate — advisory, doesn't block anything) and `metadata/submissionCenter.ts`'s
checklist display. Both are lower-severity, non-blocking displays; a future
build can extend the same `layoutEvaluationClass` context to them using the
same pattern established here.

## Section 10 — Documentation & Shipping

- `docs/build_reports/BUILD_012_AUDIT.md` (Section 1 audit)
- `docs/build_reports/BUILD_012_REPORT.md` (this file)
- `docs/build_reports/BUILD_012_METRICS.json` (compact before/after summary)
- `docs/build_reports/baselines/BUILD_012_regression.json` (full per-tile regression data)
- `docs/USER_GUIDE.md` — changelog entry (Thai)
- `docs/ROADMAP.md` — Shipped entry + Recommended Next Build pointer
- Verified: `tsc -b --force` clean, `oxlint` clean, full vitest suite
  (2178 tests, 168 files) green, `/studio` rebuilt, browser check.

## New/changed files

**New:**
- `src/engine/layoutEvaluation.ts` + test
- `src/engine/styleEvaluation.ts` + test
- `src/engine/penaltyRulesV2.ts` + test
- `src/engine/scoringV2.ts` + test
- `src/critic/commercialJudgeV2.ts` + test
- `scripts/build012Regression.ts`
- `docs/build_reports/BUILD_012_AUDIT.md`, `BUILD_012_REPORT.md`, `BUILD_012_METRICS.json`
- `docs/build_reports/baselines/BUILD_012_regression.json`

**Changed:**
- `src/collection/productTargets.ts` (3 new products + `isRepeatProduct`)
- `src/engine/negativeSpaceDesigner.ts` (3 new product entries)
- `src/generators/botanicalFamilies.ts` (3 new product→usage-profile entries)
- `src/engine/candidateEngine.ts` (V2 scoring wiring)
- `src/critic/problems.ts` (layout-aware `detectProblems`)
- `src/critic/designReport.ts` (threads real `repeatType` through)
- `scripts/qualityReport.ts` (exported `SCENARIO_SUITE`/`SCENARIO_SEEDS`/`buildScenarioParams`/`XL_PORTFOLIO_SEEDS` for reuse — no behavior change)
- Test fixture updates: `productTargets.test.ts`, `knowledge/collection/index.test.ts`,
  `knowledge/pattern/index.test.ts`, `knowledge/recommendation/index.test.ts` (product
  count 10→13), `improvementLoop.test.ts`, `evolutionEngine.test.ts` (fixtures that were
  unknowingly exploiting the bias, retuned to their real intended mechanism)

## Rules compliance

- **No score inflation**: proven — 10/15 presets are byte-identical.
- **No manual overrides**: every exemption is rule-level, derived from
  measured bias data, applied uniformly by layout class — never a per-
  preset or per-tile special case.
- **No preset-specific hacks**: `PENALTY_RULES_V2`/`isPenaltyApplicable`
  never reference a Style DNA id; gating is entirely by `layoutEvaluationClass`
  (a structural property of `LayoutId`) and `isRepeatProduct` (a structural
  property of `ProductUseId`).
- **No fake improvements**: every claimed improvement is backed by the
  Section 8 regression JSON, reproducible by re-running
  `scripts/build012Regression.ts`.
- **Every change explainable and measurable**: Section 7's explainability
  trace + Section 1's bias tables cover every rule's applicability decision.
