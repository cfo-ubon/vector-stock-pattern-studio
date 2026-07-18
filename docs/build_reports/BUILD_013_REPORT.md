# Build 013 Report — Portfolio Intelligence & Self-Improvement Engine

**Scope**: a read-only analysis layer on top of Build 012's evaluator. No new
generation engine, no new drawing primitives, no scoring changes, no
self-modifying production code. See `docs/build_reports/BUILD_013_AUDIT.md`
for the full Section 1 audit this build responds to.

## Executive summary

Build 012 fixed a real evaluation bias; Build 013's job was to prove that fix
holds at commercial scale and to find the *next* real problem using evidence,
not guesswork. It generated a genuinely uncurated 5,000-pattern portfolio
(all 15 Style DNA presets, ≥333 seeds each, deterministic `p13-<styleId>-<n>`
seeds, checkpoint/resume every 500 patterns — 756s total, 151ms/pattern), then
built six new analysis modules (`src/portfolio/`) on top of it: ranking and
percentiles, success/failure trait discovery with real lift and confidence,
bucketed near-duplicate detection, segment clustering, a confidence engine,
and a single evidence-driven Build 014 recommendation.

**Headline result**: Build 012's fix holds at scale. The three previously
broken presets (Minimal Botanical, Premium Textile, Boutique Packaging) score
77.1, 80.4, and 78.8 mean Absolute Commercial Quality V2 across 333-334 real
seeds each — squarely inside the same 75-88 healthy range as all 12 other
presets, with `high` statistical confidence on all three (coefficient of
variation ≤0.06). No preset needs special-casing.

**Second result**: near-duplication is a non-issue at this generation scale.
Across all 5,000 patterns, bucketed within `(styleDnaId, layoutId)` pairs:
0 exact duplicates, 0 deterministic duplicates, 1 near-duplicate.

**Build 014 recommendation** (Section 12): address `zeroMotifOverlap` —
patterns with zero motif overlap appear in 8.8% of the bottom decile vs 1.0%
portfolio-wide (9.13x lift, 44 samples, `high` confidence). See Section 12
below.

## Section 1 — Portfolio Intelligence Audit

See `BUILD_013_AUDIT.md`. Headline findings: no ranking/percentile,
success/failure-pattern, per-tile similarity/duplicate, clustering,
confidence, or recommendation system existed anywhere in the codebase before
this build — every one of Sections 5-12 is genuinely new, built from
already-real per-tile signals (Build 011/012's own metrics, penalties,
commercial scores, product-fit scores, shape-topology signatures) rather than
inventing new measurements. `scripts/qualityReport.ts`'s `evaluate()`/
`buildPortfolioParams()` and Build 012's `computeOverallScoreV2`/
`computeCommercialJudgeV2` are reused read-only throughout.

## Section 2 — Frozen Evaluation Baseline

`src/portfolio/baseline.ts` builds one manifest per run, pinning
`knowledgeVersion`/`styleSchemaVersion`/`speciesSchemaVersion` (existing
version constants, Build 008A), the new `PENALTY_SYSTEM_VERSION = 2`
(`engine/penaltyRulesV2.ts` — Build 012's own penalty system had no explicit
version number before), the real git commit HEAD was at, and the documented
seed policy. Every one of the 5,000 pattern records carries this baseline in
`provenance.baseline`, so any future comparison run has an unambiguous
"what evaluator/generator state produced this" pin.

## Section 3 — Portfolio Data Model

`src/portfolio/types.ts`: `PortfolioPatternRecord` (schema version 1, ~46
fields) — identity, product target, botanical/color/cluster fields, full
metrics + V1/V2 scores + penalty traces, commercial-judge scores, similarity
fingerprint + duplicate status, cluster assignment, rank/percentile fields,
failure modes/strength tags/recommendation tags, evaluator confidence, and
provenance. All Section 5-12 fields are `undefined` until their respective
analysis pass runs, and are documented as such.

## Section 4 — Large Portfolio Generation

