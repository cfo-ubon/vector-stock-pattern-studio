import type { PerformanceBaseline } from './baselinePolicy';

// Portfolio Manager P2.5 Sprint 2 — the approved Sprint 1 baseline,
// committed as a small, stable fixture (per Sprint 1's own documented
// policy: "commit only... a baseline report containing approved
// summarized measurements", not a full generated JSON blob). Transcribed
// directly from `docs/portfolio/P2_5_PERFORMANCE_BASELINE.md`'s measured
// table — the real numbers from Sprint 1's `npm run
// validate:collections:small/medium/large` runs. This file is read-only
// for Sprint 2's comparison tooling; nothing in Sprint 2 writes to it
// (Section 9's "do not overwrite the approved Sprint 1 baseline
// silently" is satisfied by never writing to it at all).

const SPRINT1_ENVIRONMENT = 'v22.22.2 | linux/x64 | Intel(R) Xeon(R) Processor @ 2.10GHz';

function metric(benchmarkName: string, datasetIdentity: string, medianValue: number): PerformanceBaseline['metrics'][number] {
  return {
    benchmarkName,
    datasetIdentity,
    metricUnit: 'ms',
    medianValue,
    p95Value: null, // Sprint 1's own benchmarks ran 3-5 iterations — below the 20-sample p95 threshold, same as documented in P2_5_BENCHMARK_RUNNER.md
    environmentDescription: SPRINT1_ENVIRONMENT,
    recordedAt: 1784282573465, // Sprint 1's LARGE run timestamp, docs/build_reports/P2_5_SPRINT1_REPORT.md Section 23
  };
}

const DATASETS = {
  small: 'small-1000x100',
  medium: 'medium-10000x1000',
  large: 'large-100000x10000',
} as const;

export const SPRINT1_BASELINE: PerformanceBaseline = {
  schemaVersion: 1,
  metrics: [
    metric('dataset-generation', DATASETS.small, 11.4),
    metric('dataset-generation', DATASETS.medium, 69.1),
    metric('dataset-generation', DATASETS.large, 335.8),

    metric('persistence', DATASETS.small, 34.1),
    metric('persistence', DATASETS.medium, 190.8),
    metric('persistence', DATASETS.large, 1484.8),

    metric('list-collections', DATASETS.small, 0.54),
    metric('list-collections', DATASETS.medium, 3.18),
    metric('list-collections', DATASETS.large, 39.72),

    metric('filter-active-archived', DATASETS.small, 0.6),
    metric('filter-active-archived', DATASETS.medium, 3.18),
    metric('filter-active-archived', DATASETS.large, 35.92),

    metric('open-collection-metadata', DATASETS.small, 9.79),
    metric('open-collection-metadata', DATASETS.medium, 84.82),
    metric('open-collection-metadata', DATASETS.large, 973.97),

    metric('collection-count', DATASETS.small, 0.02),
    metric('collection-count', DATASETS.medium, 0.02),
    metric('collection-count', DATASETS.large, 0.06),

    metric('search-collection-filter', DATASETS.small, 0.24),
    metric('search-collection-filter', DATASETS.medium, 0.54),
    metric('search-collection-filter', DATASETS.large, 5.45),

    metric('bulk-assign-1000', DATASETS.small, 30.29),
    metric('bulk-assign-1000', DATASETS.medium, 104.53),
    metric('bulk-assign-1000', DATASETS.large, 1097.7),

    metric('bulk-remove-1000', DATASETS.small, 34.71),
    metric('bulk-remove-1000', DATASETS.medium, 107.91),
    metric('bulk-remove-1000', DATASETS.large, 1111.68),

    metric('integrity-scan', DATASETS.small, 9.43),
    metric('integrity-scan', DATASETS.medium, 94.89),
    metric('integrity-scan', DATASETS.large, 1039.48),

    // Sprint 1 did not benchmark "integrity-repair" or "cleanup" as
    // named cases (only exercised them functionally in integrity-scenario
    // tests) — no baseline entry exists for either yet. Sprint 2's
    // comparison against these two identities will honestly report
    // `no_baseline`, establishing the first measured baseline for a
    // future sprint, not silently fabricating a Sprint 1 number that was
    // never actually recorded.
  ],
};
