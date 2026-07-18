import { describe, it, expect } from 'vitest';
import { computeLatencyDrift, MIN_SAMPLES_FOR_DRIFT } from './latencyDrift';

function flatSamples(n: number, value: number): number[] {
  return Array.from({ length: n }, () => value);
}

describe('computeLatencyDrift', () => {
  it('reports insufficient_samples below the minimum sample threshold', () => {
    const result = computeLatencyDrift(flatSamples(MIN_SAMPLES_FOR_DRIFT - 1, 10), 'op');
    expect(result.classification).toBe('insufficient_samples');
    expect(result.driftPercent).toBeNull();
  });

  it('classifies stable when the final window is close to the initial window', () => {
    // 100 samples all ~10ms with tiny jitter -> drift near 0%.
    const samples = Array.from({ length: 100 }, (_, i) => 10 + (i % 3) * 0.1);
    const result = computeLatencyDrift(samples, 'op');
    expect(result.classification).toBe('stable');
  });

  it('classifies warning when the final median is ~20% higher than the initial median', () => {
    const initial = flatSamples(20, 10);
    const middle = flatSamples(60, 11);
    const final = flatSamples(20, 12); // +20% over initial
    const result = computeLatencyDrift([...initial, ...middle, ...final], 'op');
    expect(result.classification).toBe('warning');
  });

  it('classifies failure when the final median is >30% higher than the initial median', () => {
    const initial = flatSamples(20, 10);
    const middle = flatSamples(60, 15);
    const final = flatSamples(20, 20); // +100% over initial
    const result = computeLatencyDrift([...initial, ...middle, ...final], 'op');
    expect(result.classification).toBe('failure');
  });

  it('a single isolated outlier in the final window does not alone flip classification to failure', () => {
    // Final window: 19 samples at 10ms (no drift) + 1 huge outlier.
    const initial = flatSamples(20, 10);
    const middle = flatSamples(60, 10);
    const final = [...flatSamples(19, 10), 5000];
    const result = computeLatencyDrift([...initial, ...middle, ...final], 'op');
    // Median is robust to the single outlier -> still stable by median.
    expect(result.classification).toBe('stable');
  });

  it('flags p95 investigation independently of the median-driven classification', () => {
    // 220 total samples so every 10% window (22 samples) clears
    // benchmarkRunner.ts's own 20-sample p95 threshold. Final window: 20
    // samples at 10ms + 2 outliers at 500ms — enough to spike p95 (index
    // 20 of 22 sorted) without moving the median (indices 10/11, both 10ms).
    const initial = Array.from({ length: 60 }, () => 10);
    const middle = Array.from({ length: 138 }, () => 10);
    const final = [...Array.from({ length: 20 }, () => 10), 500, 500];
    const result = computeLatencyDrift([...initial, ...middle, ...final], 'op');
    expect(result.classification).toBe('stable');
    expect(result.p95InvestigationNeeded).toBe(true);
  });

  it('computes initial/final windows as roughly the first/last 10% of samples', () => {
    const samples = Array.from({ length: 100 }, (_, i) => i); // 0..99
    const result = computeLatencyDrift(samples, 'op');
    expect(result.initialWindow!.count).toBe(10);
    expect(result.finalWindow!.count).toBe(10);
    expect(result.initialMedianMs).toBeLessThan(result.finalMedianMs!);
  });
});
