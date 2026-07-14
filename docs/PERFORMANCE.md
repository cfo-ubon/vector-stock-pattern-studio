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
