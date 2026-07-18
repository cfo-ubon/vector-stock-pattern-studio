# Build 013 Audit — Portfolio Intelligence & Self-Improvement Engine

Read before writing any code: `scripts/qualityReport.ts`, `scripts/commercialRealityCheck.ts`,
`scripts/build012Regression.ts`, `engine/scoringV2.ts`, `engine/penaltyRulesV2.ts`,
`engine/layoutEvaluation.ts`, `engine/styleEvaluation.ts`, `critic/commercialJudgeV2.ts`,
`engine/portfolioQuality.ts`, `engine/portfolioVariety.ts`, `collection/productTargets.ts`,
`collection/collectionGenerator.ts`, `knowledge/registry/knowledgeRegistry.ts`,
`knowledge/schema_version.json`, `knowledge/registry/styleSchema.ts`,
`knowledge/registry/speciesSchema.ts`, `engine/svgGeometry.ts`, `engine/heroDetector.ts`,
`engine/styleDna.ts` + all 15 `src/style-dna/*.json`.

## Section 1 findings

### Reusable modules (extend, don't replace)

- **`scripts/qualityReport.ts`**'s `evaluate(label, params, styleDnaId?)` is the single
  existing per-tile evaluation entrypoint — it already computes every real metric this
  build needs (`CompositionMetrics`, Absolute Commercial Quality, Hero Visibility, Pattern
  Beauty Score, Commercial Pattern Critique, Commercial Style Analysis, Luxury Composition,
  Commercial Appeal Score V2, readability, node count, visual issues, style-fit quality,
  product-target fit, botanical family, illustration quality (+V2), premium hero
  archetypes). Build 013 reuses `evaluate()` and `buildPortfolioParams()` unchanged —
  it does NOT re-implement tile building or metric computation. `EvalResult` still uses
  Build 012's V1 `computeOverallScore` internally for `absoluteCommercialQuality` (not
  V2) — Section 2 documents this explicitly and Section 5's ranking recomputes a V2 score
  alongside it using the real `layoutId` already on every `EvalResult`, rather than
  patching `evaluate()` itself (keeps the frozen baseline's own behavior byte-identical).
- **`engine/scoringV2.ts`**'s `computeOverallScoreV2` + `engine/penaltyRulesV2.ts` +
  `engine/layoutEvaluation.ts` + `engine/styleEvaluation.ts` are Build 012's corrected,
  context-aware evaluation layer — this is the "Evaluation Intelligence Engine V3" the
  brief refers to. Reused directly for every ranking/scoring computation in Build 013.
- **`critic/commercialJudgeV2.ts`**'s `computeCommercialJudgeV2` — reused for the
  "commercial verdict" half of Section 5's multi-signal ranking (Shelf Impact, Surface
  Pattern Suitability) without re-deriving those dimensions.
- **`collection/productTargets.ts`**'s `evaluateProductTargets` + `recommendedProductUses`
  — reused to assign each generated pattern's real "product target" field (Section 3):
  the top-ranked product from `recommendedProductUses(evaluations, 1)[0]`, not an
  externally-imposed label. This is what makes "product-target diversity" (Section 4) and
  "per-product rank" (Section 5) real, measured facts rather than synthetic tags.
- **`engine/portfolioQuality.ts`**'s diversity/consistency functions
  (`computeSpeciesDiversity`, `computeCompositionDiversity`, `computeClusterDiversity`,
  `computeHeroDiversity`, `computeHeroArchetypeDiversity`, `computeSignatureFingerprintDistinctness`,
  `computePortfolioConsistency`, `detectSequentialStyleDrift`) — reused as-is for portfolio-
  level diversity statistics feeding Sections 6/9. `computeSignatureFingerprintDistinctness`
  is a *preset*-level fingerprint (are the 15 presets distinguishable from each other) —
  **not** a per-tile similarity/duplicate mechanism; no existing code does per-tile
  similarity across thousands of instances (confirmed: no `similarity`/`duplicate`
  concept anywhere operates above the single-batch `rejectExactDuplicates` byte-for-byte
  check in `engine/candidateEngine.ts`, which only ever compares candidates *within one
  generation session*, never across a whole portfolio). **Section 8's per-tile similarity/
  duplicate engine is genuinely new** — built from already-real per-tile signals
  (`extractInstances`, `extractMotifShapeSignatures`, palette, hierarchy fields, declared
  Style DNA fields), not invented geometry.
