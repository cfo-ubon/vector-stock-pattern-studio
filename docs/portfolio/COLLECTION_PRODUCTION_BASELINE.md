# Collection Module — Frozen Production Baseline (P2.5 Sprint 4)

Consolidates the real, measured evidence from Sprints 1-3 into one
canonical reference point. This is the baseline future regressions get
compared against — not a re-measurement, a citation of numbers already
recorded in each sprint's own reports. Nothing in this document was
re-run for Sprint 4; every figure below links back to where it was
originally measured.

## Performance baseline (Sprint 1, `sprint1Baseline.ts`)

The committed `SPRINT1_BASELINE` fixture (`app/src/catalog/validation/sprint1Baseline.ts`)
remains the frozen source of truth for per-operation median latency —
Sprint 2 explicitly never wrote to it, and no sprint since has either.
Environment: `v22.22.2 | linux/x64 | Intel(R) Xeon(R) Processor @ 2.10GHz`.

| Operation | SMALL (1k/100) | MEDIUM (10k/1k) | LARGE (100k/10k) |
|---|---|---|---|
| dataset-generation | 11.4ms | 69.1ms | 335.8ms |
| persistence | 34.1ms | 190.8ms | 1,484.8ms |
| list-collections | 0.54ms | 3.18ms | 39.72ms |
| filter-active-archived | 0.6ms | 3.18ms | 35.92ms |
| open-collection-metadata | 9.79ms | 84.82ms | 973.97ms |
| collection-count | 0.02ms | 0.02ms | 0.06ms |
| search-collection-filter | 0.24ms | 0.54ms | 5.45ms |
| bulk-assign-1000 | 30.29ms | 104.53ms | 1,097.7ms |
| bulk-remove-1000 | 34.71ms | 107.91ms | 1,111.68ms |
| integrity-scan | 9.43ms | 94.89ms | 1,039.48ms |

Future performance work compares against this table via
`baselinePolicy.ts`'s `compareToBaseline` (stable/warning/regression
thresholds already implemented and tested — see P2.5-3 in the technical
debt register for the still-open CI-wiring gap, explicitly deferred
again this sprint).

## Sustained-load baseline (Sprint 2)

| Metric | Result | Source |
|---|---|---|
| Exact-count stress plan (LARGE dataset) | **710/710 operations succeeded, 0 failures, 0 timeouts** | `P2_5_STRESS_REPORT.md` |
| 60-minute soak (LARGE dataset) | **4,997 cycles, 0 failures**, not externally limited | `P2_5_SOAK_REPORT.md` |
| 30-minute soak (LARGE dataset) | 4,018 cycles, 0 failures | `P2_5_SOAK_REPORT.md` |
| Memory trend (all 4 profiles: 8min/5min/30min/60min) | Oscillating (GC sawtooth), no monotonic unbounded growth, no confirmed leak within tested durations | `P2_5_MEMORY_REPORT.md` |
| Real-browser UI soak | **100/100 cycles, 0 page errors, 0 console errors, 0 outstanding Blob URLs** | `P2_5_UI_SOAK_REPORT.md` |
| IndexedDB consistency (before/after every run) | Zero unexplained mismatches, zero new orphans, zero new stale covers | `P2_5_SOAK_REPORT.md`, `P2_5_STRESS_REPORT.md` |

## Recovery and durability baseline (Sprint 3)

| Metric | Result | Source |
|---|---|---|
| Failure-injection matrix (9 ops × 9 points) | **81/81 recovered, 81/81 clean** | `P2_5_FAILURE_MATRIX.md` |
| Repeated durability cycles (100 per op × 9 ops) | **900/900 durable and clean** | `P2_5_DURABILITY_REPORT.md` |
| Idempotency (6 ops × 5 repeats) | **30/30 stable, 0 divergences** | `P2_5_DURABILITY_REPORT.md` |
| Consistency manifest (before/after-failure/after-recovery/after-repeat) | Clean at every transition | `P2_5_CONSISTENCY_REPORT.md` |
| LARGE dataset recovery (100k/10k/504,544 memberships) | **4/4 scenarios recovered, zero new corruption**, each under 14s | `P2_5_RECOVERY_REPORT.md` |
| Real-browser recovery (100 open/mutate/reload/reopen/validate cycles) | **100/100 clean, 0 page/console errors** | `P2_5_BROWSER_RECOVERY.md` |
| Real OS-process-kill crash simulation (5 trials) | **Committed writes always survived, atomicity always held, integrity always clean** | `P2_5_BROWSER_RECOVERY.md` |
| Production defects found in 3 sprints of adversarial testing | **1** (bulk-write atomicity gap — found and fixed in Sprint 3) | `P2_5_SPRINT3_REPORT.md` §15 |

## Test suite baseline

**225 test files, 2,676 tests, 0 failures** as of Sprint 3's final
regression run (commit `04b59e3`) — the number this freeze's own final
regression run (Sprint 4, below) is compared against.

## What this baseline does and doesn't certify

It certifies that, across three independent validation sprints using
different techniques (deterministic dataset generation and benchmarking,
sustained stress/soak load, and adversarial failure injection), the
Collection module's real, shipped behavior — not a mocked or simplified
stand-in — held up under every scenario tested. It does not certify
performance or correctness at scales beyond LARGE (100k assets/10k
collections/500k+ memberships), under real concurrent multi-tab usage
(not tested in any sprint), or against `fake-indexeddb` vs. every real
browser's IndexedDB implementation quirks beyond the real-Chromium runs
in Sprint 2/3 — see `docs/portfolio/COLLECTION_PRODUCTION_CERTIFICATION.md`'s
"Scope of certification" section for the complete, honest boundary.
