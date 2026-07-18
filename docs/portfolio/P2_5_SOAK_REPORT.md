# P2.5 Sprint 2 — Soak Report

Real runs of `app/src/catalog/validation/soakRunner.ts`'s `runSoak()` via
`scripts/validateCollectionsStress.ts`'s `soak-smoke`/`soak-30m`/
`soak-60m` modes — Section 3/Section 13 of the brief. All three required
profiles are covered here; the LARGE-dataset exact-count stress plan
(Section 4) is reported separately in `P2_5_STRESS_REPORT.md`.

## Soak runner design

`runSoak()` (duration-driven) differs from `runStressPlan()`
(exact-count, used only for the LARGE stress test): it picks operations
by weighted random selection (seeded), running continuously until the
requested wall-clock duration elapses (checked between operations, never
killing one mid-flight) or a cancellation signal fires. This is the
correct model for "soak for N minutes" — the *number* of cycles completed
depends on real elapsed time and each operation's actual cost, not a
fixed target.

**`tempCollectionCycle` design decision**: create → rename → archive →
unarchive → delete is bundled into one atomic soak operation rather than
five independently-orderable ones, because the steps are inherently
sequential (you cannot rename a collection before it exists) — this does
not fit the runner's otherwise-independent, randomly-orderable operation
model. Every `tempCollectionCycle` invocation is fully self-contained and
self-cleaning within one call.

## SMOKE profile (5 minutes, MEDIUM dataset)

Purpose per the brief: "verify instrumentation" before longer runs.

| Metric | Result |
|---|---|
| Requested / actual duration | 5.0 / 5.00 minutes |
| Cancelled | false |
| Total cycles | 4,018 |
| Failures / timeouts | **0 / 0** across all 10 operation types |
| Memory trend | growth, 3.5MB/s slope (see `P2_5_MEMORY_REPORT.md`) |
| Latency drift | every operation classifies `failure` by strict median drift — investigated and attributed to the short-duration/high-throughput warm-up effect, not a production defect (see `P2_5_LATENCY_DRIFT.md`) |
| Consistency | 0 asset/collection delta, 0 new orphans/stale covers |
| Baseline comparison | all 5 comparable operations STABLE or IMPROVED |

Instrumentation verified: per-operation success/failure/timeout counters,
periodic memory sampling, latency drift computation, and the consistency
snapshot/diff all functioned correctly end-to-end. The smoke profile's
stated purpose (verify instrumentation) is met; its latency numbers
should be read as evidence of the short-duration warm-up effect, not a
performance regression (see the two reports above for the full
investigation).

## STANDARD profile (30 minutes, LARGE dataset)

| Metric | Result |
|---|---|
| Requested / actual duration | 30.0 / 30.00 minutes |
| Cancelled | false |
| Total cycles | 2,589 |
| Failures / timeouts | **0 / 0** across all 10 operation types |
| Memory trend | growth, 356KB/s slope, oscillating (GC sawtooth) — not monotonic (see `P2_5_MEMORY_REPORT.md`) |
| Latency drift | every operation classifies **stable** (worst: `openCollection` 11.6%); one p95 investigation flag (`filterArchived`, +41.1% p95, investigated and attributed to GC-pause tail variance, not a defect) |
| Consistency | 0 asset/collection delta, 0 new orphans/stale covers, membership count grew by the expected net of bulk-assign/-remove activity |
| Baseline comparison | all 5 comparable operations STABLE or IMPROVED |

Per-operation cycle counts: `retrieveMembers` 271, `filterArchived` 336,
`filterActive` 352, `searchCollections` 437, `switchCollection` 387,
`bulkRemove` 92, `bulkAssign` 86, `openCollection` 447, `integrityScan` 55,
`tempCollectionCycle` 126 (126 full create→rename→archive→unarchive→delete
cycles, each self-cleaning).

This is the strongest single piece of evidence in Sprint 2: a genuinely
long, realistic, mixed-workload run against the full 100k/10k LARGE
dataset with **zero functional failures and every latency-drift
classification stable**.

## EXTENDED profile (60 minutes, LARGE dataset)

Requested per Section 13(D) — completed as a full, uninterrupted
60-minute run, not externally limited. Launched with the corrected
(post-P2.5-6-fix) code, seed `p2.5-sprint2-soak-extended`, against a
freshly generated LARGE dataset.

| Metric | Result |
|---|---|
| Requested / actual duration | 60.0 / **60.03 minutes** |
| Cancelled / externally limited | false / false |
| Total cycles | **4,997** |
| Failures / timeouts | **0 / 0** across all 10 operation types |
| Memory trend | growth, 425KB/s slope, early-window mean 927MB → late-window mean 1.97GB (see `P2_5_MEMORY_REPORT.md`) |
| Latency drift | 6 operations stable, 4 at WARNING (15–24%), **0 at FAILURE**; no p95 investigation flags |
| Consistency | 0 asset/collection delta, 0 new orphans/stale covers |
| Baseline comparison | all 5 comparable operations STABLE or IMPROVED |

Per-operation cycle counts: `openCollection` 818, `searchCollections` 825,
`filterActive` 660, `filterArchived` 667, `switchCollection` 808,
`tempCollectionCycle` 270 (270 full create→rename→archive→unarchive→delete
cycles, each self-cleaning), `retrieveMembers` 508, `bulkRemove` 187,
`integrityScan` 77, `bulkAssign` 177.

**This is the strongest single result in Sprint 2**: a full, uninterrupted
60-minute run against the complete 100k/10k LARGE dataset, with zero
functional failures and zero consistency issues. Latency drift shows 4
operations (`searchCollections` 15.5%, `tempCollectionCycle` 17.8%,
`retrieveMembers` 17.0%, `bulkAssign` 23.5%) crossing from "stable" (seen
in the 30-minute run) into "warning" territory — expected given the
larger absolute heap growth accumulated over twice the duration (see
`P2_5_MEMORY_REPORT.md`) — but **none reached the 30% failure threshold**,
and no p95 investigation flag was raised for any operation. Per Section
17's acceptance criteria ("no median degradation >30% without
resolution"), this run passes cleanly.

## Test coverage

`app/src/catalog/validation/soakRunner.test.ts` (12 tests): exact-count
sequencing, deterministic ordering (same seed → same order), failure vs.
timeout accounting, periodic sampling (including a guaranteed final
sample), Blob-URL-outstanding callback wiring, clean mid-run cancellation
with partial results, duration-based termination, and weighted-selection
determinism. See `P2_5_SPRINT2_TEST_REPORT.md` for the full list and the
two real test-construction bugs found and fixed while writing these
tests.