- **`engine/svgGeometry.ts`**'s `extractInstances`/`extractMotifShapeSignatures` — reused
  as the geometric basis for Section 8's composition/silhouette fingerprint components.
- **`knowledge/schema_version.json`** + `knowledge/registry/styleSchema.ts`'s
  `STYLE_SCHEMA_VERSION` + `knowledge/registry/speciesSchema.ts`'s `SPECIES_SCHEMA_VERSION`
  — real, already-versioned artifacts reused verbatim for Section 2's baseline manifest
  (`knowledgeVersion`/`styleSchemaVersion`/`speciesSchemaVersion`) instead of inventing
  parallel version numbers.
- **`engine/portfolioVariety.ts`**'s `assignPortfolioDiversity`/`assignBatchValues` — a
  generation-time (not analysis-time) diversity-forcing mechanism for UI batch generation.
  Not in Build 013's direct reuse path (the 5,000-pattern portfolio uses the same
  Style-DNA-driven `buildPortfolioParams` seed convention `commercialRealityCheck.ts`/
  `build012Regression.ts` already established, which lets each preset's own real
  `resolveStyleDna` variability show through rather than forcing external diversity) —
  documented here so a future reviewer doesn't wonder why it's unused.
- **`app/scripts/build012Regression.ts`**'s `stats()`/tier-runner pattern — the
  aggregation/percentile-adjacent statistics convention (mean/median/p10/p90/failureRate)
  every prior build's harness already established; Section 5 extends this with true
  percentile buckets and multi-signal ranking rather than replacing it.

### Modules that must NOT change

- `engine/scoring.ts`, `engine/scoringV2.ts`, `engine/penaltyRulesV2.ts`,
  `engine/layoutEvaluation.ts`, `engine/styleEvaluation.ts` — Build 012's just-shipped,
  regression-tested evaluation fix. Build 013 is an analysis layer *on top of* this
  evaluator, never a modification of it (the brief's own "no scoring changes intended
  only to raise numbers" and "self-modifying production code" prohibitions). Any Build
  013 finding that implies a scoring change becomes a Section 11/12 *recommendation*,
  never an applied edit.
- `scripts/qualityReport.ts`'s `evaluate()`/`buildPortfolioParams()` signatures — reused
  read-only; Build 013 adds new analysis modules that *consume* their output.
- The 15 Style DNA preset JSON files (`src/style-dna/*.json`) and
  `knowledge/registry/data/species/*.json` — read-only source data.

### Current portfolio manifests / metric schemas already in the repo

- `docs/build_reports/baselines/BUILD_011_5_commercial_reality_check.json` (1,500 tiles,
  15×100) and `docs/build_reports/baselines/BUILD_012_regression.json` (V1-vs-V2 scores
  across 4 tiers) are the two largest existing manifests. Neither carries a `schemaVersion`
  field, a similarity fingerprint, a cluster assignment, a rank/percentile, or a
  provenance-version block — confirming Sections 3/5/8/9's data model is genuinely new,
  not a re-implementation.

### Available per-pattern metadata (from `EvalResult`, already real)

`label`, `layoutId`, `categoryId`, `seed`, `styleDnaId`, full `CompositionMetrics` (29
fields), `absoluteCommercialQuality`, `heroVisibility`, `patternBeautyScore`, `readability`
(3 zoom levels), `nodeCount`, `issues` (visual-issue booleans), `styleFitQuality`,
`productTargetFit`, `botanicalFamily`, `illustrationQuality`/`visualRichness`/
`illustrationQualityV2`, `commercialPatternCritique` (8 fields), `commercialStyleAnalysis`,
`luxuryComposition` (7 fields + overall), `commercialAppealScoreV2` (6 fields),
`premiumHeroArchetypes`. This is already ~65 real, distinct measured values per tile —
Section 3's schema is primarily an *organizing/versioning* layer over what already exists,
plus the genuinely new fields (fingerprint, cluster, rank/percentile, confidence,
recommendation tags, provenance).

### Current similarity detection

None at portfolio scale (see above) — `rejectExactDuplicates` in `candidateEngine.ts` is
the only existing "sameness" check, and it is intentionally scoped to one candidate pool
(same base seed, same generation session), comparing serialized SVG strings byte-for-byte.
It has no notion of "near-duplicate" or cross-preset/cross-seed similarity. Section 8 is
new work.

### Current diversity measurement

`portfolioQuality.ts`'s 5 `compute*Diversity` functions all measure "fraction of a real,
fixed taxonomy actually used" (species/layouts/cluster templates/silhouettes/hero
archetypes) — a coverage measurement, not a pairwise-similarity or clustering mechanism.
Reused for Section 6/9's supporting statistics; does not replace Section 8/9's genuinely
new pairwise/clustering work.

