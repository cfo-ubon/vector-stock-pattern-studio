import { computeStats } from './benchmarkRunner';
import type { BenchmarkStats } from './benchmarkRunner';

// Portfolio Manager P2.5 Sprint 2 — latency drift analysis (Section 5).
// Splits a long, time-ordered series of per-operation latencies (as
// produced by the soak runner) into initial/middle/final 10% windows and
// reports whether the operation slowed down over the run. Reuses
// `benchmarkRunner.ts`'s exact `computeStats` — no second statistics
// implementation.

export type DriftClassification = 'stable' | 'warning' | 'failure' | 'insufficient_samples';

export const DRIFT_WARNING_THRESHOLD = 0.15;
export const DRIFT_FAILURE_THRESHOLD = 0.3;

/** Below this many total samples, a 10%-window split is too small to be
 * a meaningful statistic — report `insufficient_samples` rather than a
 * fabricated verdict. 30 samples means each 10% window has 3 samples
 * minimum, already a thin basis; this is a deliberately conservative
 * floor, not a hard scientific cutoff. */
export const MIN_SAMPLES_FOR_DRIFT = 30;

export interface LatencyDriftResult {
  operation: string;
  totalSamples: number;
  initialWindow: BenchmarkStats | null;
  middleWindow: BenchmarkStats | null;
  finalWindow: BenchmarkStats | null;
  initialMedianMs: number | null;
  finalMedianMs: number | null;
  /** `(finalMedian - initialMedian) / initialMedian`. `null` when there
   * aren't enough samples. */
  driftPercent: number | null;
  classification: DriftClassification;
  /** `(finalP95 - initialP95) / initialP95`, only when both windows have
   * enough samples for p95 to mean anything (20+, per
   * `benchmarkRunner.ts`'s own p95 threshold). `null` otherwise. */
  p95DriftPercent: number | null;
  /** Section 5: "Any p95 degradation above 30% must be investigated and
   * documented" — a standalone flag, independent of `classification`
   * (which is driven by the median, per "do not classify... solely from
   * one isolated outlier — use median and p95 together"). A p95-only
   * spike raises this flag without by itself failing the run. */
  p95InvestigationNeeded: boolean;
}

function windowStats(samples: number[], startFrac: number, endFrac: number): { stats: BenchmarkStats | null; window: number[] } {
  const start = Math.floor(samples.length * startFrac);
  const end = Math.ceil(samples.length * endFrac);
  const window = samples.slice(start, end);
  return { stats: window.length > 0 ? computeStats(window) : null, window };
}

/** `samplesMsInOrder` must already be in the chronological (cycle) order
 * they were measured — this function does not itself know which sample
 * came first, only the array position. */
export function computeLatencyDrift(samplesMsInOrder: number[], operation: string): LatencyDriftResult {
  const totalSamples = samplesMsInOrder.length;
  if (totalSamples < MIN_SAMPLES_FOR_DRIFT) {
    return {
      operation,
      totalSamples,
      initialWindow: null,
      middleWindow: null,
      finalWindow: null,
      initialMedianMs: null,
      finalMedianMs: null,
      driftPercent: null,
      classification: 'insufficient_samples',
      p95DriftPercent: null,
      p95InvestigationNeeded: false,
    };
  }

  const { stats: initialWindow } = windowStats(samplesMsInOrder, 0, 0.1);
  const { stats: middleWindow } = windowStats(samplesMsInOrder, 0.45, 0.55);
  const { stats: finalWindow } = windowStats(samplesMsInOrder, 0.9, 1.0);

  const initialMedianMs = initialWindow!.medianMs;
  const finalMedianMs = finalWindow!.medianMs;
  const driftPercent = initialMedianMs > 0 ? (finalMedianMs - initialMedianMs) / initialMedianMs : 0;

  let classification: DriftClassification = 'stable';
  if (driftPercent >= DRIFT_FAILURE_THRESHOLD) classification = 'failure';
  else if (driftPercent >= DRIFT_WARNING_THRESHOLD) classification = 'warning';

  let p95DriftPercent: number | null = null;
  let p95InvestigationNeeded = false;
  if (initialWindow!.p95Ms !== null && finalWindow!.p95Ms !== null && initialWindow!.p95Ms > 0) {
    p95DriftPercent = (finalWindow!.p95Ms - initialWindow!.p95Ms) / initialWindow!.p95Ms;
    p95InvestigationNeeded = p95DriftPercent > DRIFT_FAILURE_THRESHOLD;
  }

  return {
    operation,
    totalSamples,
    initialWindow,
    middleWindow,
    finalWindow,
    initialMedianMs,
    finalMedianMs,
    driftPercent,
    classification,
    p95DriftPercent,
    p95InvestigationNeeded,
  };
}
