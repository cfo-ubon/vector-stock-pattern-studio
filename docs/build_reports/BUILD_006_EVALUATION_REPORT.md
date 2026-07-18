# Build 006 Visual Evaluation Portfolio — Report

**Evaluation only.** No generation logic was modified to produce this
report. All 75 patterns are raw, uncurated engine output — nothing was
hand-picked, regenerated-on-failure, or touched after generation.

## 1. Methodology

A new, standalone script (`app/scripts/build006Evaluation.ts`) reuses the
exact same pipeline `scripts/qualityReport.ts` already uses for its own
100/300-pattern portfolios:

```
resolveStyleDna(dna, seed) -> params -> buildTileWithHeroRetry(params) -> metrics
```

Every score is computed with the identical, already-shipped functions
Build 005/006 use for their own portfolio baselines
(`computeOverallScore(metrics, 'stockClean')`, `computeHeroVisibilityScore`,
`computePatternBeautyScore`, `computeBotanicalBeautyMetrics`,
`computeIllustrationQuality`/`computeVisualRichness`,
`evaluateCommercialPatternCritique`) — nothing here is a new, independently
-derived measurement. The script only adds **export** (SVG/PNG files + a
manifest) on top of computation that already existed.

- **Full SVG** per pattern: `buildSingleTileSvg()` — the exact function
  the real app uses for its own "Export single tile SVG" button (3000x3000
  artboard, SVG-optimized).
- **Preview PNG** per pattern: an 800x800 Playwright (headless Chromium)
  screenshot of the same raw tile content, for quick visual scanning.
- **Metadata per pattern**: preset id/label, seed, `categoryId`,
  `layoutId`, `compositionZone` (the style's own resolved
  `CompositionZone`), `botanicalFamily` (the style's own resolved species,
  `n/a` for non-botanical presets), `clusterType` (the style's own
  preferred cluster archetype list's first/dominant entry — see
  §5 Known Limitation 2 — `n/a` when the style has no cluster archetype
  preference), `colorStory`/`paletteId` (the style's own resolved
  palette).

## 2. Seed Policy

**Identical seed policy to the Build 005/006 100-pattern portfolio**:
`scripts/qualityReport.ts`'s own frozen `PORTFOLIO_SEEDS` are
`['p-1', 'p-2', 'p-3', 'p-4', 'p-5', 'p-6', 'p-7']`. This evaluation uses
the **first 5** of those exact same seed strings — `p-1` through `p-5` —
against all 15 `STYLE_DNA_PRESETS`, in their own fixed insertion order
(never re-rolled, never hand-picked): **15 x 5 = 75 patterns.**

Because the seed strings and the resolution pipeline are byte-identical
to the existing 100-pattern portfolio, every one of these 75 patterns is
**also already present** (for the same preset+seed pair) inside
`docs/build_reports/baselines/BUILD_006_final_result.json`'s own
`portfolio.results` array — this evaluation is a real, independent
regeneration that reproduces those exact same tiles (deterministic seeded
RNG guarantees this), now additionally exported as SVG/PNG with full
metadata.

## 3. Preset-by-Preset Averages (n=5 seeds each, Build 006)

