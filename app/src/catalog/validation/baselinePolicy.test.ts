import { describe, it, expect } from 'vitest';
import { compareToBaseline, upsertBaselineMetric, emptyBaseline, environmentDescription } from './baselinePolicy';
import type { PerformanceBaseline, BaselineMetric } from './baselinePolicy';

const ENV = 'v22.0.0 | linux/x64 | Test CPU';

function makeMetric(overrides: Partial<BaselineMetric> = {}): BaselineMetric {
  return {
    benchmarkName: 'bulk-assign-1000',
    datasetIdentity: 'small-1000x100',
    metricUnit: 'ms',
    medianValue: 100,
    p95Value: 120,
    environmentDescription: ENV,
    recordedAt: 1700000000000,
    ...overrides,
  };
}

function baselineWith(metric: BaselineMetric): PerformanceBaseline {
  return { schemaVersion: 1, metrics: [metric] };
}

describe('compareToBaseline', () => {
  it('reports no_baseline when nothing is stored yet', () => {
    const result = compareToBaseline(emptyBaseline(), {
      benchmarkName: 'x',
      datasetIdentity: 'y',
      medianMs: 10,
      environmentDescription: ENV,
    });
    expect(result.verdict).toBe('no_baseline');
  });

  it('reports ok when the median is within the warning threshold', () => {
    const baseline = baselineWith(makeMetric({ medianValue: 100 }));
    const result = compareToBaseline(baseline, { benchmarkName: 'bulk-assign-1000', datasetIdentity: 'small-1000x100', medianMs: 105, environmentDescription: ENV });
    expect(result.verdict).toBe('ok');
  });

  it('reports warning at/above the 15% threshold', () => {
    const baseline = baselineWith(makeMetric({ medianValue: 100 }));
    const result = compareToBaseline(baseline, { benchmarkName: 'bulk-assign-1000', datasetIdentity: 'small-1000x100', medianMs: 116, environmentDescription: ENV });
    expect(result.verdict).toBe('warning');
  });

  it('reports failure at/above the 30% threshold', () => {
    const baseline = baselineWith(makeMetric({ medianValue: 100 }));
    const result = compareToBaseline(baseline, { benchmarkName: 'bulk-assign-1000', datasetIdentity: 'small-1000x100', medianMs: 131, environmentDescription: ENV });
    expect(result.verdict).toBe('failure');
  });

  it('reports non_comparable across different environments, never a fabricated verdict', () => {
    const baseline = baselineWith(makeMetric({ environmentDescription: ENV }));
    const result = compareToBaseline(baseline, {
      benchmarkName: 'bulk-assign-1000',
      datasetIdentity: 'small-1000x100',
      medianMs: 1000, // wildly different, would otherwise be "failure"
      environmentDescription: 'v18.0.0 | darwin/arm64 | Other CPU',
    });
    expect(result.verdict).toBe('non_comparable');
  });

  it('a faster (improved) median is still ok, never flagged as a regression', () => {
    const baseline = baselineWith(makeMetric({ medianValue: 100 }));
    const result = compareToBaseline(baseline, { benchmarkName: 'bulk-assign-1000', datasetIdentity: 'small-1000x100', medianMs: 50, environmentDescription: ENV });
    expect(result.verdict).toBe('ok');
  });
});

describe('upsertBaselineMetric', () => {
  it('accepts a new metric with no prior baseline', () => {
    const { baseline, verdict } = upsertBaselineMetric(emptyBaseline(), makeMetric());
    expect(verdict).toBe('no_baseline');
    expect(baseline.metrics).toHaveLength(1);
  });

  it('refuses to silently replace a baseline with a worse (regressed) one', () => {
    const existing = baselineWith(makeMetric({ medianValue: 100 }));
    const worse = makeMetric({ medianValue: 200 }); // +100%, well past failure threshold
    const { baseline, verdict, reason } = upsertBaselineMetric(existing, worse);
    expect(verdict).toBe('failure');
    expect(baseline.metrics[0].medianValue).toBe(100); // unchanged
    expect(reason).toMatch(/Refused/);
  });

  it('allows replacing with a worse baseline when force is true', () => {
    const existing = baselineWith(makeMetric({ medianValue: 100 }));
    const worse = makeMetric({ medianValue: 200 });
    const { baseline } = upsertBaselineMetric(existing, worse, { force: true });
    expect(baseline.metrics[0].medianValue).toBe(200);
  });

  it('allows replacing with an improved measurement without force', () => {
    const existing = baselineWith(makeMetric({ medianValue: 100 }));
    const better = makeMetric({ medianValue: 80 });
    const { baseline, verdict } = upsertBaselineMetric(existing, better);
    expect(verdict).toBe('ok');
    expect(baseline.metrics[0].medianValue).toBe(80);
  });
});

describe('environmentDescription', () => {
  it('produces a stable, human-readable fingerprint', () => {
    const desc = environmentDescription({ nodeVersion: 'v22.0.0', platform: 'linux', arch: 'x64', cpuModel: 'Test CPU' });
    expect(desc).toBe('v22.0.0 | linux/x64 | Test CPU');
  });

  it('falls back to a placeholder when cpuModel is null', () => {
    const desc = environmentDescription({ nodeVersion: 'v22.0.0', platform: 'linux', arch: 'x64', cpuModel: null });
    expect(desc).toContain('unknown-cpu');
  });
});
