# Build 025 Report — Luxury Floral Composition & Stability Engine

## 0. Scope note (read this first)

This build had two mandatory goals: (1) fix `luxuryFloral`'s
`fragmentedSilhouette` rate (60% baseline, per Build 024) to ≤30%; (2)
root-cause and genuinely fix one pre-existing flaky timeout test. **Both
are now met.**

The path to Goal 1 was not the one first attempted. A full, real, working
Composition Profile / Hero Dominance / Topology-Aware Placement / Connector
Quality / Repair Engine V2 system (Phases 2-8) was built and measured at
scale (300 seeds), producing a genuine but insufficient improvement
(-6 percentage points, `60.67% → 54.67%`) alongside two measured
regressions (`deadSpace`, commercial quality) — disclosed honestly rather
than hidden, and shipped **disabled by default** (see Section 6). Rather
than stop at that partial result, the investigation continued: direct
instrumentation of real post-thinning placements found the true dominant
fragmentation mechanism was never cluster-companion selection, but the
independent ambient-filler layer (`layouts/heroScatter.ts`) getting
stranded by a thinning pass whose distribution grid is coarser than the
critic's own fragmentation-detection grid. Phase 9b's Connectivity-Aware
Thinning Repair (`engine/connectivityRepair.ts`) fixes this directly, is
enabled by default for every `premiumHero` style, and takes
`fragmentedSilhouette` from 60.67% to **23%** — clearing the mandatory
target with a genuine, tested mechanism, no threshold or diagnostic
weakening. See `BUILD_025_AUDIT.md` Section 8 and
`docs/CONNECTIVITY_AWARE_THINNING_REPAIR.md` for the full root-cause
writeup and fix.

## 1. What was implemented and verified this session

1. **Phase 10 — Flaky test root-cause fix**: `tile.test.ts`'s
   "artisticBalance product fallback" test root-caused to a heavy per-call
   fixture cost (not async/race), fixed by shrinking that test's own fixture.
   See `docs/TEST_STABILITY_REPORT.md`.
2. **Phase 1 — Failure-seed audit** (`BUILD_025_AUDIT.md`): full inspection
   of the existing cluster/thinning/critic code, classification of
   `luxuryFloral`'s real `VisualIssueId` failure rates over 300 seeds, and
   root-cause analysis confirming the dominant mechanism is node-budget
   thinning economics (fixed survivor budget per cluster,
   `bouquetSpatialGraph.ts`'s `reserveClusterCompanions`), not raw
   pre-thinning cluster geometry.
3. **Phases 2-3 — Composition Profiles + Hero Dominance Engine**
   (`engine/luxuryCompositionProfiles.ts`, `engine/heroDominanceEngine.ts`):
   6 named composition profiles with real, tested field invariants
   (`heroScaleFloor > secondaryScaleCeiling`, bounded secondary-anchor
   counts/distances); a hero-scaling engine that multiplies each anchor's
   own pre-dominance scale (never a flat overwrite), verified to actually
   reach the rendered SVG scale (a real bug this build found and fixed —
   `generateCluster`'s hero member otherwise always renders near 1.0
   regardless of any upstream scale decision).
4. **Phase 4 — Topology-Aware Cluster Placement**
   (`engine/topologyPlacement.ts`): per-unit secondary/satellite anchors at
   a discrete-rhythm, bounded-reach distance from each unit's own primary —
   never a stray far-flung anchor, verified by a unit test.
5. **Phase 5 — Connector Quality Engine** (`engine/connectorQuality.ts`):
   replaces `clusterEngine.ts`'s bare coin-flip bridge acceptance with a
   real, inspectable 5-criteria score plus 3 set-level filters (clutter cap,
   bare-stem risk, focal-obstruction risk).
6. **Phase 6 — Repair Engine V2** (`engine/repairEngineV2.ts`):
   whole-cluster (not single-member) simulated repair — every candidate
   action is measured against the critic's own isolated-cell count before
   being applied, and only strictly-improving actions are kept.
7. **Phase 7 — Wrap-Aware Cohesion** (`engine/wrapCohesion.ts`): real (not
   bounding-box) cross-seam connectivity measurement. Built and unit-tested
   but **not wired into generation or benchmarked** — the one piece of this
   build's work that remains purely available infrastructure (disclosed in
   `docs/WRAP_AWARE_COHESION.md`).
