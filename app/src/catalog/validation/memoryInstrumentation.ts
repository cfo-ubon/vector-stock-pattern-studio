// Portfolio Manager P2.5 Sprint 1 — memory-instrumentation foundation
// (Section 8). This module only measures and reports; it establishes the
// adapter and proves it works via a bounded smoke test elsewhere
// (`useCollectionCoverUrl.memorySmoke.test.tsx`). It does NOT claim "no
// memory leak" — that would require a real soak test, explicitly out of
// scope for Sprint 1 (the brief's own instruction).

export type MemorySampleSource = 'browser-performance-memory' | 'node-process' | 'unsupported';

export interface MemorySample {
  supported: boolean;
  source: MemorySampleSource;
  timestamp: number;
  /** JS heap actually in use. `null` when unsupported. */
  heapUsedBytes: number | null;
  /** Total heap currently allocated (not necessarily in use). `null` when
   * unsupported or not reported by this source. */
  heapTotalBytes: number | null;
  /** Resident set size — Node only. `null` on every other source. */
  rssBytes: number | null;
}

/** Real `performance.memory` typing exists only in Chromium — declared
 * locally rather than widening the global `Performance` type app-wide. */
interface ChromiumMemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
}

function readChromiumMemory(): ChromiumMemoryInfo | null {
  const perf = globalThis.performance as (Performance & { memory?: ChromiumMemoryInfo }) | undefined;
  return perf?.memory ?? null;
}

export function sampleMemory(): MemorySample {
  const timestamp = Date.now();
  const chromium = readChromiumMemory();
  if (chromium) {
    return {
      supported: true,
      source: 'browser-performance-memory',
      timestamp,
      heapUsedBytes: chromium.usedJSHeapSize,
      heapTotalBytes: chromium.totalJSHeapSize,
      rssBytes: null,
    };
  }
  if (typeof process !== 'undefined' && typeof process.memoryUsage === 'function') {
    const mem = process.memoryUsage();
    return {
      supported: true,
      source: 'node-process',
      timestamp,
      heapUsedBytes: mem.heapUsed,
      heapTotalBytes: mem.heapTotal,
      rssBytes: mem.rss,
    };
  }
  return { supported: false, source: 'unsupported', timestamp, heapUsedBytes: null, heapTotalBytes: null, rssBytes: null };
}

export interface MemorySamplerSummary {
  supported: boolean;
  sampleCount: number;
  baseline: MemorySample;
  peak: MemorySample;
  final: MemorySample;
  /** `final.heapUsedBytes - baseline.heapUsedBytes`. `null` when
   * unsupported — never a fabricated 0. */
  deltaHeapUsedBytes: number | null;
}

/** Repeated-sample capture (Section 8's "repeated sample capture, baseline
 * sample, peak sample, final sample, delta calculation"). Call `.sample()`
 * at each point of interest during a bounded run, then `.summarize()`. */
export class MemorySampler {
  private samples: MemorySample[] = [];

  sample(): MemorySample {
    const s = sampleMemory();
    this.samples.push(s);
    return s;
  }

  get all(): readonly MemorySample[] {
    return this.samples;
  }

  summarize(): MemorySamplerSummary {
    if (this.samples.length === 0) throw new Error('MemorySampler.summarize() called with zero samples — call .sample() at least once first.');
    const baseline = this.samples[0];
    const final = this.samples[this.samples.length - 1];
    const supported = this.samples.every((s) => s.supported);
    let peak = baseline;
    if (supported) {
      for (const s of this.samples) {
        if ((s.heapUsedBytes ?? 0) > (peak.heapUsedBytes ?? 0)) peak = s;
      }
    }
    return {
      supported,
      sampleCount: this.samples.length,
      baseline,
      peak,
      final,
      deltaHeapUsedBytes: supported && baseline.heapUsedBytes !== null && final.heapUsedBytes !== null ? final.heapUsedBytes - baseline.heapUsedBytes : null,
    };
  }
}

export interface BlobUrlLifecycleTracker {
  readonly createdCount: number;
  readonly revokedCount: number;
  readonly outstanding: number;
  restore: () => void;
}

/** Monkey-patches the global `URL.createObjectURL`/`URL.revokeObjectURL`
 * to count calls, then restores the originals via `.restore()`. Framework-
 * agnostic (no dependency on vitest's `vi.spyOn`) so it works the same way
 * under a vitest/jsdom test or, in principle, a real browser console.
 * Never touches any production hook's source (`usePreviewUrl.ts`,
 * `useCollectionCoverUrl.ts` are unmodified) — this observes calls those
 * hooks make through the global, exactly as any external profiler would. */
