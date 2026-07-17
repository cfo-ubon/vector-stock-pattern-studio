# P2.5 Sprint 2 — Test Report

Covers the tests added this sprint for the new validation-library modules
(Section 12 of the brief). Full-suite regression results (before/after,
covering Sprint 1/P1/P2 Stage 1/Stage 2/Generator/Portfolio
Intelligence/import-export/Blob persistence/CRUD tests) are reported in
`P2_5_SPRINT2_REPORT.md`'s "Full Regression Result" section, not
duplicated here.

## New test files (46 tests total, all passing)

### `latencyDrift.test.ts` (7 tests)

- reports `insufficient_samples` below the minimum sample threshold
- classifies stable when the final window is close to the initial window
- classifies warning when the final median is ~20% higher
- classifies failure when the final median is >30% higher
- a single isolated outlier in the final window does not alone flip
  classification to failure (guards the brief's explicit "do not
  classify from one outlier" requirement)
- flags p95 investigation independently of the median-driven
  classification (a stable median with a >30% p95 jump still sets the
  flag)
- computes initial/final windows as roughly the first/last 10% of
  samples

### `memoryTrend.test.ts` (7 tests)

- reports `insufficient_samples` below the minimum threshold
- reports `unsupported` when any sample lacks OS support
- classifies a flat series as `plateau`
- classifies a steadily-climbing series as `growth`
- detects a plateau even after early growth, once the late window
  flattens (guards against mistaking early warm-up growth for a
  permanent leak)
- reports early/late window means
- computes a per-second slope from real timestamps

### `consistencyManifest.test.ts` (7 tests)

- reports real counts matching a freshly persisted dataset
- reports zero for every count on an empty store
- measures duplicate-collectionId assets directly (documents that the
  integrity scanner itself does not report this — Sprint 1's own P2.5-1
  debt item — the consistency manifest is a separate, direct count)
- reports zero deltas and no mismatch when nothing changed
- does not flag an expected, accounted-for mutation as a mismatch
  (e.g. a deliberate bulk-assign that changes membership count)
- flags an unexplained collection-count mismatch when the actual delta
  does not match expectations (catches, e.g., an incompletely-cleaned-up
  temp collection)
- flags newly introduced orphans/stale covers

### `soakRunner.test.ts` (12 tests)

- produces the exact requested count for each operation (exact-count
  stress-plan mode)
- same seed produces the identical operation order (determinism)
- different seeds can produce a different operation order
- counts thrown errors as failures, not successes
- counts a hung operation as a timeout, not a failure or success
- takes samples at the configured interval, including a final sample
- reports blob URL outstanding via the provided callback
- stops early and produces a partial result when signalled (cancellation)
- stops once the configured duration elapses (duration-driven soak mode)
- cancels cleanly mid-run and still returns partial results (found and
  fixed a real test bug here — see "Errors and fixes" below)
- uses weighted selection deterministically for the same seed
- extracts only successful elapsed times for the named operation, in
  order (`latencySeriesFor`)

### `baselineCompare.test.ts` (13 tests, 10 original + 3 added for P2.5-6)

- classifies improved/stable/warning/regression correctly at each
  threshold boundary
- classifies `non_comparable` across a different environment string
- classifies `no_baseline` for a benchmark Sprint 1 never measured
- never mutates the committed `SPRINT1_BASELINE` fixture
- `compareBatchAgainstSprint1` produces one row per measurement, in order
- `toMarkdownComparisonTable` renders a header row and one row per
  comparison
- `currentEnvironmentDescription` produces a real, non-empty fingerprint
- (added for the P2.5-6 fix) `SPRINT2_OPERATION_TO_SPRINT1_BENCHMARK_NAME`
  has no entry for `searchCollections`
- (added) every mapped entry points at a benchmark name Sprint 1 actually
  recorded
- (added) includes the expected 5 comparable operations

## Errors and fixes encountered while writing these tests

1. **`latencyDrift.test.ts` p95 threshold bug**: an early draft of the
   p95-investigation test used only 100 total samples (10 per 10%
   window) — below `benchmarkRunner.ts`'s own 20-sample p95 threshold, so
   `p95Ms` was always `null` and the assertion failed. Fixed by using 220
   total samples (60 initial + 138 middle + 22 final) so the relevant
   windows have ≥20–22 samples, with outliers placed in the final window
   to shift p95 without shifting the median.
2. **`soakRunner.test.ts` cancellation-timer starvation**: the
   "cancels cleanly mid-run" test initially failed intermittently because
   its test operations were instantly-resolving promises
   (`async () => {}`); a tight `while (Date.now() - start < duration)`
   loop of such operations creates an unbroken chain of microtask
   resolutions that can starve Node's real `setTimeout`-based
   cancellation timer — microtasks fully drain before the timer phase
   runs, and each loop iteration schedules more microtasks before the
   timer gets a chance to fire. Fixed by changing the test's operations
   to `new Promise(resolve => setTimeout(resolve, 5))`, forcing a genuine
   event-loop yield each cycle so the cancellation timer can actually
   run.

Neither fix touched production code — both were test-construction issues
in the newly-written Sprint 2 tests themselves, caught and corrected
before this report was written.

## Regression policy honored

No flaky test's timeout was widened to force a pass — the one flaky test
found (`soakRunner.test.ts`'s cancellation test) was fixed by removing the
actual race condition in the test's own operations, not by loosening a
timeout or retry count.
