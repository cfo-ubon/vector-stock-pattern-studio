import { describe, it, expect } from 'vitest';
import { analyzeMemoryTrend, MIN_TREND_SAMPLES } from './memoryInstrumentation';
import type { MemorySample } from './memoryInstrumentation';

function sample(heapUsedBytes: number, index: number): MemorySample {
  return { supported: true, source: 'node-process', timestamp: 1_700_000_000_000 + index * 1000, heapUsedBytes, heapTotalBytes: heapUsedBytes * 2, rssBytes: heapUsedBytes * 3 };
}

function unsupportedSample(index: number): MemorySample {
  return { supported: false, source: 'unsupported', timestamp: 1_700_000_000_000 + index * 1000, heapUsedBytes: null, heapTotalBytes: null, rssBytes: null };
}

describe('analyzeMemoryTrend', () => {
  it('reports insufficient_samples below the minimum threshold', () => {
    const samples = Array.from({ length: MIN_TREND_SAMPLES - 1 }, (_, i) => sample(1000, i));
    const result = analyzeMemoryTrend(samples);
    expect(result.classification).toBe('insufficient_samples');
  });

  it('reports unsupported when any sample lacks support', () => {
    const samples = [...Array.from({ length: 15 }, (_, i) => sample(1000, i)), unsupportedSample(15)];
    const result = analyzeMemoryTrend(samples);
    expect(result.classification).toBe('unsupported');
  });

  it('classifies a flat series as plateau', () => {
    const samples = Array.from({ length: 30 }, (_, i) => sample(1_000_000 + (i % 2) * 500, i));
    const result = analyzeMemoryTrend(samples);
    expect(result.classification).toBe('plateau');
    expect(result.plateauDetected).toBe(true);
  });

  it('classifies a steadily-climbing series as growth', () => {
    const samples = Array.from({ length: 30 }, (_, i) => sample(1_000_000 + i * 50_000, i));
    const result = analyzeMemoryTrend(samples);
    expect(result.classification).toBe('growth');
    expect(result.slopeBytesPerSample).toBeGreaterThan(0);
    expect(result.plateauDetected).toBe(false);
  });

  it('detects a plateau even after early growth, once the late window flattens', () => {
    // Rises for the first 20 samples, then holds steady for the last 10 —
    // the late-window flatness check should catch this even though the
    // overall regression slope across all 30 points is still positive.
    const rising = Array.from({ length: 20 }, (_, i) => sample(1_000_000 + i * 100_000, i));
    const flat = Array.from({ length: 10 }, (_, i) => sample(3_000_000 + (i % 2) * 1000, 20 + i));
    const result = analyzeMemoryTrend([...rising, ...flat]);
    expect(result.plateauDetected).toBe(true);
    expect(result.classification).toBe('plateau');
  });

  it('reports early/late window means', () => {
    const samples = Array.from({ length: 20 }, (_, i) => sample(1_000_000 + i * 10_000, i));
    const result = analyzeMemoryTrend(samples);
    expect(result.earlyWindowMeanBytes).toBeLessThan(result.lateWindowMeanBytes!);
  });

  it('computes a per-second slope from real timestamps', () => {
    const samples = Array.from({ length: 15 }, (_, i) => sample(1_000_000 + i * 10_000, i));
    const result = analyzeMemoryTrend(samples);
    expect(result.slopeBytesPerSecond).not.toBeNull();
    expect(result.slopeBytesPerSecond).toBeGreaterThan(0);
  });
});