export function trackBlobUrlLifecycle(): BlobUrlLifecycleTracker {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function' || typeof URL.revokeObjectURL !== 'function') {
    return { createdCount: 0, revokedCount: 0, outstanding: 0, restore: () => {} };
  }
  // Deliberately NOT `.bind()`-ed: a bound wrapper is a distinct function
  // object from the original, so restoring it later would leave
  // `URL.createObjectURL` pointing at a bound copy rather than the exact
  // original reference a caller may have captured for comparison
  // (`Reflect.apply` below calls the unbound original correctly without
  // needing to bind it first).
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  let createdCount = 0;
  let revokedCount = 0;

  URL.createObjectURL = ((obj: Blob | MediaSource) => {
    createdCount++;
    return Reflect.apply(originalCreate, URL, [obj]);
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = ((url: string) => {
    revokedCount++;
    return Reflect.apply(originalRevoke, URL, [url]);
  }) as typeof URL.revokeObjectURL;

  return {
    get createdCount() {
      return createdCount;
    },
    get revokedCount() {
      return revokedCount;
    },
    get outstanding() {
      return createdCount - revokedCount;
    },
    restore: () => {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    },
  } as BlobUrlLifecycleTracker;
}

// ---------------------------------------------------------------------
// Portfolio Manager P2.5 Sprint 2 — memory trend analysis (Section 6).
// Additive to the Sprint 1 foundation above: takes a series of samples
// collected over a soak run (via `MemorySampler`/`sampleMemory`) and
// reports whether heap usage grew, plateaued, or is inconclusive — never
// a bare "no leak" verdict, only a description scoped to the samples
// actually collected.
// ---------------------------------------------------------------------

/** Below this many samples, a trend line is not a meaningful statistic. */
export const MIN_TREND_SAMPLES = 10;

/** A late-window internal variation below this fraction of its own mean
 * is treated as "flat" (plateaued) rather than still climbing. */
export const PLATEAU_FLATNESS_THRESHOLD = 0.05;

/** Slope below this fraction of the baseline heap, per sample, is not
 * considered meaningful growth — avoids flagging normal GC-driven noise
 * as "growth" from a slope that is technically nonzero but negligible. */
export const GROWTH_SLOPE_THRESHOLD_FRACTION = 0.01;

export type MemoryTrendClassification = 'plateau' | 'growth' | 'insufficient_samples' | 'unsupported';

export interface MemoryTrendAnalysis {
  sampleCount: number;
  classification: MemoryTrendClassification;
  /** Least-squares linear regression slope of `heapUsedBytes` against
   * sample index. `null` when unsupported/insufficient. */
  slopeBytesPerSample: number | null;
  /** Same slope expressed per second of wall-clock time spanned by the
   * samples, when timestamps allow it. */
  slopeBytesPerSecond: number | null;
  earlyWindowMeanBytes: number | null;
  lateWindowMeanBytes: number | null;
  /** True when the late window's own second half is close to its first
   * half (see `PLATEAU_FLATNESS_THRESHOLD`) — i.e. growth (if any)
   * appears to have leveled off by the end of the sampled period. */
  plateauDetected: boolean;
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Ordinary least squares slope of `y` against index `0..n-1`. */
function linearRegressionSlope(y: number[]): number {
  const n = y.length;
  const xMean = (n - 1) / 2;
  const yMean = mean(y);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (y[i] - yMean);
    den += (i - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/** Analyzes a chronologically-ordered series of memory samples (as
 * collected by repeated `MemorySampler.sample()`/`sampleMemory()` calls
 * during a soak run) for a growth trend. Never asserts "no leak" —
 * callers must scope any prose claim to the actual sample count/duration
 * (see `docs/portfolio/P2_5_MEMORY_REPORT.md`'s wording policy). */
export function analyzeMemoryTrend(samples: MemorySample[]): MemoryTrendAnalysis {
  const sampleCount = samples.length;
  const empty = (classification: MemoryTrendClassification): MemoryTrendAnalysis => ({
    sampleCount,
    classification,
    slopeBytesPerSample: null,
    slopeBytesPerSecond: null,
    earlyWindowMeanBytes: null,
    lateWindowMeanBytes: null,
    plateauDetected: false,
  });

  if (samples.some((s) => !s.supported || s.heapUsedBytes === null)) return empty('unsupported');
  if (sampleCount < MIN_TREND_SAMPLES) return empty('insufficient_samples');

  const heapValues = samples.map((s) => s.heapUsedBytes as number);
  const slopeBytesPerSample = linearRegressionSlope(heapValues);
  const totalSeconds = (samples[sampleCount - 1].timestamp - samples[0].timestamp) / 1000;
  const slopeBytesPerSecond = totalSeconds > 0 ? (slopeBytesPerSample * (sampleCount - 1)) / totalSeconds : null;

  const earlyCount = Math.max(1, Math.floor(sampleCount * 0.2));
  const lateCount = Math.max(1, Math.floor(sampleCount * 0.2));
  const earlyWindow = heapValues.slice(0, earlyCount);
  const lateWindow = heapValues.slice(sampleCount - lateCount);
  const earlyWindowMeanBytes = mean(earlyWindow);
  const lateWindowMeanBytes = mean(lateWindow);

  let plateauDetected = true;
  if (lateWindow.length >= 4) {
    const half = Math.floor(lateWindow.length / 2);
    const firstHalfMean = mean(lateWindow.slice(0, half));
    const secondHalfMean = mean(lateWindow.slice(half));
    const base = Math.max(1, firstHalfMean);
    plateauDetected = Math.abs(secondHalfMean - firstHalfMean) / base <= PLATEAU_FLATNESS_THRESHOLD;
  }

  const baseline = Math.max(1, heapValues[0]);
  const meaningfulGrowth = slopeBytesPerSample > baseline * GROWTH_SLOPE_THRESHOLD_FRACTION;
  const classification: MemoryTrendClassification = meaningfulGrowth && !plateauDetected ? 'growth' : 'plateau';

  return {
    sampleCount,
    classification,
    slopeBytesPerSample,
    slopeBytesPerSecond,
    earlyWindowMeanBytes,
    lateWindowMeanBytes,
    plateauDetected,
  };
}
