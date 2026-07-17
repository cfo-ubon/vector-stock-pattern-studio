import { describe, it, expect } from 'vitest';
import { sampleMemory, MemorySampler, trackBlobUrlLifecycle } from './memoryInstrumentation';

describe('sampleMemory', () => {
  it('reports a supported sample under Node (this test always runs under real Node)', () => {
    const sample = sampleMemory();
    expect(sample.supported).toBe(true);
    expect(['browser-performance-memory', 'node-process']).toContain(sample.source);
    expect(sample.heapUsedBytes).toBeGreaterThan(0);
  });
});

describe('MemorySampler', () => {
  it('captures baseline/peak/final and computes a delta across repeated samples', () => {
    const sampler = new MemorySampler();
    sampler.sample();
    sampler.sample();
    sampler.sample();
    const summary = sampler.summarize();
    expect(summary.sampleCount).toBe(3);
    expect(summary.supported).toBe(true);
    expect(summary.deltaHeapUsedBytes).not.toBeNull();
    expect(summary.baseline).toBe(sampler.all[0]);
    expect(summary.final).toBe(sampler.all[2]);
  });

  it('throws a clear error when summarized with zero samples, rather than fabricating one', () => {
    const sampler = new MemorySampler();
    expect(() => sampler.summarize()).toThrow(/zero samples/);
  });
});

describe('trackBlobUrlLifecycle', () => {
  it('counts create/revoke calls without altering their return value or behavior', () => {
    const tracker = trackBlobUrlLifecycle();
    try {
      const blob = new Blob(['hello'], { type: 'text/plain' });
      const url1 = URL.createObjectURL(blob);
      const url2 = URL.createObjectURL(blob);
      expect(tracker.createdCount).toBe(2);
      expect(tracker.outstanding).toBe(2);
      URL.revokeObjectURL(url1);
      expect(tracker.revokedCount).toBe(1);
      expect(tracker.outstanding).toBe(1);
      URL.revokeObjectURL(url2);
      expect(tracker.outstanding).toBe(0);
    } finally {
      tracker.restore();
    }
  });

  it('restore() puts the original functions back', () => {
    const originalCreate = URL.createObjectURL;
    const tracker = trackBlobUrlLifecycle();
    expect(URL.createObjectURL).not.toBe(originalCreate);
    tracker.restore();
    expect(URL.createObjectURL).toBe(originalCreate);
  });
});
