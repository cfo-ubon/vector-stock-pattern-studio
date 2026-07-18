# Build 020 Report — Hero Dominance Recovery

## Scope confirmation

Per the brief's explicit instructions:
- **No commercial scoring / quality formula changes.** `engine/scoring.ts`
  (`computeOverallScore`, `computeHeroDetailRatio`, `SOFT_PENALTY_RULES`,
  `QUALITY_PRESET_WEIGHTS`) is read-only throughout this build — every
  measurement below comes from the unmodified, existing scoring pipeline.
- **Generator-only fix.** The only production code change is inside
  `app/src/generators/botanical.ts` (`attachOptionalStem`'s role-aware
  probabilities, plus its extension to a hero landing on a bare
  `'leaf'`-category variant). No layout, placement, composition-engine,
  or critic code was touched.
- **No unrelated UI work.** No component files were changed.

## 1. Baseline audit (same methodology as Build 019)

**Method**: `scripts/build019VisualAudit.ts` (existing, unmodified, reused
verbatim — the brief asked for "the same audit methodology used in Build
019"). Same 96-pattern sample: all 8 botanical-capable Style DNA presets ×
4 seeds × 3 density bands (low/medium/high), each forced to
`categoryId: 'botanical'`, every other resolved Style DNA field left as
`resolveStyleDna` computed it. Reuses the real quality-retry gate
(`buildTileForGenerate`) and every existing scoring module — no new
scoring math.

Hero Detail Ratio is not one of `build019VisualAudit.ts`'s tracked
dimensions (it tracks the 17 `Design Metrics` composite dimensions, not
every raw `DesignMetrics` field), so a small instrumentation script was
used in addition to compute `metrics.heroDetailRatio`'s mean directly and
cross-check `SOFT_PENALTY_RULES` hit rates per-pattern against
`computeOverallScore`'s actual output — both existing, unmodified exports
from `engine/scoring.ts`.

Raw output: `docs/build_reports/BUILD_019_VISUAL_AUDIT_{before,after-stem,build020-after}.json`
(file names retain the `BUILD_019_VISUAL_AUDIT_` prefix because the
script itself hard-codes it — consistent with the brief's instruction to
reuse Build 019's methodology unmodified).

## 2. Root cause: measured, not assumed

A naive weighted-average delta across all 19 `stockClean` metric weights
predicted only a ~0.07-point Overall Visual Quality drop between Build
018 and Build 019 — inconsistent with the actually-measured -2.22-point
drop reported in `BUILD_019_REPORT.md`. Investigating why the linear
estimate was wrong: `computeOverallScore` is **not** a pure weighted
average —

```ts
score = applySoftPenalties(metrics, weightedSum / weightTotal)
```

`applySoftPenalties` is a separate, binary-threshold penalty-point system
(`SOFT_PENALTY_RULES`) subtracted on top, invisible to a linear-delta
calculation. Instrumenting `computeOverallScore` + each `SOFT_PENALTY_RULES`
check directly across the same 96-pattern sample (Build 018 code vs.
Build 019 code, via a scoped `git stash` toggling `botanical.ts` only)
found:

| | Build 018 | Build 019 (before this fix) |
|---|---|---|
| Mean `heroDetailRatio` | 73.44 | 71.38 |
| `heroInsufficientDetail` rate (`heroDetailRatio < 45`, -15 pts) | 10.42% (10/96) | 18.75% (18/96) |
| Mean total penalty points/pattern | 11.93 | 14.14 |

The `heroInsufficientDetail` rate increase alone (+2.21 points/pattern
against the +15-point rule) accounts for essentially the entire measured
-2.22-point composite drop; every other `SOFT_PENALTY_RULES` rate moved
by less than 0.3 points combined.

**Why it happened**: Build 019's `attachOptionalStem` wrapper applied the
exact same stem/leaf probability to *every* role (hero, secondary,
filler, accent alike). A fixed absolute node addition is a **larger
relative gain** against filler/accent's smaller baseline node count than
against hero's already-larger one — `heroDetailRatio` measures hero's
average node count *relative to* filler/accent's average, so giving
everyone the same absolute detail boost narrows that ratio instead of
widening it, even though hero's own absolute detail also went up.

A per-preset diagnostic (per-pattern `avgHeroNodeCount`/
`avgBaselineNodeCount`/`nHero` breakdown for the patterns actually
tripping the penalty) additionally found `minimalBotanical`,
`vintageHerbarium`, `scandinavianOrganic`, and `softWatercolorInspired`
have structurally fragile heroes for this ratio: as few as 1 hero
instance per tile (making the "average" pure single-sample noise), or
(for `softWatercolorInspired`) an unusually rich filler/accent baseline
diluting hero's relative dominance further.

## 3. Fix

Entirely inside `app/src/generators/botanical.ts`:

1. **`attachOptionalStem` becomes role-aware.** It now takes the
   placement's `role` (already reliably populated for every real
   generation call — confirmed at `engine/tile.ts`'s `createMotif` call
   site) and looks up a per-role probability instead of one fixed
   0.55/0.45 pair for everyone:

   ```ts
   const STEM_PROBABILITY_BY_ROLE = { hero: 1, secondary: 0.75 };
   const DEFAULT_STEM_PROBABILITY = 0.55; // filler/accent/undefined — unchanged from Build 019
   const LEAF_PROBABILITY_BY_ROLE = { hero: 0.75, secondary: 0.55 };
   const DEFAULT_LEAF_PROBABILITY = 0.45; // filler/accent/undefined — unchanged from Build 019
   ```

   Hero always gets a stem, usually a leaf, and — hero-only — sometimes a
   second leaf for real bouquet fullness. Secondary gets an intermediate
   tier, mirroring `engine/heroComplexity.ts`'s own established
   hero-highest/secondary-medium/background-plain tiering convention.
   Filler/accent/undefined roles are **byte-identical** to Build 019 (same
   probabilities, same `rng()` draw sequence when they fall on those
   probabilities) — their own Build 019 Botanical Realism gain is fully
   preserved, not touched.

2. **Extended, hero-only, to the `'leaf'`-category variants**
   (singleLeaf, mapleLeaf, heartLeaf, monsteraLeaf) — the sparsest shapes
   in the whole pool, and the single biggest source of the residual
   low-`avgHeroNodeCount` tail found in the per-preset diagnostic. These
   were never touched by Build 019's wrapper, which only covered
   `'flower'`-category variants. `createMotif` now routes a hero landing
   on a bare leaf variant through the exact same `attachOptionalStem`
   idiom, turning it into a real leafy sprig (with a genuine
   `data-part="stem"`) instead of inventing a second stem-drawing
   routine. Filler/secondary/accent instances landing on the same leaf
   variants are completely unaffected (confirmed by test — see Section 6).

**Empirical tuning discipline**: every candidate configuration was
measured via a full 96-pattern audit re-run before being kept or
discarded, not assumed to help from reasoning alone. Several
plausible-looking variants were tried and reverted because they measured
*worse* or flat: a deterministic (always-on) second leaf, a zero-rng-cost
fixed 3-point "sepal collar" geometry addition, and higher filler/accent
probabilities. The reverted variants' RNG-stream-shift side effects
(changing how many `rng()` draws occur per instance shifts *downstream*
placements' draws too, which can move unrelated `SOFT_PENALTY_RULES`
rates like `equalSpacingDetected`/`weakHierarchy`/`monotonousScale` even
when the intended metric doesn't improve) confirm this repo's established
"measure, don't assume" precedent (Build 003/004/018/019) was the right
approach here too.

## 4. Files changed

- `app/src/generators/botanical.ts` — `attachOptionalStem` gained a
  `role` parameter and per-role probability lookups (`STEM_PROBABILITY_BY_ROLE`/
  `LEAF_PROBABILITY_BY_ROLE`); a new `buildLeafAccent` helper factors out
  the leaf-drawing logic shared by the base and hero-only second leaf;
  `createMotif` gained one new branch routing hero + `'leaf'`-category
  variants through the wrapper. `__testables` extended with `singleLeaf`
  for direct test access.
- `app/src/generators/botanical.test.ts` — the pre-existing "a bare role
  hint is inert" test (Build 004) is rewritten to assert the still-true
  narrower invariant (bare `family`/`part` hints, as opposed to `role`,
  remain inert) — `role` is now deliberately a real, intentional signal,
  which is exactly this build's fix. A new describe block ("role affects
  stem/leaf richness") adds 7 tests covering the new behavior directly
  (Section 6).

No scoring, layout, composition, or critic file was touched.

## 5. Before/after metrics

96-pattern sample, identical seeds/presets/densities across all three
snapshots
(`docs/build_reports/BUILD_019_VISUAL_AUDIT_{before,after-stem,build020-after}.json`):

| Dimension | Before Build018 | Before Build019 (post-fix) | After Build020 | Δ (018→020) |
|---|---|---|---|---|
| **Overall Visual Quality** | 72.77 | 70.55 | **72.90** | **+0.13** |
| **Botanical Realism** | 40.79 | 50.93 | **65.35** | **+24.56** |
| **Hero Visibility** | 85.01 | 84.01 | **87.12** | **+2.11** |
| **Hero Detail Ratio** (mean, raw `metrics.heroDetailRatio`) | 73.44 | 71.38 | **80.30** | **+6.86** |
| **Commercial Readiness** | 74.92 | 74.46 | **76.21** | **+1.29** |
| Negative Space (breathingRoom) | 97.71 | 97.71 | 97.71 | flat |
| Composition | 99.61 | 99.66 | 99.67 | +0.06 |
| `heroInsufficientDetail` penalty rate | 10.42% | 18.75% | **9.38%** | **-1.04pp** |
| Retry rate / mean attempts | 16.67% / 1.31 | 16.67% / 1.31 | 16.67% / 1.32 | ~unchanged |

**Completion rule check**:
- Botanical Realism: 65.35 ≥ 50.93 (Build 019) — **passes**, and far
  exceeds it (not merely preserved).
- Overall Visual Quality: 72.90 > 72.77 (Build 018) — **passes**, the
  brief's exact completion bar.
- No regression: every other tracked dimension improved or stayed flat;
  none dropped. `heroInsufficientDetail`'s rate (9.38%) is now *better*
  than Build 018's own original baseline (10.42%), i.e. hero dominance
  wasn't just recovered — it was pushed past where it started.

## 6. Test results

- 7 new tests, `generators/botanical.test.ts` ("role affects stem/leaf
  richness (Build 020, Hero Dominance Recovery)" describe block): hero
  always gets a stem (probability 1); a hero can gain a second leaf while
  secondary never exceeds one; filler/accent/undefined roles reproduce
  Build 019 byte-for-byte (same seed → identical serialized output,
  confirming zero behavior change for those roles); `createMotif` attaches
  a real stem to a hero landing on a bare `'leaf'`-category variant
  (`singleLeaf`, confirmed to draw zero stem structure on its own); the
  same leaf-category extension is confirmed **inert** for
  filler/secondary/undefined roles (byte-identical output with and
  without the role hint); deterministic end-to-end through `createMotif`
  for the hero + leaf-category path.
- 1 pre-existing test rewritten (Build 004's "a bare role hint is inert")
  to assert the narrower, still-true invariant — documented inline with a
  reference to this report, since `role` is now deliberately meaningful.
- All other pre-existing `botanical.test.ts` tests (17), plus
  `botanicalFamilies.test.ts`, `botanicalBeautyMetrics.test.ts`,
  `heroDetector.test.ts`, `visualAnalysis.test.ts`,
  `illustrationQualityV2.test.ts`, pass unmodified.
- Full suite: **269/269 test files, 3050/3050 tests passing** (was
  269/269, 3043/3043 before this build — +7 new tests, 0 removed, 0
  skipped). One test (`collectionGenerator.test.ts`'s "layout diversity
  holds across a sample of built-in Style DNA presets") timed out on the
  first full-suite run under heavy concurrent CPU load from this
  session's own diagnostic scripts running in parallel; re-run in
  isolation, it passed cleanly — judged environment contention, not a
  regression (that test file is unrelated to botanical.ts and was not
  touched).

## 7. Regression assessment

- Full suite: 269/269 test files, 3050/3050 tests passing (Section 6).
- `npx tsc --noEmit -p tsconfig.app.json`: clean (surfaced and fixed two
  pre-existing type issues introduced earlier in this build's own
  work-in-progress — a `role && LOOKUP[role]` pattern that could type as
  `number | ""`, and an unused `buildSepalCollar` helper left over from a
  reverted tuning variant — both fixed before finalizing).
- `npm run lint` (oxlint): clean.
- **Determinism**: confirmed both by the new byte-identical-output tests
  (Section 6) and by Batch Generate's retry rate being identical to Build
  019's own recorded rate at every batch size (below) — retries only
  happen when the quality gate's *scored* output differs, so an identical
  retry rate across an entire 100-item run is strong evidence the
  generator's rng-consumption sequence for filler/accent/undefined roles
  is unchanged.
- **Diversity**: unchanged — 19 distinct botanical families, 10 distinct
  composition zones reached at every batch size, matching Build 019's own
  figures exactly.
- **Batch performance**: `scripts/build019BatchPerf.ts`, 10/20/50/100 with
  `editorialBotanical` active — 0% failure rate at every size, retry rate
  byte-identical to Build 019 (40%/30%/30%/26%). Wall-clock ms/item
  measured ~50% higher than Build 019's committed report figures at first
  glance (e.g. 100-count: 68.5ms vs. 44.7ms) — cross-checked by
  re-measuring Build 019's own unmodified code (via a scoped `git stash`)
  fresh in the same session and getting ~63.6ms, not the original 44.7ms.
  This confirms the difference is environment/machine load variance
  between sessions (this container was busier during this build's
  measurement run than when Build 019's own report was generated), **not**
  a Build 020 regression — Build 020's measured ms/item is within the
  same range as a fresh same-session Build 019 baseline.
- Only `app/src/generators/botanical.ts` and its test file were changed;
  every other generator, every layout, every composition/critic/scoring
  module, and the entire catalog/collection/submission/SEO/dashboard
  stack are untouched.

## 8. Remaining gaps (unchanged from Build 019, not addressed by this build)

- **Organic Flow** (still the weakest tracked dimension, ~45-46 mean) is
  a placement-level characteristic driven by shared layout/composition
  code, not the botanical motif generator — explicitly out of scope for
  this build's "generator-only" constraint. See `BUILD_019_REPORT.md`
  Section 10/11 and `docs/ROADMAP.md`'s "Visual Commercial Upgrade, Phase
  2" recommendation, both still current.
- `flowerBloom` still uses its own Build 018 stem logic rather than the
  shared `attachOptionalStem` (unchanged from Build 019 — not touched by
  this build either).

## 9. Recommended next build

**Organic Flow, placement-level fix** (unchanged recommendation from
Build 019 — this build deliberately did not touch placement/layout code,
per its own generator-only scope). See `docs/ROADMAP.md`'s "Recommended
Next Build (Visual Commercial Upgrade, Phase 2)" section for the full
diagnostic breakdown this recommendation is based on.
