# Benchmark Runner — Portfolio Manager P2.5 Sprint 1

Source of truth: `app/src/catalog/validation/benchmarkRunner.ts` (running/
statistics), `benchmarkReport.ts` (console/JSON/Markdown formatting).

## Shape

A `BenchmarkCase` is just a name, category, an async/sync `run()`
function, and optional `warmupIterations`/`measuredIterations`/
`timeoutMs`. `runBenchmarkCase` runs the warm-ups (discarded, including a
warm-up failure — only measured iterations affect the reported status),
then the measured iterations, timing each with `performance.now()`.
`runBenchmarkSuite` runs a list of cases and attaches environment
metadata.

## Statistics (`BenchmarkStats`)

`count`, `minMs`, `maxMs`, `meanMs`, `medianMs`, `stdDevMs` (`null` for a
single sample), `p95Ms` (`null` below 20 samples), `p99Ms` (`null` below
100 samples), `opsPerSec` (`1000 / meanMs`). The 20/100-sample thresholds
are a deliberate "don't report a percentile that isn't meaningful yet"
choice, not an oversight — most of this sprint's own benchmark cases run
3-5 measured iterations (real service operations are the target, not
microbenchmarking a pure function millions of times), so their reports
correctly show `p95Ms: null` rather than a percentile computed from a
handful of samples.

## Timeout/failure handling

Each measured iteration is wrapped in a `Promise.race`-style timeout
(default 30s, per-case override via `timeoutMs`). A timeout or a thrown
error both stop the case immediately and report `status: 'timeout'` /
`'failure'` with a plain `error: string` message — **never** `error.stack`
in the normal result object (Section 5's "error details without stack
traces in normal summaries").

## Environment metadata

`collectEnvironmentMetadata()` reports Node version, platform, arch, CPU
count/model (`node:os`), and total memory — all real values read from the
actual running process, never fabricated. Used both in every report and
by `baselinePolicy.ts`'s environment-comparability check.

## Reports (`benchmarkReport.ts`)

`toJsonReport`, `toConsoleSummary`, `toMarkdownReport` all take one
`FullValidationReport` (environment + manifest + benchmark results +
warnings + failures + git commit/branch) and produce the three required
output formats (Section 6). The Markdown report includes a manifest table
and a benchmark table (category/name/status/median/mean/p95/p99/stddev/
ops-per-sec); both Warnings/Failures sections are omitted entirely when
empty rather than printed as empty headers.

## Required benchmark categories (Section 5) — where they live

| Category | Cases (in `scripts/validateCollections.ts`) |
|---|---|
| A. Dataset generation | measured directly via `manifest.generationDurationMs` for small/medium/large (see `P2_5_PERFORMANCE_BASELINE.md`) |
| B. Collection service operations | `list-collections`, `filter-active-archived`, `open-collection-metadata`, `bulk-assign-1000`, `bulk-remove-1000`, `integrity-scan` |
| C. Data access | `collection-count`, `search-collection-filter` (paginated member retrieval is not a separate service-layer benchmark — `getAssetsForCollection` is not paginated at the service layer today, only at the UI layer per Stage 2's `MEMBER_PAGE_SIZE`; benchmarked as-is, documented as a known limitation, not silently worked around) |

No browser-render performance claim is made anywhere in this sprint's
output — every number above is a Node-process service/data-access
measurement, consistent with Section 5's explicit "do not claim
browser-render performance certification in Sprint 1."
