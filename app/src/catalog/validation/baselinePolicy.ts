// Portfolio Manager P2.5 Sprint 1 — permanent performance baseline policy
// (Section 10). Full prose policy lives in
// docs/portfolio/P2_5_PERFORMANCE_BASELINE.md; this module is the
// machine-checkable half: the baseline schema, and the comparison
// function future sprints/CI can call against a freshly-measured
// `BenchmarkResult`.

export const BASELINE_SCHEMA_VERSION = 1;

/** Section 10's suggested thresholds — median degradation beyond these
 * percentages is a warning/failure respectively. Changing either requires
 * a documented justification in `P2_5_PERFORMANCE_BASELINE.md`, not a
 * silent edit here. */
export const REGRESSION_WARNING_THRESHOLD = 0.15;
export const REGRESSION_FAILURE_THRESHOLD = 0.3;

export interface BaselineMetric {
  /** Stable identity for one benchmark case, e.g. "bulk-assign-1000". */
  benchmarkName: string;
  /** Stable identity for the dataset scale/shape the metric was measured
   * against, e.g. "small-1000x100" — comparisons across different
   * dataset identities are meaningless and must be refused. */
  datasetIdentity: string;
  metricUnit: 'ms' | 'ops_per_sec';
  medianValue: number;
  p95Value: number | null;
  /** Free-text environment fingerprint (Node version + platform + CPU
   * model) — see `benchmarkRunner.ts`'s `EnvironmentMetadata`. Two
   * environments are "comparable" only when this string matches exactly;
   * Section 10 explicitly forbids comparing across materially different
   * environments. */
  environmentDescription: string;
  recordedAt: number;
}

export interface PerformanceBaseline {
  schemaVersion: number;
  metrics: BaselineMetric[];
}

export function emptyBaseline(): PerformanceBaseline {
  return { schemaVersion: BASELINE_SCHEMA_VERSION, metrics: [] };
}

export function environmentDescription(env: { nodeVersion: string; platform: string; arch: string; cpuModel: string | null }): string {
  return `${env.nodeVersion} | ${env.platform}/${env.arch} | ${env.cpuModel ?? 'unknown-cpu'}`;
}

export type ComparisonVerdict = 'ok' | 'warning' | 'failure' | 'non_comparable' | 'no_baseline';

export interface ComparisonResult {
  benchmarkName: string;
  verdict: ComparisonVerdict;
  baselineMedianMs: number | null;
  currentMedianMs: number;
  percentChange: number | null;
  reason: string;
}

export interface CurrentMeasurement {
  benchmarkName: string;
  datasetIdentity: string;
  medianMs: number;
  environmentDescription: string;
}

/** Compares one freshly-measured result against the stored baseline for
 * the same `benchmarkName` + `datasetIdentity`. Never fabricates a
 * verdict across incomparable environments/datasets — those return
 * `non_comparable` with a stated reason instead of a misleading
 * pass/fail (Section 10: "environment comparability rules"). */
export function compareToBaseline(baseline: PerformanceBaseline, current: CurrentMeasurement): ComparisonResult {
  const match = baseline.metrics.find((m) => m.benchmarkName === current.benchmarkName && m.datasetIdentity === current.datasetIdentity);
  if (!match) {
    return {
      benchmarkName: current.benchmarkName,
      verdict: 'no_baseline',
      baselineMedianMs: null,
      currentMedianMs: current.medianMs,
      percentChange: null,
      reason: `No stored baseline for "${current.benchmarkName}" @ "${current.datasetIdentity}" yet.`,
    };
  }
  if (match.environmentDescription !== current.environmentDescription) {
    return {
      benchmarkName: current.benchmarkName,
      verdict: 'non_comparable',
      baselineMedianMs: match.medianValue,
      currentMedianMs: current.medianMs,
      percentChange: null,
      reason: `Baseline was recorded on a different environment ("${match.environmentDescription}" vs "${current.environmentDescription}") — not compared.`,
    };
  }
  const percentChange = match.medianValue > 0 ? (current.medianMs - match.medianValue) / match.medianValue : 0;
  let verdict: ComparisonVerdict = 'ok';
  let reason = `Median changed by ${(percentChange * 100).toFixed(1)}% (within the ${(REGRESSION_WARNING_THRESHOLD * 100).toFixed(0)}% warning threshold).`;
  if (percentChange >= REGRESSION_FAILURE_THRESHOLD) {
    verdict = 'failure';
    reason = `Median degraded ${(percentChange * 100).toFixed(1)}% — at/above the ${(REGRESSION_FAILURE_THRESHOLD * 100).toFixed(0)}% failure threshold.`;
  } else if (percentChange >= REGRESSION_WARNING_THRESHOLD) {
    verdict = 'warning';
    reason = `Median degraded ${(percentChange * 100).toFixed(1)}% — at/above the ${(REGRESSION_WARNING_THRESHOLD * 100).toFixed(0)}% warning threshold.`;
  }
  return { benchmarkName: current.benchmarkName, verdict, baselineMedianMs: match.medianValue, currentMedianMs: current.medianMs, percentChange, reason };
}

/** Section 10's "prohibition against silently replacing a worse
 * baseline": refuses to write a new baseline entry over an existing one
 * unless the caller explicitly acknowledges the comparison verdict via
 * `force`, or the new measurement is not a regression (`ok`). Same
 * dataset-identity + environment-mismatch rules as `compareToBaseline`
 * apply — an incomparable measurement is always allowed through (there is
 * nothing valid to protect against replacing). */
export function upsertBaselineMetric(
  baseline: PerformanceBaseline,
  metric: BaselineMetric,
  options: { force?: boolean } = {},
): { baseline: PerformanceBaseline; verdict: ComparisonVerdict; reason: string } {
  const comparison = compareToBaseline(baseline, {
    benchmarkName: metric.benchmarkName,
    datasetIdentity: metric.datasetIdentity,
    medianMs: metric.medianValue,
    environmentDescription: metric.environmentDescription,
  });
  if ((comparison.verdict === 'warning' || comparison.verdict === 'failure') && !options.force) {
    return { baseline, verdict: comparison.verdict, reason: `Refused to update baseline: ${comparison.reason} Pass { force: true } to override deliberately.` };
  }
  const metrics = baseline.metrics.filter((m) => !(m.benchmarkName === metric.benchmarkName && m.datasetIdentity === metric.datasetIdentity));
  metrics.push(metric);
  return { baseline: { ...baseline, metrics }, verdict: comparison.verdict, reason: comparison.reason };
}
