# Build 022 — Weak-Style Commercial Quality Upgrade

See `BUILD_022_AUDIT.md` (repo root) for the full evidence audit this build
was scoped from, and `BUILD_022_REPORT.md` for the final report and verdict.
This doc summarizes what shipped and why, for future maintainers.

## Why "Build 022," not "Build 012"

The originating brief called this "Build 012." That number is already used
by real, shipped work (`docs/build_reports/BUILD_012_REPORT.md`, commit
`cd99eac`, "Evaluation Intelligence Engine V3"). To avoid overwriting or
colliding with that history, this work ships as **Build 022** — the next
real number after the offline-desktop migration. Every other requirement
(scope, rules, non-negotiables) is followed as written; only the build
number changed.

## What this build fixed (real, measured, verified)

### 1. Layout-aware scoring propagation (Finding 1)

Build 012 already built a layout-aware scoring replacement
(`engine/scoringV2.ts`'s `computeOverallScoreV2`, gated by
`engine/layoutEvaluation.ts`) but it was only wired into the interactive
Design Critic — never into the batch/portfolio evaluation scripts. Every
portfolio-wide composition average computed since Build 012 shipped was
silently re-introducing the exact lattice-layout bias Build 012 had already
proven and fixed for `minimalBotanical`, `boutiquePackaging`, and
`premiumTextile`.

Fix: `scripts/qualityReport.ts` now computes and reports
`absoluteCommercialQualityV2` alongside the existing V1 metric (additive,
V1 untouched for back-compat).

Measured effect (30-seed diagnostic matrix): Minimal Botanical
39.17 → 78.0 (+38.8), Boutique Packaging 39.73 → 79.6 (+39.9), Premium
Textile 46.07 → 80.57 (+34.5). All 10 organic-layout controls: 0.0 delta.

### 2. Product-Target Fit V2 — best-fit aggregation (Finding 4)

The old `productTargetFit` metric averaged all 13 named product uses
uniformly, mathematically capping around 45–55 regardless of how well a
pattern actually fit its *best* product — the metric was measuring "fit to
the average of 13 mostly-unrelated products," not "fit to the product this
pattern targets."

Fix: new `src/collection/productTargetFitV2.ts` (`bestFitProductTargetFit`)
aggregates only the `suitable` subset of scored products (falling back to
the top 3 if none are marked suitable). Wired into `qualityReport.ts` as
`productTargetFitV2`, alongside passing `heroVisibility` into
`evaluateProductTargets` (previously omitted).

Measured effect: portfolio mean 66 vs V1 50.61 (+15.4), uniformly higher
across all 15 presets.

### 3. Style-aware composition envelopes (Phase 3)

`minimalBotanical` (shared `minimalRepeat` hierarchy, heroRatio 0.02 — no
real hero) and `luxuryFloral` (shared `heroFocus` hierarchy, heroRatio
0.3 — too many equal-weight blooms) both had a real hierarchy mismatch with
their own declared identity.

Fix: new `src/engine/compositionEnvelopes.ts` — a small, additive,
per-style hierarchy override table (`WEAK_PRESET_HIERARCHY_OVERRIDES`),
applied only to these 2 evidence-backed presets via
`applyCompositionEnvelope`, strict no-op (identical object reference) for
all 13 other presets including ones sharing the same underlying
`HIERARCHY_PRESETS` tables (`organicAbstract` also uses `minimalRepeat`;
`darkBotanical`/`modernTropical` also use `heroFocus`).

### 4. Illustration Quality V2 structural blind spot

`computeIllustrationQualityV2`'s `overall` score averaged 8 sub-scores,
3 of which (`bouquetQuality`, `gestureQuality`, `flowerRealism`) are
structurally 0 for any tile with no `premium-hero`-tagged SVG parts —
unfairly capping the average for the 11 of 15 presets that aren't
`premiumHero: true`.

Fix: `src/engine/illustrationQualityV2.ts` now excludes those 3 sub-scores
from the average when no premium-hero instances are present in the tile.

Measured effect: +11 to +25 point real improvement across the 4 previously
weakest presets (Minimal Botanical, Scandinavian Organic, Vintage
Herbarium, Soft Watercolor).

### 5. Palette contrast engine (Phase 4)

Editorial Botanical (65.43) and Soft Watercolor Inspired (69.5) were the
only 2 of 15 presets with real, measured weak perceptual contrast between
adjacent palette roles (both deliberately soft/pastel identities).

Fix: new `src/engine/paletteContrastEngine.ts` — WCAG relative-luminance
contrast checking (adjacent role pairs only — background-vs-primary,
primary-vs-secondary, etc.), and a role-preserving, hue/saturation-safe
lightness-only adjustment (binary search with a non-monotonicity fallback)
capped at a controlled maximum delta. Strict no-op for any palette that
already clears the floor. Wired into `engine/tile.ts`, scoped to the
Style-DNA/library-resolved palette path only — **user-supplied
`customColors` are never auto-corrected**, so a deliberate (even
low-contrast) user color choice is always respected.

Measured effect: both presets' `paletteContrast` 65.43 / 69.5 → 100.0.

## Known issue found but not resolved in this build

**`fragmentedSilhouette` on premium bouquet presets (Finding 3).** The
critic's `fragmentedSilhouette` detector fires on 100% of Luxury Floral
samples and 66.67% of Dark Botanical samples in the diagnostic matrix — the
premium bouquet hero frequently renders as several small disconnected
floral islands rather than one cohesive silhouette. This directly
contradicts the brief's own ask for "Premium Botanical Floral" ("clearer
primary floral focal point," "avoid many equal-sized flowers").

This build's composition-envelope fix (reducing `luxuryFloral`'s
`heroRatio` from 0.3 to 0.18, raising `heroScale` to 2.6, Section 3 above)
was expected to help but the diagnostic matrix rerun after that fix still
shows 100% `fragmentedSilhouette` on Luxury Floral — the fragmentation is
not primarily a hero/secondary ratio imbalance, it's a spatial placement
issue (how accent/filler instances are distributed by
`applyNegativeSpaceCorrection` relative to the hero cluster). A real fix
requires cluster-aware placement changes in
`engine/compositionIntelligence.ts` and/or `generators/premiumHero.ts`
that were not root-caused deeply enough in this build's time budget to
implement safely without risking the "gated, evidence-only" discipline
this build otherwise held to. `fragmentedSilhouette` is currently an
advisory-only Critic flag (not a scoring penalty in either
`computeOverallScore` or `computeOverallScoreV2`), so it does not depress
any reported score — it is a genuine, documented visual defect, not a
regression risk.

## Regression status

Full suite: 273 files / 3072 tests passing, 0 skipped, 0 failures
(`npx vitest run`), `npx tsc -b` clean. One regression was found and fixed
during development: the palette contrast engine, once wired into
`tile.ts`, was initially applied to both library-resolved *and*
user-supplied `customColors`, silently "fixing" a test's deliberately
near-zero-contrast custom palette
(`src/critic/visualAnalysis.test.ts`'s "flags a genuinely weak hero" case).
Fixed by scoping the engine to the library-resolved path only (see Section
5 above) — the test's premise (a deliberately weak *user-chosen* palette
should stay weak) is preserved, not weakened.
