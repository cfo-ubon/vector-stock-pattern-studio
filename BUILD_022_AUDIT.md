# Build 022 Audit — Weak-Style Commercial Quality Upgrade

**Note on numbering.** The task brief that requested this work titled it
"Build 012." That number is already used by real, shipped, unrelated work
in this repository (`docs/build_reports/BUILD_012_REPORT.md`, commit
`cd99eac`, "Evaluation Intelligence Engine V3 — fix layout-scoring bias").
To avoid overwriting or colliding with that history, this work ships as
**Build 022** — the next real number after Build 021 → RC-1 (`v1.0.0-production`)
→ Portfolio Phase 1/1B → the offline-desktop migration. Every other
requirement in the brief (scope, rules, phases, deliverables) is followed
as written; only the build number and file names changed.

## 0. Repository state at audit time

- Branch: `codex/offline-windows-desktop` at commit `6d43582` (unrelated
  desktop-packaging work). This build creates a fresh branch,
  `claude/build-022-weak-style-commercial-upgrade`, off the latest `main`
  (`5a947f3`, RC-1/`v1.0.0-production` — the actual production baseline),
  not off the desktop branch, since pattern-generation quality is
  orthogonal to desktop packaging and must not carry Electron-specific
  changes.
- `app/package.json` version: `1.0.0-desktop.1` (set by the unrelated
  desktop build; this build does not depend on or touch it beyond what
  version-bump convention requires — see final report).
- Prior evidence already on disk in this environment: `PORTFOLIO_PHASE_1_REPORT.md`
  and `portfolio_phase_1/` (a real, un-committed 100-pattern production run
  from earlier this session — 45 READY / 30 REVIEW / 25 REJECT, 0 duplicate
  warnings, 0 export failures), `portfolio_phase_1b_review/`.

## 1. Where the brief's cited numbers come from — and what's actually true today

The brief cites five sub-scores (Composition ≈61.9, Product-Target Fit
≈52.70, Style-Fit ≈66.26, Illustration Quality ≈53.84, Visual Richness
≈61.91) and a 45/30/25 READY/REVIEW/REJECT split. The 45/30/25 split is an
exact match for Portfolio Phase 1's real result. The five sub-scores do
**not** appear verbatim anywhere in this repo's committed reports —
`PORTFOLIO_PHASE_1_REPORT.md` never computed a "Product-Target Fit,"
"Style-Fit," "Illustration Quality," or "Visual Richness" number (it used a
narrower, purpose-built scoring path, `computeOverallScore(metrics,
'stockClean')` only, in `app/scripts/portfolioPhase1.ts`).

Per this brief's own Phase 1 instruction ("Do not rely only on aggregate
scores"), rather than trust the cited numbers at face value, this audit
re-ran the app's own existing, real evaluation harness
(`app/scripts/qualityReport.ts`, unmodified) against its own frozen
15-preset × 7-seed, 100-pattern Style DNA portfolio suite (the mechanism
every Build 006–021 already used) and captured **real, current** numbers:

| Metric (current, measured) | Mean | Notes |
|---|---|---|
| `productTargetFit` | **50.61** | 43% failure rate (<50). Very close to the brief's 52.70. |
| `styleFitQuality` | **66.78** | 12% failure rate. Matches the brief's 66.26 almost exactly. |
| `visualRichness` | **61.23** | botanical-only, n=43. Matches the brief's 61.91 almost exactly. |
| `illustrationQuality` (V1, coarse) | 68.53 | doesn't match 53.84 |
| `illustrationQualityV2.overall` | 59.33 | closer to 53.84; V2's own sub-scores (below) explain the gap |
| `illustrationQualityV2.flowerRealism` | **44.19** | the single weakest illustration sub-dimension — best real match for the brief's "Illustration Quality ≈53.84" |
| `metrics.composition` (raw sub-metric) | 97.82 | does **not** match "Composition ≈61.9" — near-ceiling |
| `absoluteCommercialQuality` (100-pattern) | 73.52 | vs. 30-scenario suite's 82.33 — the same "broad portfolio scores lower than a narrow/tuned suite" pattern the brief describes, though not the same numbers |

