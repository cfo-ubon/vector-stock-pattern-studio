# Build 025 Report — Luxury Floral Composition & Stability Engine

## 0. Scope note (read this first)

This build had two independent goals: (1) fix `luxuryFloral`'s
`fragmentedSilhouette` rate (60% baseline, per Build 024) to ≤30% via a real
Composition Profile system, without weakening any detector threshold or
rewriting botanical anatomy; (2) root-cause and genuinely fix one
pre-existing flaky timeout test. Goal 2 is fully met. Goal 1 is **not** met:
a full, real, working composition engine was built and measured at scale
(300 seeds), producing a genuine but insufficient improvement
(-6 percentage points) alongside two measured regressions. Per this
codebase's established precedent (Build 023/024's own honest-disclosure
pattern), the gap is disclosed explicitly here rather than hidden, and the
new engine ships **disabled by default** so production output is
unaffected. See `BUILD_025_AUDIT.md` for the full audit.

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
13. **Phase 14 — Testing**: 7 new test files (all new engine modules),
    full suite run 3× consecutively — see Section 4.

## 2. What was NOT implemented / not fully resolved

- **The ≤30% `fragmentedSilhouette` target was not met.** Best full-scale
  measurement: 54.67% (experimental) vs 60.67% (baseline) — a real -6pp
  improvement, more than 24 percentage points short of target.
- **Two real regressions were introduced by the experimental engine**:
  `deadSpace` rate +8.67pp (42.33% → 51.00%), mean
  `absoluteCommercialQuality` -1.91 (81.04 → 79.13). Because these
  regressions accompany a target miss, the brief's PASS bar does not permit
  shipping this as enabled-by-default.
- **Wrap-Aware Cohesion (Phase 7) is not wired into connector scoring** and
  has no empirical benchmark of its own effect — a real, tested, but
  unintegrated module.
- Botanical anatomy, species data, and every detector threshold
  (`fragmentedSilhouette`, READY/REVIEW/REJECT cutoffs) were left
  **untouched**, per the brief's explicit constraint — confirmed by the
  controls in Section 3 measuring pre-existing, unchanged behavior.

## 3. Measured results

### 3.1 Fragmentation benchmark (`reports/build_025/fragmentation_benchmark.json`, 300 paired seeds `m25-1`..`m25-300`)

| Metric | Baseline (shipped) | Experimental (disabled) | Delta |
|---|---|---|---|
| `fragmentedSilhouette` rate | 60.67% | 54.67% | -6.00pp |
| `deadSpace` rate | 42.33% | 51.00% | +8.67pp |
| `absoluteCommercialQuality` mean | 81.04 | 79.13 | -1.91 |
| `repeatedScale` rate | 5.00% | 11.67% | +6.67pp |
| node count mean | 5997.9 | 5988.4 | ~unchanged |

### 3.2 Control set (confirms zero drift on non-opted-in presets)

| Preset | n | `fragmentedSilhouette` | `deadSpace` | commercial mean |
|---|---|---|---|---|
| `scandinavianOrganic` | 100 | 6.00% | 0.00% | 86.49 |
| `bohoFloral` | 50 | 20.00% | 0.00% | 82.50 |
| `darkBotanical` | 50 | 28.00% | 12.00% | 83.78 |
| `editorialBotanical` | 50 | 40.00% | 16.00% | 85.40 |

### 3.3 100-Pattern portfolio (production, `reports/build_025/portfolio_100/`)

READY=71, REVIEW=23, REJECT=6 (out of 100). Identical mechanism/thresholds
to Build 024's own portfolio classification — this is a re-validation of
unchanged production behavior, not a new result.

## 4. Regression testing

Full suite (`npx vitest run`) run 3 times consecutively:

| Run | Files | Tests |
|---|---|---|
| 1 | 290/290 passed | 3171/3171 passed |
| 2 | 290/290 passed | 3171/3171 passed |
| 3 | 290/290 passed | 3171/3171 passed |

`npx tsc --noEmit`: clean, zero errors. `npm run lint` (oxlint): clean, exit
code 0. No flakes observed anywhere in the suite across all 3 runs,
including the specific test fixed in Phase 10 — separately verified via a
50-iteration standalone loop (`PASS=50 FAIL=0`) and 5 consecutive isolated
file runs (`119/119` every time).

## 5. Files changed / added

**New engine modules** (all with dedicated test files): `luxuryCompositionProfiles.ts`,
`topologyPlacement.ts`, `heroDominanceEngine.ts`, `connectorQuality.ts`,
`repairEngineV2.ts`, `wrapCohesion.ts`, `luxuryFloralCompositionEngine.ts`.

**Modified (wiring only, no behavior change while `luxuryComposition` stays
unset)**: `engine/types.ts` (added `isPrimaryCluster`, `luxuryComposition`,
`productTarget` fields), `engine/styleDna.ts` (added `luxuryComposition` to
`StyleDna`), `engine/tile.ts` (conditional Repair Engine V2 call),
`layouts/bouquet.ts` (conditional orchestrator early-return),
`engine/tile.test.ts` (Phase 10 fixture-size fix).

**Not modified**: `knowledge/registry/data/styles/luxuryFloral.json` (no
`luxuryComposition` field — confirmed via re-measurement that production
output is byte-identical to Build 024).

**New scripts** (kept, reusable): `scripts/build025FragmentationBenchmark.ts`,
`scripts/build025Portfolio100.ts`, `scripts/build025BeforeAfterEvidence.ts`,
`scripts/build025HumanReview.ts`.

**New docs**: `BUILD_025_AUDIT.md`, `docs/LUXURY_FLORAL_COMPOSITION_ENGINE.md`,
`docs/TOPOLOGY_AWARE_PLACEMENT.md`, `docs/CONNECTOR_QUALITY_ENGINE.md`,
`docs/REPAIR_ENGINE_V2.md`, `docs/WRAP_AWARE_COHESION.md`,
`docs/TEST_STABILITY_REPORT.md`. Updated: `docs/USER_GUIDE.md` (Thai
changelog, v1.78), `docs/ROADMAP.md` (Shipped entry + Known Issue #6
extended).

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

Per Section 3: the ≤30% fragmentation target was not met (best measured:
54.67%, a real but insufficient -6pp improvement), and 2 measured
regressions (`deadSpace`, mean commercial quality) accompany that partial
improvement. The new engine ships disabled by default; production
`luxuryFloral` output is unaffected and confirmed byte-identical to Build
024. All other acceptance criteria (flaky test root-caused and fixed, full
regression passing 3× consecutively, complete 100-pattern portfolio,
complete human review package, valid exports, no P0/P1 issues) are met, but
the brief's primary named metric is not, and PASS-SCOPE-LIMITED is not a
permitted verdict for this brief.

BUILD 025 LUXURY FLORAL COMPOSITION & STABILITY: FAIL
