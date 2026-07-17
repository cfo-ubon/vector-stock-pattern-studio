import * as os from 'node:os';

// Portfolio Manager P2.5 Sprint 1 — reusable benchmark runner (Section 5).
// Pure, dependency-free (no IndexedDB, no React) — a `BenchmarkCase` is
// just a name plus an async function; the runner handles warm-up,
// timing, statistics, and timeout/error handling around it, for both the
// pure-generator benchmarks and the storage/service benchmarks built on
// top of `validationDb.ts`.

export interface BenchmarkCase {
  name: string;
  category: string;
  /** One iteration of the work being measured. May return a value (e.g.
   * a result count) purely for the caller's own assertions — the runner
   * itself only measures wall-clock time and success/failure. */
  run: () => Promise<unknown> | unknown;
  /** Iterations run and discarded before measurement starts. Default 1. */
  warmupIterations?: number;
  /** Iterations actually measured. Default 5. */
  measuredIterations?: number;
  /** Per-iteration timeout in ms. Default 30000. */
  timeoutMs?: number;
}

export interface BenchmarkStats {
  count: number;
  minMs: number;
  maxMs: number;
  meanMs: number;
  medianMs: number;
  /** `null` when there are fewer than 20 samples — p95 over a tiny
   * sample is not a meaningful statistic (Section 5's "where sample
   * count permits"). */
  p95Ms: number | null;
  /** `null` below 100 samples, matching `p95Ms`'s rationale but at the
   * tighter threshold p99 needs to mean anything. */
  p99Ms: number | null;
  /** `null` for a single-sample run — standard deviation of one number
   * is not meaningful. */
  stdDevMs: number | null;
  opsPerSec: number | null;
}

export interface BenchmarkResult {
  name: string;
  category: string;
  status: 'success' | 'failure' | 'timeout';
  warmupIterations: number;
  measuredIterations: number;
  stats: BenchmarkStats | null;
  /** Present only on failure/timeout — deliberately just `message`, never
   * `error.stack` (Section 5: "error details without stack traces in
   * normal summaries"). */
  error: string | null;
  samplesMs: number[];
}

export interface EnvironmentMetadata {
  nodeVersion: string;
  platform: string;
  arch: string;
  cpuCount: number | null;
  cpuModel: string | null;
  totalMemoryBytes: number | null;
  timestamp: number;
}

export interface BenchmarkReport {
  environment: EnvironmentMetadata;
  results: BenchmarkResult[];
  generatedAt: number;
}

/** Exported (Sprint 2) so `latencyDrift.ts` can reuse the exact same
 * statistics definition for its initial/middle/final windows instead of
 * a second, potentially-drifting implementation. Purely additive —
 * every existing caller of this module is unaffected. */
export function computeStats(samplesMs: number[]): BenchmarkStats {
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / count;
  const median = count % 2 === 1 ? sorted[(count - 1) / 2] : (sorted[count / 2 - 1] + sorted[count / 2]) / 2;
  const percentile = (p: number): number => {
    const idx = Math.min(count - 1, Math.floor((p / 100) * count));
    return sorted[idx];
  };
  const variance = count > 1 ? sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (count - 1) : null;
  return {
    count,
    minMs: sorted[0],
    maxMs: sorted[count - 1],
    meanMs: mean,
    medianMs: median,
    p95Ms: count >= 20 ? percentile(95) : null,
    p99Ms: count >= 100 ? percentile(99) : null,
    stdDevMs: variance !== null ? Math.sqrt(variance) : null,
    opsPerSec: mean > 0 ? 1000 / mean : null,
  };
}

async function withTimeout<T>(fn: () => Promise<T> | T, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Benchmark iteration exceeded its ${timeoutMs}ms timeout.`)), timeoutMs);
    Promise.resolve()
      .then(fn)
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export function collectEnvironmentMetadata(): EnvironmentMetadata {
  const nodeVersion = typeof process !== 'undefined' ? process.version : 'unknown';
  const platform = typeof process !== 'undefined' ? process.platform : 'unknown';
  const arch = typeof process !== 'undefined' ? process.arch : 'unknown';
  let cpuCount: number | null = null;
  let cpuModel: string | null = null;
  let totalMemoryBytes: number | null = null;
  try {
    // Guarded even though `node:os` is a static import: every actual
    // caller of this validation tooling runs under real Node (the CLI
    // via `tsx`, or vitest — jsdom emulates browser globals but still
    // runs on a real Node process underneath), so `os.cpus()` always
    // works today. The guard exists purely so a future non-Node runner
    // degrades to nulls instead of throwing (Section 6/8's "clear
    // unsupported status rather than fabricated values").
    const cpus = os.cpus();
    cpuCount = cpus.length;
    cpuModel = cpus[0]?.model ?? null;
    totalMemoryBytes = os.totalmem();
  } catch {
    // Leave nulls — see comment above.
  }
  return { nodeVersion, platform, arch, cpuCount, cpuModel, totalMemoryBytes, timestamp: Date.now() };
}

export async function runBenchmarkCase(testCase: BenchmarkCase): Promise<BenchmarkResult> {
  const warmupIterations = testCase.warmupIterations ?? 1;
  const measuredIterations = testCase.measuredIterations ?? 5;
  const timeoutMs = testCase.timeoutMs ?? 30000;

  for (let i = 0; i < warmupIterations; i++) {
    try {
      await withTimeout(testCase.run, timeoutMs);
    } catch {
      // A failing warm-up iteration is not itself reported — only
      // measured iterations count toward success/failure, matching
      // "warm-up excluded from measurements" (Section 5/11). If every
      // measured iteration also fails, that failure is what surfaces.
    }
  }

  const samplesMs: number[] = [];
  for (let i = 0; i < measuredIterations; i++) {
    const start = performance.now();
    try {
      await withTimeout(testCase.run, timeoutMs);
    } catch (err) {
      const isTimeout = err instanceof Error && err.message.includes('exceeded its');
      return {
        name: testCase.name,
        category: testCase.category,
        status: isTimeout ? 'timeout' : 'failure',
        warmupIterations,
        measuredIterations,
        stats: samplesMs.length > 0 ? computeStats(samplesMs) : null,
        error: err instanceof Error ? err.message : String(err),
        samplesMs,
      };
    }
    samplesMs.push(performance.now() - start);
  }

  return {
    name: testCase.name,
    category: testCase.category,
    status: 'success',
    warmupIterations,
    measuredIterations,
    stats: computeStats(samplesMs),
    error: null,
    samplesMs,
  };
}

export async function runBenchmarkSuite(cases: BenchmarkCase[]): Promise<BenchmarkReport> {
  const results: BenchmarkResult[] = [];
  for (const testCase of cases) {
    results.push(await runBenchmarkCase(testCase));
  }
  return { environment: collectEnvironmentMetadata(), results, generatedAt: Date.now() };
}