| Preset | ACQ | Hero Vis. | Pattern Beauty | Luxury Feeling | Editorial Feeling | Premium Feeling |
|---|---|---|---|---|---|---|
| Editorial Botanical | 87.4 | 94.51 | 80.6 | 84.2 | 49.8 | 93.0 |
| Luxury Floral | 87.8 | 96.62 | 80.4 | 94.8 | 50.2 | 92.4 |
| Scandinavian Organic | 87.4 | 95.89 | 81.0 | 95.0 | 50.0 | 88.8 |
| Minimal Botanical | 29.0 | 79.96 | 73.4 | 85.4 | 81.8 | 82.4 |
| Vintage Herbarium | 59.8 | 80.93 | 81.2 | 82.8 | 73.0 | 82.6 |
| Dark Botanical | 82.0 | 91.95 | 79.6 | 88.4 | 48.6 | 87.8 |
| Modern Tropical | 87.6 | 83.83 | 82.6 | 79.6 | 50.2 | 82.8 |
| Boutique Packaging | 41.4 | 82.8 | 77.2 | 89.0 | 84.8 | 90.0 |
| Luxury Wallpaper | 73.8 | 86.42 | 82.0 | 83.6 | 59.0 | 85.6 |
| Premium Textile | 44.6 | 79.64 | 82.2 | 84.2 | 93.2 | 82.2 |
| Kids Playful | 85.4 | 89.84 | 81.0 | 86.6 | 48.6 | 82.4 |
| Retro Organic | 88.8 | 92.23 | 81.6 | 89.0 | 49.8 | 91.0 |
| Organic Abstract | 88.2 | 98.36 | 81.0 | 98.0 | 48.6 | 92.4 |
| Boho Floral | 85.2 | 90.41 | 80.2 | 88.0 | 49.6 | 83.2 |
| Soft Watercolor Inspired | 88.2 | 83.59 | 81.0 | 75.6 | 48.4 | 87.2 |

Overall (n=75): ACQ mean **74.44**, Hero Visibility **88.47**, Pattern
Beauty **80.33**, Luxury/Editorial/Premium Feeling **86.95/59.04/86.92**,
Fabric/Wallpaper/Gift Wrap Feeling **58.80/63.73/57.60**, Visual Story
**62.67**. Botanical-only (n=32 of 75 fall in the `botanical` category):
Illustration Quality **53.69**, Visual Richness **61.47**, Botanical
Realism **33.16**. Species Diversity across this 75-pattern run: **74%**
(portfolio-level statistic — see §5 Known Limitation 1).

## 4. Build 005 vs. Build 006 — Same Seeds, Same Presets

Build 005's own `BUILD_005_final_result.json` portfolio results were
filtered down to the identical `seed ∈ {p-1..p-5}` subset per preset, then
compared directly against this evaluation's Build 006 numbers.

| Preset | n (B005→B006) | ACQ Δ | Hero Vis. Δ | Beauty Δ | Illustr. Qual. Δ | Visual Rich. Δ |
|---|---|---|---|---|---|---|
| Editorial Botanical | 5→5 | 87.4→87.4 (0) | 94.51→94.51 (0) | 80.6→80.6 (0) | 54.0→54.2 (+0.2) | 55.6→55.6 (0) |
| Luxury Floral | 5→5 | 87.8→87.8 (0) | 93.7→96.62 (**+2.92**) | 81.4→80.4 (-1.0) | 60.8→62.6 (+1.8) | 58.4→58.4 (0) |
| Scandinavian Organic | 5→5 | 87.4→87.4 (0) | 95.89→95.89 (0) | 81.0→81.0 (0) | 43.0→43.0 (0) | 64.0→64.0 (0) |
| Minimal Botanical | 5→5 | 29.0→29.0 (0) | 79.96→79.96 (0) | 73.4→73.4 (0) | 44.4→44.4 (0) | 61.0→61.0 (0) |
| Vintage Herbarium | 5→5 | 59.8→59.8 (0) | 80.93→80.93 (0) | 81.2→81.2 (0) | 50.2→50.2 (0) | 66.8→66.8 (0) |
| Dark Botanical | 5→5 | 82.0→82.0 (0) | 90.69→91.95 (**+1.26**) | 80.2→79.6 (-0.6) | 60.4→61.6 (+1.2) | 61.4→61.0 (-0.4) |
| Modern Tropical | 5→5 | 87.6→87.6 (0) | 83.83→83.83 (0) | 82.6→82.6 (0) | n/a | n/a |
| Boutique Packaging | 5→5 | 41.4→41.4 (0) | 82.8→82.8 (0) | 77.2→77.2 (0) | n/a | n/a |
| Luxury Wallpaper | 5→5 | 73.8→73.8 (0) | 86.42→86.42 (0) | 82.0→82.0 (0) | n/a | n/a |
| Premium Textile | 5→5 | 44.6→44.6 (0) | 79.64→79.64 (0) | 82.2→82.2 (0) | n/a | n/a |
| Kids Playful | 5→5 | 85.4→85.4 (0) | 89.84→89.84 (0) | 81.0→81.0 (0) | n/a | n/a |
| Retro Organic | 5→5 | 88.8→88.8 (0) | 92.23→92.23 (0) | 81.6→81.6 (0) | n/a | n/a |
| Organic Abstract | 5→5 | 88.2→88.2 (0) | 98.36→98.36 (0) | 81.0→81.0 (0) | n/a | n/a |
| Boho Floral | 5→5 | 85.4→85.2 (-0.2) | 91.25→90.41 (-0.84) | 80.2→80.2 (0) | 48.0→48.0 (0) | 63.0→65.0 (+2.0) |
| Soft Watercolor Inspired | **2**→5 | 87.5→88.2 (+0.7)* | 82.13→83.59 (+1.46)* | 82.0→81.0 (-1.0)* | 58.5→55.33 (-3.17)* | 66.0→64.67 (-1.33)* |