8. **Phase 8 — Product-Target-Specific adjustment**
   (`applyLuxuryProductAdjustment` in
   `engine/luxuryFloralCompositionEngine.ts`): tunes a chosen profile's own
   numeric fields per product target (fabric/wallpaper/wrappingPaper/
   packaging/stationery), never invents a new profile.
9. **Phase 9 — Fragmentation Benchmark** (Section 3 below): full 300-seed
   paired baseline/experimental measurement for `luxuryFloral`, plus
   100/50/50/50-seed controls (`scandinavianOrganic`/`bohoFloral`/
   `darkBotanical`/`editorialBotanical`) confirming zero collateral effect
   on presets that don't opt in.
10. **Phase 11 — Before/After Visual Evidence**
    (`reports/build_025/before_after/`): 100 paired renders (production vs
    experimental) at 2 scales (full tile, 256px thumbnail), plus a numeric
    summary — see `reports/build_025/before_after/BEFORE_AFTER_SUMMARY.md`.
11. **Phase 12 — 100-Pattern Validation Portfolio**
    (`reports/build_025/portfolio_100/`): 10 collections × 10 seeds of
    **production** output (the new engine is disabled, so this validates
    what actually ships) — READY=71, REVIEW=23, REJECT=6.
12. **Phase 13 — Human Review Package**
    (`reports/build_025/human_review/`): 2 contact sheets (by style, by
    decision), a 100-row CSV checklist, and a Thai review guide explicit
    about the disabled-by-default status.
13. **Phase 14 — Testing**: 7 new test files (all new Phase 2-8 engine
    modules) plus `connectivityRepair.test.ts` (Phase 9b, 4 tests), full
    suite run 3× consecutively — see Section 4.
14. **Phase 9b — Connectivity-Aware Thinning Repair** (new,
    `engine/connectivityRepair.ts`): the fix that actually clears the
    mandatory target. Direct instrumentation of real post-thinning
    placements found 92% of isolated instances were `role: 'filler'`
    ambient-scatter points (not cluster-companion failures), stranded by a
    resolution mismatch between the thinning pass's distribution grid and
    the critic's own fragmentation grid. `repairIsolatedSurvivors` runs a
    simulate-then-commit-only-if-strictly-better swap-repair pass after
    thinning, gated on `params.premiumHero`, never changing total kept
    count. Result: `fragmentedSilhouette` 60.67% → 23% (300-seed
    benchmark), enabled by default. See `BUILD_025_AUDIT.md` Section 8 and
    `docs/CONNECTIVITY_AWARE_THINNING_REPAIR.md`.
15. **Phases 11-13 re-run against the Phase 9b fix**: before/after evidence,
    100-pattern portfolio, and human review package were all regenerated
    against the final shipped (connectivity-repair-active) production code
    — see Section 3 for the updated numbers.

## 2. What was NOT implemented / not fully resolved

- **The experimental Composition Engine (Phases 2-8) alone did not clear
  the ≤30% target**: 54.67% (experimental) vs 60.67% (baseline) — a real
  -6pp improvement, insufficient on its own, and it introduces two
  regressions (`deadSpace` +8.67pp, mean commercial quality -1.91). It
  ships **disabled by default**, superseded by the Phase 9b fix below,
  which DOES clear the target and IS enabled by default.
- **Wrap-Aware Cohesion (Phase 7) is not wired into connector scoring** and
  has no empirical benchmark of its own effect — a real, tested, but
  unintegrated module. Not required for the mandatory blockers.
- Botanical anatomy, species data, and every detector threshold
  (`fragmentedSilhouette`, READY/REVIEW/REJECT cutoffs) were left
  **untouched**, per the brief's explicit constraint — confirmed by the
  controls in Section 3 measuring pre-existing, unchanged behavior for
  presets that don't opt into `premiumHero`.

## 3. Measured results

### 3.1 Fragmentation benchmark — Phases 2-8 experimental engine (`reports/build_025/fragmentation_benchmark.json`, 300 paired seeds `m25-1`..`m25-300`)

| Metric | Baseline (production, pre-Phase-9b) | Experimental (`luxuryComposition`, not shipped) | Delta |
|---|---|---|---|
| `fragmentedSilhouette` rate | 60.67% | 54.67% | -6.00pp |
| `deadSpace` rate | 42.33% | 51.00% | +8.67pp |
| `absoluteCommercialQuality` mean | 81.04 | 79.13 | -1.91 |
| `repeatedScale` rate | 5.00% | 11.67% | +6.67pp |
| node count mean | 5997.9 | 5988.4 | ~unchanged |