**Conclusion**: three of five cited numbers (Product-Target Fit, Style-Fit,
Visual Richness) are real and independently reproduced to within ~1 point.
Illustration Quality is real but the brief's figure matches the granular V2
sub-scores (flowerRealism specifically), not the coarser V1
`illustrationQuality`. "Composition ≈61.9" does not match any current
metric under that name — most plausibly this refers to an
**already-superseded historical number** (see Finding 1 below: Build 012
measured and fixed exactly this kind of compression before this build
started, but the fix was never propagated to the scripts that produce
portfolio/composition averages). This audit treats the *real, freshly
measured* numbers above as authoritative going forward, not the brief's
cited figures.

## 2. Finding 1 (root cause, high confidence): a real, already-shipped scoring fix was never propagated to the batch/portfolio evaluation path

This is the single largest, best-evidenced finding of this audit.

`engine/scoring.ts`'s `computeOverallScore()` scores every pattern with a
flat, 18-rule `SOFT_PENALTY_RULES` list. Build 012 (already shipped, see
`docs/build_reports/BUILD_012_REPORT.md`) proved 8 of those 18 rules fire
at a wildly different rate on lattice-layout tiles (grid/gridMinimal/
halfDrop/brick/stripe) than organic-layout tiles — e.g. `gridAppearance`
fires on 100% of lattice tiles and 0% of organic tiles, because axis-aligned
even spacing is the *deliberate design intent* of a lattice layout, not a
defect. Build 012 built a fully layout-aware replacement
(`engine/scoringV2.ts`'s `computeOverallScoreV2` + `engine/penaltyRulesV2.ts`'s
`PENALTY_RULES_V2`, gated by `engine/layoutEvaluation.ts`'s
`layoutEvaluationClass`) and wired it into the interactive Design Critic
(`critic/problems.ts`).