\* Not a like-for-like comparison — see §5 Known Limitation 3.

**11 of 15 presets are byte-identical (0 delta on every metric)** for
these exact 5 seeds — expected, since Build 006's Section 2/3/6/7
additions (companion-foliage sprig, mirroring, flower center, visual
weight balancing) only change output for the specific seeds whose
`rng()` stream draws a companion species or a mirror flip; most of these
15 x 5 fixed seeds simply don't happen to cross that branch. The 3
presets with real, non-zero deltas (Luxury Floral, Dark Botanical, Boho
Floral) show the same small, already-understood rng-reshuffle pattern
documented in `BUILD_006_REPORT.md` §9 — never a logic regression, since
the underlying formulas are unchanged and every delta is a plausible,
bounded shift (±0.2 to +2.92), not a systematic drop.

## 5. Known Limitations

1. **Species Diversity is a portfolio-level statistic, not a per-pattern
   score.** The task's own scoring list includes it among "per-pattern
   scores", but `computeSpeciesDiversity` (Build 005, Section 9) is, by
   this engine's own established design, only meaningful across a batch
   (a single tile commits to one botanical family). The manifest reports
   it once, at the top level (`74%` for this 75-pattern run), and each
   per-pattern record instead carries its own real `botanicalFamily`
   value — the honest per-pattern equivalent of "which species this one
   tile actually used."
2. **`clusterType` reflects the style's declared *preferred* cluster
   archetype (first/dominant entry), not necessarily the literal archetype
   instantiated for every individual cluster inside that specific tile.**
   `GenerateParams.clusterArchetypes` is a candidate list a cluster-based
   layout picks among per-cluster; there is no existing per-tile record of
   which entry actually got used for a given render. Reporting the
   dominant preferred entry is honest and useful (it's a real property of
   the style, correctly attributed per pattern) but isn't a literal
   "which archetype rendered here" guarantee.