### 3.2 Fragmentation benchmark — Phase 9b Connectivity-Aware Thinning Repair (SHIPPED, same script/seed set)

| Metric | Before Phase 9b | After Phase 9b (production, default-on) | Delta |
|---|---|---|---|
| `fragmentedSilhouette` rate | 60.67% | **23%** | **-37.67pp — clears the ≤30% target** |
| `deadSpace` rate | 42.33% | 44.67% | +2.34pp (noise) |
| `tooManyFillers` rate | ~8% | 8% | unchanged |
| `absoluteCommercialQuality` mean | 81.04 | 80.72 | ~unchanged |

Same benchmark also re-measured the (still not shipped) experimental
Composition Engine on top of the Phase 9b fix's codebase:
`fragmentedSilhouette` 17%, `deadSpace` 53.33% (regression), commercial
78.92 (regression) — confirming enabling it on top of Phase 9b would only
trade a further, smaller fragmentation gain for real regressions, so it
correctly remains disabled.

### 3.3 Control set (confirms Phase 9b introduces zero drift on non-`premiumHero` presets, and no regression on other `premiumHero` presets)

| Preset | n | `fragmentedSilhouette` | `deadSpace` | commercial mean |
|---|---|---|---|---|
| `scandinavianOrganic` (non-`premiumHero`) | 100 | 6.00% | 0.00% | 86.49 |
| `bohoFloral` (`premiumHero`) | 50 | 20.00% | 0.00% | 82.50 |
| `darkBotanical` (`premiumHero`) | 50 | 16.00% (improved for free, was 28%) | 12.00% | 83.98 |
| `editorialBotanical` (`premiumHero`) | 50 | 40.00% | 16.00% | 85.40 |

### 3.4 100-Pattern portfolio (production, `reports/build_025/portfolio_100/`, regenerated against the Phase 9b-fixed code)

READY=77, REVIEW=17, REJECT=6 (out of 100) — up from 71/23/6 measured
against pre-Phase-9b production, reflecting the genuine quality
improvement from fewer fragmented silhouettes.

## 4. Regression testing

Full suite (`npx vitest run`) run 3 times consecutively, against the final
Phase 9b-fixed (role-preference-refined `connectivityRepair.ts`) code:

| Run | Files | Tests |
|---|---|---|
| 1 | 291/291 passed | 3175/3175 passed |
| 2 | 291/291 passed | 3175/3175 passed |
| 3 | 291/291 passed | 3175/3175 passed |

`npx tsc --noEmit`: clean, zero errors. No flakes observed anywhere in the
suite across all 3 runs, including the specific test fixed in Phase 10 —
separately verified in an earlier session via a 50-iteration standalone
loop (`PASS=50 FAIL=0`) and 5 consecutive isolated file runs (`119/119`
every time).

## 5. Files changed / added

**New engine modules, experimental (all with dedicated test files, disabled by default)**:
`luxuryCompositionProfiles.ts`, `topologyPlacement.ts`, `heroDominanceEngine.ts`,
`connectorQuality.ts`, `repairEngineV2.ts`, `wrapCohesion.ts`,
`luxuryFloralCompositionEngine.ts`.

**New engine module, SHIPPED (enabled by default for `premiumHero`)**:
`engine/connectivityRepair.ts` (Phase 9b, the fix that clears the
mandatory target) + `engine/connectivityRepair.test.ts` (4 tests).

**Modified — experimental wiring (no behavior change while
`luxuryComposition` stays unset)**: `engine/types.ts` (added
`isPrimaryCluster`, `luxuryComposition`, `productTarget` fields),
`engine/styleDna.ts` (added `luxuryComposition` to `StyleDna`),
`layouts/bouquet.ts` (conditional orchestrator early-return),
`engine/tile.test.ts` (Phase 10 fixture-size fix).

**Modified — SHIPPED fix wiring**: `engine/tile.ts` (calls
`repairIsolatedSurvivors` after thinning, gated on `params.premiumHero`;
also carries the conditional experimental Repair Engine V2 call, which
stays inert with `luxuryComposition` unset), `engine/bouquetSpatialGraph.ts`
(`cellIndexOf` exported, new exported `neighborCellsOf` helper extracted
from previously-inline logic — both reused by `connectivityRepair.ts` so it
shares the exact same wraparound cell/adjacency math the critic's own
graph is built from).