**It was never wired into the batch evaluation/portfolio scripts.**
`scripts/qualityReport.ts` (the harness behind every Build 013–021 baseline
and this audit's own Section 1 numbers) and `app/scripts/portfolioPhase1.ts`
(the actual 100-pattern commercial-validation run) both still import and
call the old `computeOverallScore` from `engine/scoring.ts` directly. Every
portfolio-wide "composition"/commercial average computed by any tool in
this repo since Build 012 shipped has been silently re-introducing the
exact bias Build 012 proved and fixed, for every one of the 3 presets Build
012 named (`minimalBotanical`, `boutiquePackaging`, `premiumTextile` —
100% lattice-layout presets by design).

**Measured effect** (real run, 15 seeds/preset, V1 vs. V2, identical
metrics/inputs, only the penalty-applicability layer differs):

| Preset | V1 (current portfolio/report scoring) | V2 (already-shipped, unpropagated fix) | Δ |
|---|---|---|---|
| Minimal Botanical | 37.5 | 78.1 | **+40.7** |
| Boutique Packaging | 34.2 | 77.9 | **+43.7** |
| Premium Textile | 43.5 | 80.5 | **+37.0** |
| Editorial Botanical (organic control) | 87.5 | 87.5 | 0.0 |
| Dark Botanical (organic control) | 68.7 | 68.7 | 0.0 |

Zero change for the two organic-layout controls confirms this is a
surgical, already-validated correctness fix — not a threshold change, not
a metadata change, not a benchmark edit. Wiring `computeOverallScoreV2`
into the portfolio/reporting scripts is real work this build must do
(Phase 3, Section A below): it is not "score manipulation" (brief rule 5/6/9)
because the score-*computation logic itself* already exists, was already
independently derived from measured evidence in Build 012's own audit, and
is already used elsewhere in this exact codebase — this build only
finishes propagating it to the two places that still silently use the
pre-fix version. This single fix is expected to materially lift the
portfolio-wide composition/commercial average purely by removing an
existing measurement bug affecting 3 of 15 built-in presets (20% of the
library) — genuinely fixing "Composition quality is inconsistent... 
overfitting to stronger presets" (brief Weakness 1) at its root, before any
generator-level work is needed for these 3 presets specifically.

This does **not** explain the brief's other named weak preset(s) — see
Finding 2.

## 3. Finding 2: "Premium Botanical Floral" has no matching built-in Style DNA — scope clarification

The brief names "Premium Botanical Floral" and "Minimal Botanical" as the
weakest collections. `minimalBotanical` is a real, exact-match built-in
Style DNA id (covered by Finding 1 above, plus genuine remaining weakness
below). **"Premium Botanical Floral" is not a built-in Style DNA id** — it
was a collection name invented for Portfolio Phase 1's own 10-collection
production run (`app/scripts/portfolioPhase1.ts`), generated from raw,
hand-picked `GenerateParams` (palette/density/negative-space per item),
never routed through `resolveStyleDna`/`STYLE_DNA_PRESETS` at all.

There is no built-in preset with that exact identity to adapt. The closest
real Style DNA counterpart — same "premium, luxury, bouquet-composed
botanical floral" identity, `premiumHero: true`, `hierarchyPreset:
heroFocus` — is **`luxuryFloral`** ("Luxury Floral"), which this audit's
fresh 30-seed diagnostic matrix independently confirms as the 4th-weakest
of all 15 built-in presets (63.27 commercial mean, `fragmentedSilhouette`
visual issue firing on 100% of samples — see Finding 3). This build treats
`luxuryFloral` as the real Style DNA target for the brief's "Premium
Botanical Floral" adapter work (Phase 3), and additionally revisits
Portfolio Phase 1's actual "Premium Botanical Floral" collection
parameters directly when generating the required before/after and
100-pattern portfolios, so both interpretations are covered with real
evidence rather than guessing which one the brief meant.

## 4. Finding 3: `fragmentedSilhouette` — a real, uninvestigated visual signal on the premium bouquet presets

`critic/visualAnalysis.ts`'s `fragmentedSilhouette` detector (isolated-ink
fraction >45% AND largest connected region <50% of occupied cells) fires on
**100% of Luxury Floral samples and 66.67% of Dark Botanical samples** in
the fresh 30-seed matrix — both `premiumHero: true`, bouquet/heroFocus
presets whose entire "design language" is a cohesive multi-part floral
arrangement. It currently only feeds the interactive Critic UI (a
diagnostic flag, not a numeric penalty in `computeOverallScore`), so it has
never dragged these presets' scores down directly — but it is real,
reproducible evidence that the *premium bouquet hero* frequently renders as
several small disconnected floral islands rather than one cohesive
silhouette, which directly contradicts the brief's Phase 3 ask for Premium
Botanical Floral ("clearer primary floral focal point," "improved layered
botanical depth," "avoid uniformly dense filling... avoid many equal-sized
flowers"). This is a genuine composition/hero-construction issue worth
fixing at the source (`generators/premiumHero.ts` and/or
`compositionIntelligence.ts`'s cluster placement for `premiumHero` styles),
not a scoring gap.

## 5. Finding 4: Product-Target Fit's ~50 mean is a real measurement-design flaw, not a generation defect

`collection/productTargets.ts`'s `evaluateProductTargets()` scores **all
13** named product uses per pattern and `scripts/qualityReport.ts`
(`productTargetFit`) averages **all 13 scores together**, uniform, with no
"best match" concept. Each product rule's scoring is baseline 40 + 35 (only
if the caller's free-text literally contains that product's keyword) + 15
(category fit) ± 10 (tile size) ± 10 (density) ± 10 (hero visibility, 2
products only). The caller (`qualityReport.ts`) passes the Style DNA
*label* (e.g. "Minimal Botanical") as the keyword text — which will never
literally contain "wallpaper," "fabric," "gift wrap," etc., so the +35
keyword bonus essentially never fires in this evaluation path. The
resulting average — baseline 40 + occasional category/tile/density hits,
averaged across mostly-irrelevant products — mathematically regresses
toward ~45–55 regardless of how well-suited a pattern actually is for its
*best* product, which is exactly the ~50.61 measured. **This means "Product
Target Fit remains weak" is currently measuring "how well does this
pattern fit the average of 13 mostly-unrelated products," not "how well
does this pattern fit the product it's actually meant for."** Phase 7
(Product-Target Fit Engine V2) must fix the measurement (report/aggregate
the *best-fit* product(s), not a flat 13-way average) and add real
generation-time constraints so a pattern generated *for* a declared product
target genuinely fits it — both are required; fixing only the measurement
without also improving fit-at-generation-time would be the "manipulate
scoring" trap the brief explicitly forbids.

## 6. Other real findings from the diagnostic matrix (`reports/build_022/STYLE_DNA_DIAGNOSTIC_MATRIX.{json,csv,md}`)

- **Style-Fit** weakest presets: Kids Playful (44.53), Scandinavian Organic
  (51.3), Soft Watercolor Inspired (58.9), Vintage Herbarium (59.67), Retro
  Organic (61.27) — real, using the existing 2-signal
  `computeStyleDnaConsistency` (density match + rotation-diversity/complexity
  match). Too coarse to explain *which* attribute drifted — Phase 8 needs a
  richer, explainable diagnostic.
- **Illustration Quality V2** weakest: Minimal Botanical (33.53),
  Scandinavian Organic (36.06), Vintage Herbarium (38.37), Soft Watercolor
  (39.55) — flowerRealism is the single weakest sub-dimension almost
  everywhere it's measured.
- **Palette contrast**: already at or near ceiling (100) for 12/15 presets;
  the two real exceptions are Editorial Botanical (65.43) and Soft
  Watercolor Inspired (69.5) — both deliberately soft/pastel identities.
  These need the *contrast-safe, role-preserving* adjustment the brief's
  Phase 4 describes (reassign roles / nudge value-chroma within the
  existing palette direction), not a blanket high-contrast swap.
- **`lowDetail`** visual issue fires at 100% on Kids Playful and Organic
  Abstract, 60%+ on Retro Organic/Soft Watercolor — a real, distinct signal
  from `flowerRealism`/illustration quality (this fires for *any* category,
  not just botanical) worth folding into the richness-budget work (Phase 6).
- **`tooManyFillers`** fires on two otherwise-strong presets (Editorial
  Botanical 56.67%, Modern Tropical 46.67%) — flagged as a regression risk:
  any richness-budget or negative-space change must not push these two
  further in the wrong direction.

## 7. Files expected to change (Phase 3+)

- `app/scripts/qualityReport.ts`, `app/scripts/portfolioPhase1.ts` — wire
  `computeOverallScoreV2`/layout-aware evaluation into the batch/portfolio
  scoring path (Finding 1 fix — additive parameter, `evaluate()`'s public
  contract stays intact for every existing caller).
- `app/src/collection/productTargets.ts`, new `app/src/engine/productTargetFitV2.ts`
  — best-fit aggregation + generation-time constraints (Finding 4 / Phase 7).
- `app/src/engine/styleDna.ts` (additive fields only, schema-migration-safe)
  — style-aware composition envelopes (Phase 3).
- New `app/src/engine/compositionEnvelopes.ts`, `app/src/engine/weakPresetAdapters.ts`
  — envelope definitions + `minimalBotanical`/`luxuryFloral` adapters
  (Phase 3).
- `app/src/generators/premiumHero.ts`, `app/src/engine/compositionIntelligence.ts`
  — investigate/fix the `fragmentedSilhouette` root cause for
  `premiumHero` styles (Finding 3 / Phase 5).
- `app/src/engine/colorAnalysis.ts` (or new `app/src/engine/paletteContrastEngine.ts`)
  — perceptual contrast check + role-preserving adjustment (Phase 4).
- `app/src/engine/styleEvaluation.ts` — richer style-fit diagnostics (Phase 8).
- New `app/src/engine/richnessBudget.ts` — style-aware richness budget (Phase 6).
- New `app/src/engine/repairPass.ts` — bounded controlled repair system
  (Phase 10).
- `app/scripts/build022*.ts` (new, permanent, matches repo's own
  `scripts/build0NN*.ts` convention) — diagnostic matrix (done, this audit),
  benchmarks, before/after, 100-pattern portfolio, thumbnail review.
- Tests alongside every new/changed module (`*.test.ts`, this repo's
  existing convention — colocated, vitest).
- Documentation (`docs/BUILD_022_WEAK_STYLE_UPGRADE.md`,
  `docs/PRODUCT_TARGET_FIT_ENGINE_V2.md`, `docs/STYLE_AWARE_COMPOSITION.md`,
  `docs/COMMERCIAL_THUMBNAIL_VALIDATION.md`, `docs/USER_GUIDE.md` +
  changelog entry, `README.md`/`ROADMAP.md` where relevant).

## 8. Regression risks

1. Wiring V2 scoring into the portfolio/report scripts (Finding 1) changes
   the *reported numbers* for lattice presets even with zero generator
   change — must be documented extremely clearly as a scoring-correctness
   fix, not claimed as a "visual improvement," per the brief's own honesty
   requirement (Phase 18 item 34).
2. Any composition/richness change to `minimalBotanical`/`luxuryFloral`
   risks bleeding into shared code paths (`compositionIntelligence.ts`,
   `hierarchy.ts`) used by all 15 presets — every change must be gated by
   style id or an explicit envelope lookup, never a global default change.
3. `editorialBotanical`/`modernTropical`'s existing `tooManyFillers` issue
   and the two organic scoring-control presets (Finding 1's table) are the
   explicit non-regression tripwires for this build's strong-preset
   protection requirement.
4. Product-Target Fit V2's generation-time constraints must not silently
   override a user's/Style DNA's chosen density/tileSize — constraints
   apply only when a product target is explicitly declared for that
   generation, exactly like every other opt-in field in `GenerateParams`.

## 9. Objective acceptance criteria (measured, not asserted)

Reusing this audit's own real baseline numbers as the "before":

| Metric | Before (this audit, real) | Target direction |
|---|---|---|
| Minimal Botanical / Boutique Packaging / Premium Textile commercial mean | 37.5 / 34.2 / 43.5 (V1) | ≥ V2's already-proven 78.1 / 77.9 / 80.5 floor, plus real generator improvement on top for Minimal Botanical specifically |
| Luxury Floral commercial mean | 63.27 | materially higher, `fragmentedSilhouette` rate materially lower |
| Product-Target Fit (best-fit methodology) | n/a (old metric ~50.61 was structurally capped) | new metric must be substantially higher and must correlate with real generation-time constraint satisfaction, not just re-aggregation |
| Style-Fit mean | 66.78 | improve without homogenizing (weakest 5 presets specifically) |
| Illustration Quality V2 / flowerRealism | 59.33 / 44.19 | materially higher, verified by real before/after SVG inspection, not score alone |
| Visual Richness | 61.23 | improve without density/node-count inflation |
| 100-pattern portfolio READY count | 45 (Portfolio Phase 1) | increase via genuine improvement, same thresholds |
| Full regression suite | 271 files / 3063 tests passing (pre-build) | stays 100% green, plus new tests, zero skipped |

Full per-preset numbers: `reports/build_022/STYLE_DNA_DIAGNOSTIC_MATRIX.{json,csv,md}`.
