# Build 019 Report — Visual Commercial Upgrade

## Scope confirmation

Per the brief's explicit instructions:
- **No new commercial scoring engine.** Every measurement in this report
  comes from existing, unmodified systems (`engine/scoring.ts`,
  `engine/botanicalBeautyMetrics.ts`, `engine/luxuryComposition.ts`,
  `critic/commercialPatternCritic.ts`, `critic/commercialAppealScore.ts`,
  `engine/heroDetector.ts`'s quality-retry gate).
- **No architecture redesign, no large refactor.** The one production
  code change is a single, additive, evidence-targeted addition inside
  `generators/botanical.ts` (an optional-stem wrapper, described below)
  plus small, non-behavior-changing plumbing in
  `batch/batchProductionService.ts` to surface retry-gate data that was
  already being computed. No layout, placement, or composition-engine
  code was touched.
- **No unrelated UI work.** No component files were changed.

## 1. Baseline audit (Priority 1)

**Method**: `scripts/build019VisualAudit.ts` (new, permanent, re-runnable
— matches this repo's `scripts/build0NNRegression.ts`/`build018BotanicalAudit.ts`
convention). Reuses the existing pipeline end-to-end — `buildTileForGenerate`
(the real quality-retry gate every generation call goes through),
`computeBotanicalBeautyMetrics`, `computeHeroVisibilityScore`,
`computeLuxuryCompositionScore`, `computeCommercialAppealScoreV2`,
`computeOverallScore` — no new scoring math anywhere in the script.

**Sample**: all 8 Style DNA presets whose `categories` include
`'botanical'` (bohoFloral, darkBotanical, editorialBotanical, luxuryFloral,
minimalBotanical, scandinavianOrganic, softWatercolorInspired,
vintageHerbarium) × 4 seeds × 3 density bands (low 0.3 / medium 0.55 /
high 0.8) = **96 patterns**, each pattern's `categoryId` forced to
`'botanical'` (a mixed-category preset's own random pick is irrelevant to
this build's botanical-specific priorities) while every other resolved
Style DNA field (palette, layout, zone, family, hierarchy) is left exactly
as `resolveStyleDna` computed it — "relevant pattern types" via real
layout/zone/family diversity, "relevant density levels" via the explicit
3-band sweep.

Raw output: `docs/build_reports/BUILD_019_VISUAL_AUDIT_before.json`.

## 2. Weakest dimensions discovered

| Rank | Dimension | Mean | Min | p10 |
|---|---|---|---|---|
| 1 (weakest) | **Botanical Realism** | 40.79 | 24 | 31 |
| 2 | **Organic Flow** | 45.80 | 34 | 38 |
| 3 | **Botanical Complexity** | 51.19 | 31 | 37 |
| — | Silhouette Beauty | 62.38 | | |
| — | Natural Growth | 71.29 | | |
| — | Overall Visual Quality | 72.77 | | |
| — | Commercial Appeal | 72.77 | | |
| — | Commercial Readiness | 74.92 | | |
| — | Asset Harmony | 77.50 | | |
| — | Flower Hierarchy | 78.67 | | |
| — | Luxury Feeling | 80.43 | | |
| — | Hero Visibility | 85.01 | | |
| — | Leaf Diversity | 93.20 | | |
| — | Cluster Harmony | 96.21 | | |
| — | Negative Space (breathingRoom) | 97.71 | | |
| — | Composition | 99.61 | | |
| — | Layered Depth (heroSeparation) | 100.00 | | |

The brief explicitly warns not to assume Organic Flow is the weakest
without current measurement — confirmed: **Botanical Realism was
weakest**, Organic Flow second. (Build 018's own "Recommended Next
Build" note had flagged Organic Flow at "mean ~41" from a smaller,
narrower 60-pattern sample; this build's broader 96-pattern, multi-density
measurement puts Botanical Realism lower once measured directly.)

## 3. Root-cause analysis

**Botanical Realism** (`computeBotanicalRealism`) measures the fraction
of placed motif instances whose own SVG subtree carries a real
`data-part="stem"` or `data-part="leaves"` growth structure. Reading
`generators/botanical.ts`'s 28 registered variants against their
`TAGGED_VARIANTS.category` tags:

- `category: 'branch'` (leafyBranch, fernFrond, wildflowerSprig,
  eucalyptusSprig, oliveBranch, laurelSprig, sageSprig, palmFrond) — all
  growth-engine-based (`generators/growth.ts`), always carry stem/leaves.
- `category: 'bud'` (flowerBud) — always carries a stem.
- `category: 'flower'` (15 variants: flowerBloom, simpleTulip,
  layeredBloom, peonyFlower, roseFlower, ranunculusRosette, proteaFlower,
  poppyFlower, anemoneFlower, daisyFlower, cosmosFlower, bellFlower,
  magnoliaFlower, hydrangeaBloom, lavenderSpike) — **14 of 15 draw no
  stem or leaf structure at all.** Only `flowerBloom` (fixed in Build
  018, Priority 4) has one, and only 60% of the time.

Since `'flower'`-category variants are roughly half the full pool and
compete evenly with the growth-based branch variants across every
family, roughly half of all placed instances structurally cannot score a
realism hit — matching the measured ~41/100 mean almost exactly.

**Botanical Complexity** (`computeBotanicalComplexity`) is average real
SVG node count per instance against a fixed ceiling — the same 14 bare
flower-head variants are also the *simplest* geometry in the pool (just
petal rings + a center dot, no stem/leaf sub-nodes), so this dimension's
weakness traces back to the identical root cause.

**Organic Flow** (`gridAppearanceScore`/`rhythmRegularity` average) is
purely a function of instance *placement* (nearest-neighbor angles and
distance regularity), not motif shape — a diagnostic breakdown (by
layout: heroFlow/sCurve/scatter/airy score 41-43, bouquet/grid score
50-56; by density: fairly flat 43.7-48.0 across low/medium/high) shows
this is a composition/placement-engine characteristic, not something the
motif generator can move. Fixing it safely requires touching shared
placement code (`layouts/*.ts`, `engine/compositionIntelligence.ts`) used
by every category, not just botanical — out of scope for the brief's "no
architecture redesign, no large refactor unless strictly required"
constraint. See "Remaining commercial-quality gaps" below.

## 4. Files and modules changed

- `app/src/generators/botanical.ts` — added `attachOptionalStem` (new,
  ~35 lines) and wired it into `createMotif` via a `CATEGORY_BY_VARIANT`
  lookup map (new, ~3 lines); `__testables` extended for direct test
  access. No existing variant function's own code was touched.
- `app/src/batch/batchProductionService.ts` — `BatchProductionItemResult`
  gained `attempts`/`regenerated`; `BatchProductionResult` gained
  `retryRate`/`meanAttempts`, aggregated from data `buildTileForGenerate`
  already computed (previously discarded). No behavior change to which
  patterns get generated, retried, or imported.
- `app/scripts/build019VisualAudit.ts` (new) — the Priority 1 audit
  script, kept as a permanent re-runnable artifact.
- `app/scripts/build019BatchPerf.ts` (new) — the Priority 6 batch
  performance/retry/diversity measurement script.

## 5. Reused existing systems (no duplication)

- Quality-retry gate: `engine/heroDetector.ts`'s `buildTileForGenerate` /
  `buildTileWithCommercialRetry` (Build 003/007/018) — unchanged. Every
  pattern in this build's audit, the botanical fix's own measurement, and
  Batch Generate all go through this exact same gate.
- Scoring: `engine/scoring.ts`, `engine/botanicalBeautyMetrics.ts`,
  `engine/luxuryComposition.ts`, `critic/commercialPatternCritic.ts`,
  `critic/commercialAppealScore.ts` — read-only, zero changes.
- Diversity: `engine/portfolioVariety.ts`'s `assignPortfolioDiversity`
  (Build 003/004/018) — unchanged, still the only diversity logic Batch
  Generate uses.
- Stem geometry idiom: the exact `<line>`-wrapped-in-`data-part="stem"`
  pattern `flowerBud`/`flowerBloom` (Build 018) already established —
  `attachOptionalStem` reuses it rather than inventing a new drawing
  convention; the optional leaf reuses the file's own existing `leafNode`
  helper.

## 6. Before/after metrics

96-pattern sample, identical seeds/presets/densities, before vs. after
the `attachOptionalStem` fix
(`docs/build_reports/BUILD_019_VISUAL_AUDIT_{before,after-stem}.json`):

| Dimension | Before | After | Δ |
|---|---|---|---|
| **Botanical Realism** | 40.79 | **50.93** | **+10.14 (+24.9%)** |
| **Botanical Complexity** | 51.19 | **53.11** | **+1.92 (+3.8%)** |
| Organic Flow | 45.80 | 46.40 | +0.60 (+1.3%, flat/no regression) |
| Leaf Diversity | 93.20 | 98.16 | +4.96 |
| Natural Growth | 71.29 | 71.55 | +0.26 |
| Composition | 99.61 | 99.66 | +0.05 |
| Negative Space | 97.71 | 97.71 | flat |
| Layered Depth | 100.00 | 100.00 | flat |
| Asset Harmony | 77.50 | 77.50 | flat |
| Silhouette Beauty | 62.38 | 61.79 | -0.59 |
| Flower Hierarchy | 78.67 | 77.28 | -1.39 |
| Cluster Harmony | 96.21 | 95.31 | -0.90 |
| Luxury Feeling | 80.43 | 79.73 | -0.70 |
| Hero Visibility | 85.01 | 84.01 | -1.00 |
| Commercial Readiness | 74.92 | 74.46 | -0.46 |
| Overall Visual Quality / Commercial Appeal | 72.77 | 70.55 | -2.22 (-3.1%) |
| Retry rate / mean attempts | 16.67% / 1.31 | 16.67% / 1.31 | unchanged |

**Explaining the Overall Visual Quality dip**: a sub-metric breakdown
(same 96-pattern sample, isolated via a revert-and-measure comparison)
shows the -2.22 composite drop is driven almost entirely by
`heroDetailRatio` (73.44 → 71.38): giving the *filler/secondary* flower
instances real stem/leaf structure makes them internally richer, which
narrows the hero's *relative* detail advantage over everything else —
`heroDetailRatio` measures that gap, not either side's absolute detail.
Every other principal `CompositionMetrics` field (`overlapQuality`,
`heroSeparation`, `edgeDensity`, `svgHealth`, `densityVariance`,
`occupancyRatio`, `largestEmptyRegion`) moved by less than 0.4 points.
This is judged an acceptable, evidence-explained trade: Priority 4
explicitly asks for "flowers and stems... large, medium, small, and tiny
motif tiers... appear intentionally connected rather than independently
scattered" — richer non-hero motifs is that requirement being satisfied,
and its one measurable cost is fully accounted for, not hidden.

## 7. Test results

- 5 new tests, `generators/botanical.test.ts` ("optional stem wrapper for
  bare flower-head variants" describe block): deterministic for a fixed
  rng seed; radius grows by exactly the stem length when a stem is
  added, strict no-op (same node reference) when it isn't; never applies
  to `flowerBloom` (its own Build 018 stem logic); `createMotif` reaches
  a bare variant (`proteaFlower`, confirmed to draw zero stem structure
  on its own) and attaches a real stem across a seed sweep; deterministic
  end-to-end through `createMotif`.
- 1 new test, `batch/batchProductionService.test.ts`: every item's
  `attempts`/`regenerated` are internally consistent, and the aggregate
  `retryRate`/`meanAttempts` match a hand-computed expectation over the
  same items.
- 1 pre-existing test updated (`returns an all-zero result for count 0`)
  to include the two new zero-valued result fields.
- All 90 pre-existing tests across `botanical.test.ts`,
  `botanicalFamilies.test.ts`, `botanicalBeautyMetrics.test.ts`,
  `heroDetector.test.ts`, `visualAnalysis.test.ts`,
  `illustrationQualityV2.test.ts` pass unmodified.
- Full suite: **269/269 test files, 3043/3043 tests passing** (was
  269/269, 3037/3037 before this build — +6 new tests, 0 removed, 0
  skipped).

## 8. Performance results (Priority 6 — Batch Integration)

`scripts/build019BatchPerf.ts`, real `generateBatchToPortfolio` calls
(the same function the UI's "Batch Generate" button calls), sizes
10/20/50/100:

**With an active Style DNA (editorialBotanical, deterministic)**:

| Count | Time | ms/item | Errors | Retry rate | Distinct families / zones |
|---|---|---|---|---|---|
| 10 | 613ms | 61.3 | 0 | 40% | 3/3 (100% of style's own 3-family/3-zone palette) |
| 20 | 900ms | 45.0 | 0 | 30% | 3/3 |
| 50 | 2300ms | 46.0 | 0 | 30% | 3/3 |
| 100 | 4473ms | 44.7 | 0 | 26% | 3/3 |

**No active Style DNA (full diversity space)**:

| Count | Time | ms/item | Errors | Retry rate | Distinct families / zones |
|---|---|---|---|---|---|
| 10 | 1183ms | 118.3 | 0 | 0% | 10/10 |
| 20 | 4136ms | 206.8 | 0 | 0% | 19/10 |
| 50 | 12846ms | 256.9 | 0 | 0% | 19/10 |
| 100 | 14766ms | 147.7 | 0 | 2% | 19/10 |

Zero errors across every run (0% failure rate). Diversity is fully
preserved: with a Style DNA active, every item lands within that
preset's own declared family/zone palette (the correct, intentional
behavior); without one, the full 19-family/10-zone space is reached
within the first 20 items.

**Generation-time regression check**: the same `editorialBotanical`
10/20/50/100 runs repeated against the pre-fix `botanical.ts` (via a
scoped `git stash`) gave 672/911/2324/4800ms — statistically
indistinguishable from the post-fix 613/900/2300/4473ms (all deltas
within ~10%, consistent with normal timing jitter, not a directional
regression). **No major generation-time regression.**

## 9. Regression assessment

- Full suite: 269/269 test files, 3043/3043 tests passing (see Section
  7).
- `npx tsc -b --force`: clean.
- `npm run lint` (oxlint): clean.
- One unrelated `Unhandled Rejection` (`window is not defined` inside
  React DOM's internal scheduler, surfacing during
  `AssetLibraryPanel.test.tsx`) was logged by Vitest during the full run
  but caused **zero test failures** — that file, and the whole
  Asset/Workbench module tree, were not touched by this build. Judged
  pre-existing test-environment noise (async React state update racing
  jsdom teardown in an unrelated component test), consistent with this
  repo's own documented precedent for this class of issue (Build 016/018
  regression investigations).
- Manual browser verification (real dev build, Playwright): selected the
  Botanical category, clicked Generate — zero console/page errors; set
  Batch Generate to 20, clicked "Generate 20 to Portfolio," confirmed
  "บันทึกแล้ว 20/20" (saved 20/20, zero duplicates/errors) and that
  "Download Batch ZIP" appeared — zero console/page errors throughout.
- `catalog/domain/collection.ts`, `catalog/storage/collectionStore.ts`,
  `catalog/services/collectionService.ts` (frozen Collection API,
  `collectionApiFreeze.test.ts` passed unmodified), `catalog/submission/`,
  `catalog/seo/`, `catalog/dashboard/`, and every non-botanical generator
  (`geometric.ts`, `organic.ts`, `tropical.ts`, etc.) are untouched.

## 10. Remaining commercial-quality gaps

- **Organic Flow** (mean 46.4, now the single weakest dimension) is
  driven by shared placement/composition code (`layouts/*.ts`,
  `engine/compositionIntelligence.ts`, `engine/rhythmBands.ts`), not the
  botanical motif generator — the diagnostic breakdown in Section 3 shows
  it's fairly flat across density (43.7-48.0) but varies meaningfully by
  layout (heroFlow/sCurve/scatter/airy at 41-43 vs. bouquet at 56). A
  real fix here touches code shared by every category and needs its own
  careful, isolated measurement pass to avoid a cross-category
  regression — exactly the kind of change this build's "no architecture
  redesign, no large refactor unless strictly required" constraint rules
  out doing hastily.
- The Overall Visual Quality / Commercial Appeal composite dipped ~2.2
  points (Section 6) as an explained, accepted side effect of richer
  non-hero motifs narrowing `heroDetailRatio`'s relative gap. Not
  regressed to a failing level (still 70.55/100, well above the
  `METRIC_FAILURE_FLOOR` of 50), but worth tracking if a future build
  also touches hero-vs-filler detail balance.
- 1 of 15 `'flower'`-category variants (`flowerBloom`) still uses its own
  Build 018 stem logic rather than the new shared `attachOptionalStem` —
  deliberate (avoids touching already-tested, already-shipped code) but
  means there are now two stem-attachment code paths for this one
  category, worth consolidating in a future cleanup pass if a third one
  is ever needed.

## 11. Recommended next build

**Organic Botanical Flow, Phase 2 — Placement-level fix.** Section 3's
diagnostic evidence (layout-level breakdown, density-level breakdown)
should be the starting point: investigate why `heroFlow`/`sCurve`/
`scatter`/`airy` layouts score meaningfully lower on
`gridAppearanceScore`/`rhythmRegularity` than `bouquet` (56) or `grid`
(50, likely because default jitter fully overrides that layout's nominal
grid), and whether `engine/rhythmBands.ts`'s existing dense/loose wave
system (Build 003, currently deliberately excluded from Composition
Zone anchor placement) can be extended safely to the hero/secondary
layer without conflicting with the zone engine's own deliberate density
skew — this needs isolated, careful measurement across every category
(not just botanical) before shipping, since the placement code is
shared.

See `docs/ROADMAP.md`'s "Recommended Next Build" section for the
same recommendation in context.