`scripts/portfolioGenerate.ts`: 5,000 patterns, distribution `5*334 + 10*333
= 5000` (first 5 `STYLE_IDS` get 334, rest get 333 — every preset clears the
≥250-per-preset floor). Checkpoints every 500 patterns to
`BUILD_013_portfolio_checkpoint.json`; on interruption, the script skips every
already-completed `(styleId, seed)` pair on restart. Actual run: **756,328ms
total, 151ms/pattern**, in line with the audit's 15-24 minute estimate for
5,000 tiles. Final distribution (verified):

```
editorialBotanical: 334   luxuryFloral: 334      scandinavianOrganic: 334
minimalBotanical: 334     vintageHerbarium: 334   darkBotanical: 333
modernTropical: 333       boutiquePackaging: 333  luxuryWallpaper: 333
premiumTextile: 333       kidsPlayful: 333        retroOrganic: 333
organicAbstract: 333      bohoFloral: 333         softWatercolorInspired: 333
```

The raw 5,000-record manifest (~59MB) and its checkpoint are gitignored —
reproducible any time via `npx tsx scripts/portfolioGenerate.ts` — only the
summarized `BUILD_013_METRICS.json` (~114KB) is committed.

## Section 5 — Ranking and Percentiles

`src/portfolio/ranking.ts`: `compositeRankScore` is an unweighted average of
5 already-real 0-100 scores (Absolute Commercial Quality V2, Commercial
Appeal V2 Overall, Luxury Composition Overall, Surface Pattern Suitability,
Product Target Score) — unweighted deliberately, since inventing per-signal
weights with no evidence behind them would be exactly the "arbitrary number"
the brief forbids. Competition ranking (ties share a rank) computed overall
and scoped within preset/product/layout. Percentile buckets
(top1/top5/top10/middle50/bottom10/bottom5/bottom1/other) computed per
pattern for compact labeling; the analysis functions (Sections 6/7) use the
underlying percentile value directly (cumulative — "top 10%" includes the
top 1%/5% nested inside it), not the mutually-exclusive bucket label.

## Section 6 — Success Pattern Discovery

`src/portfolio/successFailure.ts`: compares trait-value frequency in the top
decile (530 patterns, `percentileOverall >= 90`) against the whole portfolio.
Top findings by lift (all traits, portfolio-wide):

| Trait | Value | Lift | Occurrences | Confidence |
|---|---|---|---|---|
| strengthTag | strongStyleFitQuality | 3.72x | 254/530 | High |
| compositionZone | goldenRatio | 3.66x | 64/530 | High |
| compositionZone | cornerFlow | 3.26x | 106/530 | High |
| layoutId | gridMinimal | 4.16x | 150/530 | Medium (69% taxonomy coverage) |
| styleDnaId | minimalBotanical | 3.25x | 115/530 | Medium (53% taxonomy coverage) |

Reading: strong style-fit quality and the `goldenRatio`/`cornerFlow`
composition zones are the most confidently over-represented traits among
top-decile patterns — both real, already-declared/measured fields, not new
metrics invented for this finding.

## Section 7 — Failure Pattern Discovery

Same mechanism, bottom decile (502 patterns, `percentileOverall <= 10`).
Every high-confidence finding is a `failureMode` (the only trait category
naming a fixable mechanism, vs. `styleDnaId`/`layoutId` which only describe
*where* problems cluster):

| failureMode | Lift | Occurrences | Confidence |
|---|---|---|---|
| zeroMotifOverlap | 9.13x | 44/502 | High |
| heroInsufficientDetail | 7.44x | 112/502 | High |
| largeEmptyHole | 5.94x | 65/502 | High |
| weakHierarchy | 4.37x | 50/502 | High |

`gridAppearance`/`lowClusterCohesion`/`equalSpacingDetected` also show high
lift but with only 1-21 occurrences (below the 30-sample floor) — reported
as `Low` confidence, not treated as a finding worth acting on. This is the
evidence base for Section 12's Build 014 recommendation.

## Section 8 — Similarity and Duplicate Intelligence