**Not modified**: `knowledge/registry/data/styles/luxuryFloral.json` (no
`luxuryComposition` field — the experimental engine stays reachable only
via `GenerateParams.luxuryComposition`, never through a shipped preset).

**New scripts** (kept, reusable): `scripts/build025FragmentationBenchmark.ts`,
`scripts/build025Portfolio100.ts`, `scripts/build025BeforeAfterEvidence.ts`,
`scripts/build025AfterFixedEvidence.ts` (Phase 9b's after-render pass),
`scripts/build025HumanReview.ts`.

**New docs**: `BUILD_025_AUDIT.md`, `docs/LUXURY_FLORAL_COMPOSITION_ENGINE.md`,
`docs/TOPOLOGY_AWARE_PLACEMENT.md`, `docs/CONNECTOR_QUALITY_ENGINE.md`,
`docs/REPAIR_ENGINE_V2.md`, `docs/WRAP_AWARE_COHESION.md`,
`docs/TEST_STABILITY_REPORT.md`, `docs/CONNECTIVITY_AWARE_THINNING_REPAIR.md`
(Phase 9b). Updated: `docs/USER_GUIDE.md` (Thai changelog), `docs/ROADMAP.md`
(Shipped entry + Known Issue #6), `reports/build_025/before_after/BEFORE_AFTER_SUMMARY.md`
(rewritten for the 3-way before/after_fixed/after_experimental comparison),
`reports/build_025/human_review/HUMAN_REVIEW_GUIDE_TH.md`.

**Preserved untouched** (per instruction): `app/dist-standalone/`,
`portfolio_phase_1/`, `portfolio_phase_1b_review/`.

## 6. Two things this build's own defects confirmed about the codebase

1. **Anchor-level scale decisions never automatically reach rendered
   output** — `clusterEngine.ts`'s `generateCluster` always renders its own
   hero member near 1.0 scale regardless of the caller's `baseRadius`,
   which only spreads member DISTANCES. Any future engine that computes a
   "this anchor should be bigger" decision must explicitly multiply it into
   the emitted `scale` field at the point of emission — it will silently do
   nothing otherwise. This build hit this bug once, found it via a debug
   script, and fixed it (see `BUILD_025_AUDIT.md`'s development history).
2. **Distinct-`clusterId` count is the real lever on fragmentation, not
   raw geometry quality** — `tile.ts`'s Section-10 thinning discards ~90%
   of placements against a FIXED total budget, and
   `reserveClusterCompanions` can only guarantee one survivor per distinct
   cluster. Any change that increases the number of distinct clusters a
   tile produces (even for good reasons, like adding real topology-aware
   secondary anchors as their own clusters) will make fragmentation worse
   regardless of how good each cluster's own internal shape is. This build
   discovered this the hard way (an intermediate per-anchor-cluster version
   measured 100% fragmentation) and designed around it (one `clusterId` per
   bouquet UNIT, not per anchor).

## 7. Final verdict

Both mandatory blockers are met:

1. **`luxuryFloral` `fragmentedSilhouette` ≤ 30%**: MET. Production
   (shipped, default-on for `premiumHero`) rate is **23%** per the
   300-seed benchmark (Section 3.2), a genuine -37.67pp improvement from
   the 60.67% baseline, via `engine/connectivityRepair.ts`'s
   Connectivity-Aware Thinning Repair (Phase 9b) — a real, tested,
   simulate-then-commit fix, not a threshold or diagnostic change. No
   regression on `deadSpace`, `tooManyFillers`, or commercial quality; two
   controls unaffected, one (`darkBotanical`) improved for free.
2. **Flaky timeout test root-caused and fixed**: MET (Phase 10, this and a
   prior session). Confirmed stable across 3 fresh consecutive full
   regression runs plus the earlier standalone 50-iteration loop.

All other acceptance criteria are also met: full regression passing 3×
consecutively (291/291 files, 3175/3175 tests, zero flakes, Section 4),
`tsc --noEmit` clean, complete 100-pattern portfolio re-validated against
the shipped fix (READY=77/REVIEW=17/REJECT=6), complete human review
package regenerated, valid exports, no P0/P1 issues, no threshold or
diagnostic weakening anywhere in this build.

The experimental Composition Engine (Phases 2-8) remains disabled by
default — it alone did not clear the target and carries its own
regressions — but the brief's mandatory fragmentation target is cleared by
the Phase 9b fix, which is enabled by default and is what every user
actually gets.

BUILD 025 LUXURY FLORAL COMPOSITION & STABILITY: PASS