### Current ranking functions

None. Every prior build's "ranking" was either (a) `candidateEngine.ts`'s
`pickBestCandidate` — picks one winner from a small (4-12) candidate pool by score, no
percentile/grouping concept — or (b) aggregate `stats()` (mean/median/p10/p90) over a
whole tier, never a per-item rank. Section 5 is genuinely new.

### Missing statistical capabilities (confirmed gaps)

- No percentile-bucket assignment (top/bottom 1%/5%/10%, middle 50%) anywhere.
- No pairwise similarity / clustering algorithm anywhere in `src/` or `scripts/`.
- No confidence-scoring framework (sample-size/variance-aware) anywhere — every existing
  score is a point estimate.
- No recommendation-ranking (impact vs. risk) framework — `docs/ROADMAP.md`'s
  "Recommended Next Build" sections are hand-written prose, not computed.

### Performance constraints for 5,000-pattern analysis

Measured from Build 011.5 (1,500 tiles, full `evaluate()` pipeline, single-threaded
Node/tsx): 436,375ms total ≈ 291ms/tile. Build 012's regression script (2,130 tiles across
4 tiers, V1+V2 scoring on top of generation) ran in 384,218ms ≈ 180ms/tile (lighter per-
tile work — no rasterization, no 1500-specific overhead repeated). Linear extrapolation to
5,000 tiles: **~15-24 minutes of single-threaded generation+evaluation**, well within a
single background shell command's budget (this environment's Bash tool supports
backgrounded, long-running commands with completion notification — used successfully for
both prior large runs). Memory: each tile's `TileData`/`CompositionMetrics`/`EvalResult`
is small (KBs); holding 5,000 in memory before flushing to JSON is not a concern (Build
011.5 already held 1,500 full `EvalResult`s, including nested SVG-derived structures,
without issue). The real risk is disk/JSON size if *raw SVG strings* are retained per
tile — Section 4 explicitly avoids this (metrics-only manifest; SVG re-derivable on demand
from `seed`+`styleDnaId` for the small visual-review subset only, per Section 13/14).

## Proposed architecture

New, additive modules only (nothing above is modified):

- `src/portfolio/types.ts` — `PORTFOLIO_SCHEMA_VERSION` + `PortfolioPatternRecord`
  (Section 3), `PortfolioBaselineManifest` (Section 2).