`src/portfolio/fingerprint.ts` + `duplicates.ts`: comparison is bucketed to
`(styleDnaId, layoutId)` first (bounding the pairwise cost to ~830K
comparisons across the whole portfolio instead of a naive 12.5M), using real
Jaccard similarity over each tile's deduped shape-topology signature set
(`extractMotifShapeSignatures`, already computed by `svgGeometry.ts`) plus a
structural-field check (product/palette/zone/density-bucket/node-count-bucket
all match). Result across all 5,000 patterns:

- **Exact duplicates**: 0
- **Deterministic duplicates**: 0
- **Near duplicates**: 1

The deterministic seed generation is producing genuinely distinct output at
this scale — near-duplication is not a real problem this portfolio has.

## Section 9 — Portfolio Clustering

`src/portfolio/clustering.ts`: clusters are `(styleDnaId, layoutClass)`
segments split into top/mid/bottom thirds by measured `compositeRankScore`
(segments under 9 members kept as a single "mid" band rather than forced
into 3 uneven groups) — a deterministic, fully explainable segmentation
grounded in real declared attributes plus real measured performance, not an
opaque statistical cluster. 51 clusters total across the 5,000 patterns;
largest clusters are ~111-112 patterns each (Editorial Botanical, Luxury
Floral, Scandinavian Organic, Minimal Botanical organic/lattice mid tiers).

## Section 10 — Confidence Engine

`src/portfolio/confidence.ts`: per-tile confidence derives from how many
`low`/`medium`-confidence Build 012 penalty rules fired plus real instance
count; sample-level confidence requires ≥30 observations (else always `Low`)
and uses coefficient-of-variation ≤0.15 + ≥75% taxonomy coverage for `High`.
Portfolio-wide: **4,899 of 5,000 tiles (98%) rated `high` evaluator
confidence**, 101 `medium`, 0 `low`. Overall portfolio-level confidence:
**High** (CV 0.051 across all 5,000 composite scores, 100% preset coverage).

## Section 11-12 — Recommendation Engine + Single Build 014 Recommendation

`src/portfolio/recommendations.ts` never alters production code — it only
translates each pattern's own real `failureModes` into a human-readable
`recommendationTags` string, and separately ranks Section 7's failure-mode
findings to choose exactly one Build 014 recommendation:

> **Address `zeroMotifOverlap`**: allow controlled motif overlap for depth.
> Affects 44 patterns (0.9% of the portfolio), 9.13x lift in the bottom
> decile vs. portfolio-wide baseline, `High` confidence (44 samples, CV 0.04,
> 100% coverage). This is the highest-lift, high-confidence failure
> mechanism found across the full 5,000-pattern portfolio — Build 014 should
> target this specifically for the affected layout/style combinations,
> rather than a broad re-tune of every preset.

This recommendation is **not implemented** in this build, per the brief's
explicit constraint.

## Section 13 — Reality-Check Visual Artifacts

