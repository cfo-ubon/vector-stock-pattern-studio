# P2.5 Sprint 2 — Baseline Comparison

Compares Sprint 2's own measurements against the Sprint 1 approved
baseline (`app/src/catalog/validation/sprint1Baseline.ts`,
`SPRINT1_BASELINE`), reusing Sprint 1's unmodified comparison policy
(`baselinePolicy.compareToBaseline`: 15% warning / 30% failure thresholds,
p95 guardrail, environment-string comparability check). The committed
Sprint 1 fixture is **never overwritten** — `compareAgainstSprint1`/
`compareBatchAgainstSprint1` (`baselineCompare.ts`) are read-only over it
by construction (nothing in Sprint 2 has a write path to
`sprint1Baseline.ts`).

## Comparable identities

Sprint 1 benchmarked these operations against the same LARGE
(`large-100000x10000`) / MEDIUM (`medium-10000x1000`) / SMALL
(`small-1000x100`) dataset identities Sprint 2 reuses. Sprint 2 maps its
own soak/stress operation names onto Sprint 1's baseline benchmark names
via `SPRINT2_OPERATION_TO_SPRINT1_BENCHMARK_NAME`
(`app/src/catalog/validation/baselineCompare.ts`):

| Sprint 2 operation | Sprint 1 baseline benchmark |
|---|---|
| `filterActive` | `filter-active-archived` |
| `openCollection` | `open-collection-metadata` |
| `bulkAssign` | `bulk-assign-1000` |
| `bulkRemove` | `bulk-remove-1000` |
| `integrityScan` | `integrity-scan` |

`dataset-generation`, `persistence`, and `cleanup` are covered by the
stress/soak scripts' own console output (see `P2_5_STRESS_REPORT.md`)
rather than the per-operation soak comparison table, since they are
one-shot setup/teardown steps, not repeated soak operations.
`searchCollections` is **deliberately excluded** — see the "Defect found"
note below.

## LARGE stress run (authoritative, post-fix)

| Benchmark | Dataset | Sprint 1 (ms) | Sprint 2 (ms) | Diff (%) | Classification |
|---|---|---|---|---|---|
| filter-active-archived | large-100000x10000 | 35.92 | 37.24 | +3.7% | STABLE |
| open-collection-metadata | large-100000x10000 | 973.97 | 859.83 | −11.7% | IMPROVED |
| bulk-assign-1000 | large-100000x10000 | 1097.70 | 945.37 | −13.9% | IMPROVED |
| bulk-remove-1000 | large-100000x10000 | 1111.68 | 879.33 | −20.9% | IMPROVED |
| integrity-scan | large-100000x10000 | 1039.48 | 987.39 | −5.0% | IMPROVED |

Zero regressions. Four of five operations run measurably *faster* under
Sprint 2's sustained-load conditions than in Sprint 1's cold, 3–5
iteration micro-benchmarks — plausibly explained by additional V8 JIT
warm-up under a much larger number of calls, not a code change (no
production Collection code has changed since the Sprint 1 baseline
commit).

## 30-minute standard soak

| Benchmark | Dataset | Sprint 1 (ms) | Sprint 2 (ms) | Diff (%) | Classification |
|---|---|---|---|---|---|
| filter-active-archived | large-100000x10000 | 35.92 | 38.43 | +7.0% | STABLE |
| open-collection-metadata | large-100000x10000 | 973.97 | 894.78 | −8.1% | IMPROVED |
| bulk-assign-1000 | large-100000x10000 | 1097.70 | 983.22 | −10.4% | IMPROVED |
| bulk-remove-1000 | large-100000x10000 | 1111.68 | 924.79 | −16.8% | IMPROVED |
| integrity-scan | large-100000x10000 | 1039.48 | 1059.16 | +1.9% | STABLE |

Zero regressions.

## 5-minute smoke soak

| Benchmark | Dataset | Sprint 1 (ms) | Sprint 2 (ms) | Diff (%) | Classification |
|---|---|---|---|---|---|
| filter-active-archived | medium-10000x1000 | 3.18 | 3.48 | +9.4% | STABLE |
| open-collection-metadata | medium-10000x1000 | 84.82 | 91.77 | +8.2% | STABLE |
| bulk-assign-1000 | medium-10000x1000 | 104.53 | 119.38 | +14.2% | STABLE |
| bulk-remove-1000 | medium-10000x1000 | 107.91 | 97.41 | −9.7% | IMPROVED |
| integrity-scan | medium-10000x1000 | 94.89 | 104.13 | +9.7% | STABLE |

Zero regressions, all within the 15% warning threshold. (Note: this
run's per-operation *latency drift within the run itself* is separately
reported as "failure" in `P2_5_LATENCY_DRIFT.md` — that measures the first
10%-of-samples window against the last 10%-of-samples window *inside*
this 5-minute run, a different comparison than this table's Sprint1-vs-Sprint2
overall-median comparison. See that report's root-cause analysis.)

## Defect found and fixed: P2.5-6 (mismatched benchmark identity)

The first LARGE stress run additionally compared `searchCollections`
(Sprint 2's operation, calling `searchCollectionsByName` — a full
`loadCollections()` IndexedDB getAll + in-memory substring filter over
collection names) against Sprint 1's `search-collection-filter` baseline
entry. Reading Sprint 1's own benchmark script
(`scripts/validateCollections.ts:107-112`) shows that entry actually
measured `searchPortfolioAssets(assets, { collectionId, ... })` — an
unrelated **asset** search filtered by collection membership, an
in-memory array filter over already-loaded assets, not a database query
at all. These are two structurally different operations (different
store, different query shape, different cost) that happened to share a
plausible-sounding label. Comparing them produced a false
classification of **REGRESSION** at −559.2% ("Median degraded 559.2%").

**Classification**: validation-tool defect (Sprint 2's own comparison
wiring), not a production defect — confirmed no production Collection
code path differs from Sprint 1's own, unchanged implementation.

**Fix**: extracted the operation→benchmark-name map into
`SPRINT2_OPERATION_TO_SPRINT1_BENCHMARK_NAME`
(`app/src/catalog/validation/baselineCompare.ts`), which the CLI script
(`scripts/validateCollectionsStress.ts`) now imports instead of keeping
its own local map. The extracted map deliberately has no
`searchCollections` entry, with an inline comment explaining why. Sprint 1
never benchmarked "search collections by name" as its own case, so
Sprint 2 honestly reports **no baseline comparison for this operation**
rather than fabricating one.

**Regression test**: `baselineCompare.test.ts` — `describe('SPRINT2_OPERATION_TO_SPRINT1_BENCHMARK_NAME')`
(3 tests): asserts `searchCollections` has no entry, asserts every mapped
benchmark name exists in `SPRINT1_BASELINE.metrics`, and asserts the
5 expected comparable operations are present.

**Re-run**: the LARGE stress run, 5-minute smoke soak, and 30-minute
standard soak were all re-executed after the fix (see
`P2_5_STRESS_REPORT.md`/`P2_5_SOAK_REPORT.md` for the corrected results
used throughout this sprint's documentation).

## Policy notes

- No threshold was changed from Sprint 1's committed policy (15%/30%,
  p95 guardrail).
- `SPRINT1_BASELINE` (`sprint1Baseline.ts`) was not modified in any way —
  confirmed via `git diff` — satisfying "do not overwrite the approved
  Sprint 1 baseline silently."
- No new CI wiring was added (Sprint 1's own documented gap, P2.5-3,
  remains open — out of scope for Sprint 2).
