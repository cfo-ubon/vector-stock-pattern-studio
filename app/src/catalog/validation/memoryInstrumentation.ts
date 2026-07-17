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