`scripts/portfolioVisuals.ts`: 60 patterns selected by fixed stride over the
manifest in original generation order — no sorting or filtering by any
quality signal before selection, so the sample cannot be curated. Each tile
re-rendered from its own real seed via the same `buildPortfolioParams`/
`buildTileWithHeroRetry` pipeline Section 4 used. Rendered to
`docs/build_reports/build_013_visuals/uncurated_contact_sheet.html`
(gitignored — 23MB of inline SVG, reproducible via
`npx tsx scripts/portfolioVisuals.ts`); a representative screenshot is
committed at `docs/build_reports/build_013_visuals/contact_sheet_preview.png`,
and the exact sampled pattern IDs/scores are committed in
`docs/build_reports/build_013_visuals/manifest.json`. Visual review confirms
the patterns render as expected for their declared style (e.g. Minimal
Botanical's sparse single-glyph grid, Scandinavian Organic's monochrome
scatter, Luxury Floral's dense bouquet clusters) — nothing broken or
degenerate in the sample.

## Section 14-15 — Performance/Resource Control + Testing

- Generation ran as a single foreground pass with checkpointing (no
  uncontrolled parallelism); the full `vitest run` suite was deliberately
  **not** run while generation was active, to avoid CPU contention between
  the two — run only after generation completed.
- 64 new unit tests across all 8 new `src/portfolio/*.ts` modules (baseline,
  fingerprint, confidence, ranking, successFailure, duplicates, clustering,
  recommendations), all passing.
- Full regression: **2,242 of 2,242 tests passing** (2,178 from Build 012 +
  64 new — zero regressions), `tsc -b` clean, `oxlint` clean.
- `npm run build` produces a byte-identical `/studio` (confirmed via `git
  status` showing no diff) — expected, since `src/portfolio/` is never
  imported by the UI bundle.

## Commercial Reality Questions

1. **Did Build 012's fix hold at commercial scale?** Yes — all 3 previously
   broken presets now score 77-80 mean ACQ-V2 across 333+ real seeds each,
   `High` confidence, inside the 75-88 healthy range shared by all 15
   presets.
2. **Is near-duplication a real risk for a stock-marketplace submission at
   this volume?** No — 0 exact/deterministic duplicates and 1 near-duplicate
   across 5,000 patterns.
3. **What's the single highest-value next fix?** `zeroMotifOverlap` — 9.13x
   lift in the bottom decile, `High` confidence, affecting 44 patterns.
4. **Are any presets under-confident in their own scoring?** `luxuryFloral`
   is the one preset with `medium` (not `high`) confidence (CV 0.248) — its
   scores vary more than the other 14, worth a closer look in a future build
   but not evidence of a bug on its own.
5. **How much of the portfolio is high-confidence, trustworthy data?** 98%
   of tiles (4,899/5,000) rate `high` evaluator confidence.
6. **Does any single preset need special-casing?** No — every preset falls
   inside one shared 75-88 healthy range.
7. **What traits correlate with top-decile success?** Strong style-fit
   quality (3.72x lift), `goldenRatio`/`cornerFlow` composition zones
   (3.66x/3.26x).
8. **What traits correlate with bottom-decile failure?** `zeroMotifOverlap`
   (9.13x), `heroInsufficientDetail` (7.44x), `largeEmptyHole` (5.94x),
   `weakHierarchy` (4.37x) — all `High` confidence.
9. **Is the recommendation evidence-based or a guess?** Evidence-based —
   ranked by real lift + sample-size-gated confidence from Section 7's own
   discovery pass, not chosen by inspection.
10. **Was any score inflated to make this report look better?** No — Build
    013 never touches `evaluate()`/`computeOverallScoreV2`/penalty rules;
    every number here is a read of Build 012's own already-shipped, already
    regression-tested evaluator.

## Final Acceptance Criteria

- [x] Audit complete (`BUILD_013_AUDIT.md`)
- [x] 5,000-pattern generation complete, deterministic, checkpointed
- [x] Ranking/percentiles computed
- [x] Success/failure pattern discovery with real lift + confidence
- [x] Similarity/duplicate detection, bucketed
- [x] Clustering, deterministic and explainable
- [x] Confidence engine, portfolio- and tile-level
- [x] Single, narrow, evidence-based Build 014 recommendation (not implemented)
- [x] Uncurated visual reality-check artifacts
- [x] No new generation engine, no scoring changes, no self-modifying code
- [x] Full regression: 2,242/2,242 tests, tsc clean, lint clean
- [x] Documentation updated (`ROADMAP.md`, `USER_GUIDE.md`)
- [x] Committed and pushed

## Final Status

- Audit: Complete
- 5,000-pattern evaluation: Complete
- Portfolio Intelligence (ranking/success/failure/clustering): Complete
- Similarity/duplicate analysis: Complete (0 exact, 0 deterministic, 1 near)
- Confidence Engine: Complete (98% high-confidence tiles, high portfolio confidence)
- Build 014 recommendation: Complete — address `zeroMotifOverlap`
- Tests: Complete — 2,242/2,242 passing
- Browser verification: Complete — contact sheet visually reviewed
- Documentation: Complete
- BUILD_013_REPORT.md: Complete
- Committed/pushed: Yes
- Ready for review: Yes
