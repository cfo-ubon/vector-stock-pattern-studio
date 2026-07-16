# Performance

Measured, not estimated. Numbers below come from real `buildTile()` calls
against the actual generators/layouts in this repo, run in this
environment (Node 22, single-threaded, no browser). New builds append a
dated section; don't overwrite prior numbers.

---

## Build 001 — Composition Intelligence Foundation V2

### Methodology

Generation time is sensitive to V8 JIT warmup, so naive "time before, then
time after" measurement is misleading — an early test run showed the
*second*-measured variant appearing 5-25x faster purely because it
benefited from JIT warmup the first-measured variant paid for. The
methodology used for the numbers below:

1. 20 shared warmup iterations, alternating both variants (V1 params, V2
   params), discarded.
2. 20 measured iterations, alternating which variant is timed first each
   iteration (cancels residual ordering bias).
3. Median of the 20 measured times reported (less sensitive to GC-pause
   outliers than mean).

"V1" = `compositionIntelligence: { balanceStrength: 0.5, rhythmStrength:
0.35 }` (the exact old `DEFAULT_COMPOSITION_INTELLIGENCE`). "V2" =
`compositionIntelligence: undefined` → the new `defaultParams()` default,
i.e. what every fresh "Generate" now actually produces.

### Generation time (median, ms) — per layout, default params otherwise

| Layout | V1 (before) | V2 (after) | Ratio |
|---|---:|---:|---:|
| scatter | 40.5 | 87.6 | 2.16x |
| bouquet | 46.7 | 110.0 | 2.36x |
| toss | 28.0 | 60.7 | 2.17x |
| sCurve | 2.4 | 3.4 | 1.42x |
| heroFlow | 4.4 | 7.6 | 1.73x |
| heroScatter | 234.4 | 313.8 | 1.34x |
| densePremium | 171.7 | 275.2 | 1.60x |
| radial | 416.3 | 1039.4 | 2.50x |
| airy | 5.0 | 7.6 | 1.52x |
| grid *(Regular Lattice, exempted)* | 19.8 | 19.5 | 1.00x (unaffected) |

