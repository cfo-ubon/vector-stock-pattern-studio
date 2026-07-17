import { compareToBaseline, environmentDescription } from './baselinePolicy';
import type { ComparisonResult, ComparisonVerdict, CurrentMeasurement, PerformanceBaseline } from './baselinePolicy';
import { collectEnvironmentMetadata } from './benchmarkRunner';
import { SPRINT1_BASELINE } from './sprint1Baseline';

// Portfolio Manager P2.5 Sprint 2 — baseline comparison (Section 9).
// A thin batch wrapper over Sprint 1's own, unmodified
// `baselinePolicy.compareToBaseline` — no second comparison algorithm.
// Verdict vocabulary is mapped onto the brief's Section 9 wording
// (IMPROVED/STABLE/WARNING/REGRESSION/NON-COMPARABLE) without changing
// `compareToBaseline`'s own return shape.

export type Sprint2Classification = 'improved' | 'stable' | 'warning' | 'regression' | 'non_comparable' | 'no_baseline';

export interface Sprint2ComparisonRow extends ComparisonResult {
  datasetIdentity: string;
  classification: Sprint2Classification;
  sprint1MedianMs: number | null;
  sprint2MedianMs: number;
  absoluteDifferenceMs: number | null;
}

function classify(verdict: ComparisonVerdict, percentChange: number | null): Sprint2Classification {
  if (verdict === 'no_baseline') return 'no_baseline';
  if (verdict === 'non_comparable') return 'non_comparable';
  if (verdict === 'failure') return 'regression';
  if (verdict === 'warning') return 'warning';
  // verdict === 'ok': distinguish a real improvement from "stable".
  if (percentChange !== null && percentChange < -0.01) return 'improved';
  return 'stable';
}

/** Compares one Sprint 2 measurement against the committed Sprint 1
 * baseline (`sprint1Baseline.ts`). Never writes to that fixture — this
 * function is read-only, satisfying "do not overwrite the approved
 * baseline silently" by construction (there is nothing here that could
 * overwrite it). */
export function compareAgainstSprint1(measurement: CurrentMeasurement, baseline: PerformanceBaseline = SPRINT1_BASELINE): Sprint2ComparisonRow {
  const result = compareToBaseline(baseline, measurement);
  return {
    ...result,
    datasetIdentity: measurement.datasetIdentity,
    classification: classify(result.verdict, result.percentChange),
    sprint1MedianMs: result.baselineMedianMs,
    sprint2MedianMs: result.currentMedianMs,
    absoluteDifferenceMs: result.baselineMedianMs !== null ? result.currentMedianMs - result.baselineMedianMs : null,
  };
}

export function compareBatchAgainstSprint1(measurements: CurrentMeasurement[], baseline: PerformanceBaseline = SPRINT1_BASELINE): Sprint2ComparisonRow[] {
  return measurements.map((m) => compareAgainstSprint1(m, baseline));
}

/** Current environment's fingerprint, in the same format
 * `sprint1Baseline.ts`'s entries were recorded in — used by callers to
 * build each `CurrentMeasurement.environmentDescription` and to decide
 * up front whether this run is even in the same environment as Sprint 1
 * (if not, every row will honestly come back `non_comparable`). */
export function currentEnvironmentDescription(): string {
  return environmentDescription(collectEnvironmentMetadata());
}

/** Maps a Sprint 2 soak/stress operation name to the Sprint 1 baseline
 * benchmark name that measures the SAME underlying call — not merely a
 * similar-sounding one. Deliberately has no entry for `searchCollections`:
 * Sprint 2's `searchCollections` operation calls `searchCollectionsByName`
 * (a full `loadCollections()` + in-memory name filter), while Sprint 1's
 * `search-collection-filter` benchmark (`scripts/validateCollections.ts`)
 * actually measured `searchPortfolioAssets` — an unrelated asset search
 * filtered by collection membership. Comparing them under the same label
 * produced a false ~559% "regression" during Sprint 2 stress testing
 * (P2.5-6) purely from conflating two different operations, not from any
 * real performance change. See `docs/portfolio/P2_5_BASELINE_COMPARISON.md`. */
export const SPRINT2_OPERATION_TO_SPRINT1_BENCHMARK_NAME: Partial<Record<string, string>> = {
  filterActive: 'filter-active-archived',
  openCollection: 'open-collection-metadata',
  bulkAssign: 'bulk-assign-1000',
  bulkRemove: 'bulk-remove-1000',
  integrityScan: 'integrity-scan',
};

export function toMarkdownComparisonTable(rows: Sprint2ComparisonRow[]): string {
  const lines: string[] = [
    '| Benchmark | Dataset | Sprint 1 (ms) | Sprint 2 (ms) | Diff (ms) | Diff (%) | Classification |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const r of rows) {
    const diffPct = r.percentChange !== null ? `${(r.percentChange * 100).toFixed(1)}%` : 'n/a';
    const diffMs = r.absoluteDifferenceMs !== null ? r.absoluteDifferenceMs.toFixed(2) : 'n/a';
    const s1 = r.sprint1MedianMs !== null ? r.sprint1MedianMs.toFixed(2) : 'n/a';
    lines.push(`| ${r.benchmarkName} | ${r.datasetIdentity} | ${s1} | ${r.sprint2MedianMs.toFixed(2)} | ${diffMs} | ${diffPct} | ${r.classification.toUpperCase()} |`);
  }
  return lines.join('\n');
}
