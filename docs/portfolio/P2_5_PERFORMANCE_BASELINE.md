# Performance Baseline Policy — Portfolio Manager Collections

Machine-checkable half lives in `app/src/catalog/validation/baselinePolicy.ts`
(`compareToBaseline`, `upsertBaselineMetric`, the `PerformanceBaseline`/
`BaselineMetric` schema). This document is the permanent, human-readable
policy.

## Identity

- **Benchmark identity**: `benchmarkName` (e.g. `bulk-assign-1000`) — a
  stable string per benchmark case, never renamed casually (renaming
  breaks history).
- **Dataset identity**: `datasetIdentity` (e.g. `small-1000x100`) —
  `${preset}-${assetCount}x${collectionCount}`. Comparing across
  different dataset identities is meaningless and is refused by
  `compareToBaseline` (returns `no_baseline`, since no matching entry
  exists for that identity).
- **Metric unit**: `'ms'` (wall-clock) or `'ops_per_sec'` — recorded
  explicitly per metric, never inferred.

## Environment comparability

Every stored `BaselineMetric` carries an `environmentDescription`
(`${nodeVersion} | ${platform}/${arch} | ${cpuModel}`, from
`benchmarkRunner.ts`'s `collectEnvironmentMetadata()`). A comparison
against a baseline recorded on a different environment string returns
`verdict: 'non_comparable'` with a stated reason — **never** a fabricated
pass/fail across incomparable hardware. This is a hard rule, not a
guideline: `compareToBaseline` checks it before computing any percentage.

## Thresholds

- **Warning**: median degrades ≥15% vs. the stored baseline.
- **Failure**: median degrades ≥30%.
- p95 (when available — 20+ samples) is an additional guardrail a future
  sprint's CI gate can check the same way; Sprint 1 does not wire a CI
  gate, only the comparison function itself.
- An *improved* (faster) median is always `'ok'`, never flagged.

Changing either threshold requires updating this document with a stated
reason (e.g. "CI runners are noisier than expected, widening warning to
20%") — not a silent code edit. No threshold was changed from the brief's
suggested defaults for this sprint.

## Noisy CI environments

If a future CI environment's timing is measurably noisier than local
runs (wider variance run-to-run for the same code), the correct response
is to **not** compare its numbers against a baseline recorded locally
(different environment string already prevents this automatically) and,
if CI baselines are wanted at all, record and maintain a **separate**
baseline set keyed by a CI-specific `environmentDescription` — never
loosen the shared threshold to accommodate one noisy source.

## Updating an approved baseline

`upsertBaselineMetric(baseline, metric, { force })`:

- If the new metric is `'ok'` (not a regression) relative to the existing
  entry, it replaces it automatically — no need to force an improvement.
- If the new metric would be a `'warning'` or `'failure'` regression, the
  update is **refused** unless the caller passes `{ force: true }` —
  Section 10's explicit "prohibition against silently replacing a worse
  baseline." Forcing is for the deliberate case (a genuine, accepted
  architecture tradeoff), not a default.
- A `'non_comparable'` or `'no_baseline'` result is always allowed
  through (nothing valid exists yet to protect).

## Baseline schema

```ts
interface BaselineMetric {
  benchmarkName: string;
  datasetIdentity: string;
  metricUnit: 'ms' | 'ops_per_sec';
  medianValue: number;
  p95Value: number | null;
  environmentDescription: string;
  recordedAt: number;
}
interface PerformanceBaseline {
  schemaVersion: number; // currently 1
  metrics: BaselineMetric[];
}
```

## Sprint 1's own baseline snapshot (this environment only — see caveat below)

Real numbers from this sprint's own measured runs (`v22.22.2 | linux/x64 |
Intel(R) Xeon(R) Processor @ 2.10GHz`), median of the reported samples:

| Benchmark | small-1000x100 | medium-10000x1000 | large-100000x10000 |
|---|---|---|---|
| list-collections | 0.54ms | 3.18ms | 39.72ms |
| filter-active-archived | 0.60ms | 3.18ms | 35.92ms |
| open-collection-metadata | 9.79ms | 84.82ms | 973.97ms |
| collection-count | 0.02ms | 0.02ms | 0.06ms |
| search-collection-filter | 0.24ms | 0.54ms | 5.45ms |
| bulk-assign-1000 | 30.29ms | 104.53ms | 1097.70ms |
| bulk-remove-1000 | 34.71ms | 107.91ms | 1111.68ms |
| integrity-scan | 9.43ms | 94.89ms | 1039.48ms |
| dataset generation | 11.4ms | 69.1ms | 335.8ms |

**Caveat, stated explicitly**: this table is a *reference snapshot*, not
a committed machine-readable `PerformanceBaseline` JSON file — this
sprint's scope is the policy/schema/comparison-function infrastructure,
not adopting a permanent numeric gate (no CI wiring exists yet to compare
against one). A future sprint that wires `compareToBaseline` into CI
should treat the numbers above as the first candidate baseline for *this
specific CI/dev environment's* `environmentDescription` — recorded here
in Markdown rather than as a committed JSON baseline file, per the "commit
only... a baseline report containing approved summarized measurements"
instruction (Section 6) — a full JSON `PerformanceBaseline` blob is
transient generated output, not a stable fixture.