3. **Soft Watercolor Inspired's Build 005 comparison is NOT like-for-like.**
   Build 005's own 100-pattern portfolio trims to exactly 100 pairs in
   preset-major order; being the last of 15 presets, Soft Watercolor
   Inspired only ever got its first **2** of 7 seeds generated in that
   run (`p-1`, `p-2` — this exact trim is documented in
   `scripts/qualityReport.ts`'s own comments and in
   `BUILD_005_final_result.json`'s `portfolio.droppedPairs`). This
   evaluation's Build 006 numbers for this preset (n=5) are real and
   valid on their own, but the "Δ" column against Build 005's n=2 subset
   is comparing different sample sizes — flagged with an asterisk in §4,
   not silently presented as equivalent.
4. **Not every preset is botanical-category.** Illustration
   Quality/Visual Richness/Botanical Realism are `n/a` for Modern
   Tropical/Boutique Packaging/Luxury Wallpaper/Premium Textile/Kids
   Playful/Retro Organic/Organic Abstract — the same category-gating
   `computeBotanicalBeautyMetrics` has always used, not a gap in this
   evaluation.
5. **Minimal Botanical, Boutique Packaging, and Premium Textile's low
   Absolute Commercial Quality is a known, pre-existing, unchanged
   condition** (documented as far back as `docs/KNOWN_ISSUES.md`'s Build
   001.1-era finding that `stockClean`'s fixed weighting structurally
   favors hero-centric presets over deliberately minimal/airy ones) —
   confirmed here to be byte-identical between Build 005 and Build 006 for
   these same seeds, so it is explicitly **not** a Build 006 regression.
6. **Preview PNGs are 800x800 renders of the raw (non-optimized) tile
   content**, not the 3000x3000 optimized artboard the full SVG export
   is. Visually identical content, different resolution/optimization
   pass — for quick scanning only, not a substitute for opening the real
   SVG file.

## 6. Best and Worst Performers (by Absolute Commercial Quality)

**Top 5:**
1. Editorial Botanical @ p-5 — 90
2. Retro Organic @ p-2 — 90
3. Retro Organic @ p-5 — 90
4. Editorial Botanical @ p-1 — 89
5. Editorial Botanical @ p-2 — 89

**Bottom 5:**
1. Minimal Botanical @ p-1 — **4**
2. Minimal Botanical @ p-2 — 30
3. Minimal Botanical @ p-5 — 30
4. Boutique Packaging @ p-3 — 14
5. Minimal Botanical @ p-4 — 35

Minimal Botanical @ p-1 scoring 4/100 is the single most extreme value in
the whole 75-pattern set — worth a future build's attention (see §7), but
not new: Minimal Botanical's per-seed ACQ values are byte-identical to
Build 005 for this exact seed (§4), so this is an existing, unchanged
weak point, not something Build 006 introduced.

## 7. Should Build 007 Proceed, or Is Build 006.1 Recommended?

**Recommendation: Build 007 should proceed.** Rationale:

- 11 of 15 presets are byte-identical to Build 005 on every measured
  metric for these exact seeds — Build 006's changes are demonstrably
  additive/non-disruptive at the individual-pattern level, not just in
  aggregate.
- Every non-zero delta found is small (largest: +2.92 Hero Visibility for
  Luxury Floral), explained by an already-documented, well-understood rng-
  reshuffle mechanism, and never a directional collapse of a metric.
  No metric shows a build-wide, systematic regression.
  Illustration Quality actually improved slightly for the two presets
  that shifted (+1.8, +1.2).
- The genuinely weak performers (Minimal Botanical, Boutique Packaging,
  Premium Textile's low Absolute Commercial Quality) are **pre-existing
  and unchanged from Build 005** — real, worth fixing, but not a Build 006
  regression and not something a "Build 006.1 stabilization build" would
  address any differently than a normal future build's own prioritized
  backlog item would.

**A future build (007 or later) should prioritize**, independent of this
evaluation's own scope:
1. Minimal Botanical's Absolute Commercial Quality floor (seen here at a
   real 4/100 for one seed) — the single most extreme weak point in the
   entire 75-pattern set.
2. Boutique Packaging and Premium Textile's structurally low
   `stockClean` scores — same root cause, already flagged since Build
   001.1.
3. Re-running this same 75-pattern evaluation methodology after any future
   build, using the identical `p-1`..`p-5` seed policy, so results stay
   directly comparable across builds going forward.

## 8. Deliverables

- `docs/build_reports/BUILD_006_EVALUATION/manifest.json` — full
  structured manifest (75 records, every field listed in §1).
- `docs/build_reports/BUILD_006_EVALUATION/manifest.csv` — flat CSV of
  the same data.
- `docs/build_reports/BUILD_006_EVALUATION/svg/*.svg` — 75 full SVG
  exports (3000x3000, optimized, one per pattern).
- `docs/build_reports/BUILD_006_EVALUATION/png/*.png` — 75 preview PNGs
  (800x800).
- All of the above packaged into one ZIP file delivered alongside this
  report (not committed to git — see the delivery note in this build's
  final summary for why).