- `src/portfolio/baseline.ts` — builds the frozen baseline manifest from real, already-
  versioned sources (`knowledge/schema_version.json`, `STYLE_SCHEMA_VERSION`,
  `SPECIES_SCHEMA_VERSION`, current git commit hash as the evaluator/generator pin, a new
  `PENALTY_SYSTEM_VERSION` constant added to `engine/penaltyRulesV2.ts` itself since that
  module has never been versioned).
- `src/portfolio/fingerprint.ts` — Section 8's per-tile similarity fingerprint, built from
  already-real per-tile signals (declared Style DNA/layout/product/botanical fields +
  `extractMotifShapeSignatures` + palette + hierarchy proportions), plus a distance
  function and duplicate/near-duplicate classifier with adjustable thresholds.
- `src/portfolio/ranking.ts` — Section 5's multi-signal composite rank + percentile
  bucketing (documented formula).
- `src/portfolio/clustering.ts` — Section 9's clustering (k-means over a small, real
  numeric feature vector — quality/hero-visibility/occupancy/paletteContrast/layout-class/
  product-fit — with a silhouette-score sweep to pick k, not a hardcoded cluster count),
  plus human-readable cluster summarization from real dominant-field tallies.
- `src/portfolio/confidence.ts` — Section 10's sample-size/variance-aware confidence tiers.
- `src/portfolio/successFailure.ts` — Sections 6/7's trait-frequency and failure-mode
  analysis over top/bottom groups.
- `src/portfolio/recommendations.ts` — Section 11/12's recommendation model + impact/risk
  ranking + the single Build 014 recommendation contract.
- `scripts/portfolioGenerate.ts` — Section 4: generates the 5,000-tile metrics-only
  manifest, checkpointed/resumable (Section 14), reusing `evaluate()`/`buildPortfolioParams()`.
- `scripts/portfolioAnalyze.ts` — Sections 5-12 orchestration over the generated manifest;
  writes all derived JSON + the visual-review subset selection.
- `scripts/portfolioVisuals.ts` — Section 13: renders only the selected review subset
  (reusing Build 011.5's `renderRealityCheckSamples.ts` + Playwright-rasterization
  pattern), never all 5,000.

## Implementation sequence

1. Section 2 (baseline manifest) — cheap, no generation needed, unblocks provenance
   fields for everything else.
2. Section 3 (data model/schema) — types only, compiles against nothing yet.
3. Section 4 (generation script) — writes the 5,000-tile manifest; run in background.
4. Sections 5-11 (analysis modules + orchestration script) — pure functions over the
   manifest, testable with small synthetic fixtures before the real 5,000-tile run
   finishes generating.
5. Section 12 (Build 014 recommendation) — derived from Section 11's ranked output.
6. Section 13 (visual artifacts) — after the manifest + rank/cluster assignments exist.
7. Section 14/15 (perf docs + tests) — throughout, finalized last.
8. Section 16 (docs/report/commit/push).

## Risks

- **Runtime**: ~20 minutes for generation — mitigated by running in the background while
  writing analysis code in parallel (matches this session's established pattern for Build
  011.5/012's own large runs).
- **Clustering cost**: naive k-means on 5,000×~8-dim vectors across a k-sweep is cheap
  (well under a second) — no performance risk.
- **Fingerprint pairwise distance**: a naive O(n²) all-pairs comparison over 5,000 tiles is
  12.5M pairs — too slow/wasteful for a meaningful "near-duplicate" signal, which is
  inherently local (only tiles sharing the same preset/layout/product are plausible
  duplicates of each other). Mitigation: bucket by `(styleDnaId, layoutId)` first (15
  presets × ≤2 layouts each ⇒ small buckets, typically 150-350 tiles), then do pairwise
  comparison only within a bucket — real, bounded, honest, and matches the brief's own
  "avoid treating all same-collection designs as duplicates" instruction (cross-preset
  patterns are never compared as potential duplicates of each other, which is correct —
  they can't be near-duplicates by construction).