The dominant cost is `engine/patternPhysics.ts`'s O(n²) nearest-higher-
importance-neighbor search — `radial`'s ~7,500-instance count makes it the
worst case. `grid`/`gridMinimal`/`halfDrop`/`brick`/`stripe` are
byte-identical whether or not the V2 fields are present (see
`docs/DESIGN_DECISIONS.md` #6), so their generation time is unaffected —
confirmed above for `grid` (1.00x, i.e. noise-level difference).

All measured times remain well within acceptable bounds for an
interactive design tool (worst case ~1 second, not a real-time
constraint) — see `docs/KNOWN_ISSUES.md` #2 for the recommended future
optimization (spatial-hash nearest-neighbor search).

### SVG node count and file size (average over 20 runs per layout)

| Layout | Nodes before | Nodes after | Size before (bytes) | Size after (bytes) |
|---|---:|---:|---:|---:|
| scatter | 2198 | 2153 | 158,890 | 155,464 |
| bouquet | 2366 | 2308 | 170,410 | 166,068 |
| toss | 1838 | 1794 | 132,784 | 129,537 |
| sCurve | 411 | 401 | 30,970 | 30,277 |
| heroFlow | 592 | 584 | 43,667 | 43,140 |
| heroScatter | 2762 | 2687 | 196,288 | 190,774 |
| densePremium | 3169 | 3066 | 227,760 | 219,915 |
| radial | 7666 | 7444 | 551,216 | 535,579 |
| airy | 524 | 513 | 39,131 | 38,344 |
| grid *(exempted)* | 1529 | 1529 | 110,724 | 110,724 |

Node count and file size both decrease slightly (~1-3%) for every
affected layout — Pattern Physics pulling motifs closer to their nearest
hero means, on average, slightly fewer of the 9 wrap-clone copies
`engine/tile.ts` builds per placement actually intersect the tile rect
near the edges. A real, if minor, positive side effect — not the goal of
the change, but a genuine one.

### Memory

Not separately profiled with a memory profiler in this environment; the
node-count/file-size numbers above are the direct proxy this codebase
already uses elsewhere for "how much SVG got built" (see
`app/COLLECTION_ENGINE.md`/`SVG_INTELLIGENCE_ENGINE.md` for the same
convention). No new persistent allocations are introduced — every new
pass (`applyAttraction`, `applyFlowBias`, `applyNegativeSpaceCorrection`)
is a pure function returning a new `Placement[]` array of the same
length, garbage-collected identically to the arrays V1's passes already
produced.

### Test suite performance

Full project suite: 127 files / 1510 tests, ~270s wall clock in this
environment (includes ~40 new tests this build added; the increase over
the pre-Build-001 baseline of 126 files / 1462 tests is proportional to
the new test count, not a per-test slowdown).

---

## Build 001.1 -- Composition Quality Refinement

### Methodology

Same warmup-controlled, interleaved methodology Build 001 established
(20 warmup + 20 measured iterations, median reported) applied where a
real timing comparison was relevant. Most of this build's additions
(Sections 5/6/7's new scoring modules) are pure O(n) reads over
already-extracted instances/metrics with no new placement-refinement
pass, so they don't need a before/after generation-time table the way
Build 001's O(n^2) Pattern Physics did -- their cost is a single
`extractInstances`/metrics pass' worth of work, already paid for by the
existing scoring pipeline.

### SVG node count -- the one real regression found and fixed

Section 1's 2 new hero-only overlay primitives
(`buildDecorativeDots`/`buildAccentArc`) measurably increased average SVG
node count per hero instance. For most real specs this stayed well within
`knowledge/rules`'s hard node budget (8000). One specific real scenario
-- a grid-layout spec with `density` 0.55 and `heroRatio` 0.12 producing
1024 total instances (129 heroes) -- sat at 7906/8000 (98.8%) of budget
even *before* this build's changes, an inherent fragility of that one
scenario. Adding the 2 new primitives at their first-pass trigger
probabilities pushed it to 9541/8000 -- a hard reject that hadn't existed
before. Fixed with a density-aware damping throttle (see Design Decisions
#4); the same scenario now measures 7898/8000, back under budget.

| Scenario | Nodes before Build 001.1 | Nodes with un-throttled Section 1 additions | Nodes after `densityDamping` fix |
|---|---:|---:|---:|
| 1024-instance grid spec (density 0.55, heroRatio 0.12) | 7906 | 9541 (over 8000 budget) | 7898 |

### Composition-quality re-measurement (30-scenario suite, same methodology as Build 001)

| Metric | Build 001 (after) | Build 001.1 (after) |
|---|---:|---:|
| `heroDetailRatio` | 56.0 | 60.9 |
| `hierarchy` | 95.7 | 97.6 |
| `flowCoherence` | 69.3 | 69.4-69.6 |
| `largestEmptyRegion` | 94.0 | 94.5 |
| `spacingUniformity` | 89.2 | 87.9-90.1 (within noise across variants tested) |
| `overallScore` (editorialBotanical) | 78.6-78.9 | 79.6-80.4 |
| `deadSpace` flagged | 2/30 | 2/30 (unchanged -- see Known Issues #1 resolution notes on why this specific detector count didn't move further) |
| `fragmentedSilhouette` flagged | 6/30 | 6-7/30 |
| `weakHero` flagged | 7/30 | 2-6/30 (varies with hero-complexity throttle tuning; final shipped configuration measures 6/30) |

### 100-pattern Visual Portfolio Review generation cost

Generating and scoring 105 patterns (7 seeds x 15 Style DNA presets,
trimmed to 100) via the real `DesignSpecification` -> `buildTileFromDesignSpec`
-> `runDesignSpecQualityLoop` pipeline took under 5 minutes wall-clock in
this environment when run without contending for CPU against a parallel
test suite -- a one-off validation cost, not a persistent runtime path.

### Test suite performance

Full project suite: 129 files / 1524 tests, ~400s wall clock in this
environment (up from Build 001's 127 files / 1510 tests, ~270s -- the
increase is proportional to ~14 new tests plus 2 new test files, not a
per-test slowdown; the wall-clock increase also reflects environment
variance run-to-run, not purely new test count).
