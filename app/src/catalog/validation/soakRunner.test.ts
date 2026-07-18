import { describe, it, expect } from 'vitest';
import { runStressPlan, runSoak, latencySeriesFor } from './soakRunner';
import type { SoakOperationSpec, SoakCancelSignal } from './soakRunner';

function makeOps(overrides: Partial<Record<string, SoakOperationSpec['run']>> = {}): SoakOperationSpec[] {
  return [
    { name: 'searchCollections', weight: 3, run: overrides.searchCollections ?? (async () => {}) },
    { name: 'filterActive', weight: 2, run: overrides.filterActive ?? (async () => {}) },
    { name: 'bulkAssign', weight: 1, run: overrides.bulkAssign ?? (async () => {}) },
  ];
}

describe('runStressPlan — deterministic sequence', () => {
  it('produces the exact requested count for each operation', async () => {
    const result = await runStressPlan(makeOps(), { seed: 'stress-seed', targetCounts: { searchCollections: 5, filterActive: 3, bulkAssign: 2 } });
    expect(result.countsByOperation.searchCollections.success).toBe(5);
    expect(result.countsByOperation.filterActive.success).toBe(3);
    expect(result.countsByOperation.bulkAssign.success).toBe(2);
    expect(result.results).toHaveLength(10);
  });

  it('same seed produces the identical operation order', async () => {
    const config = { seed: 'fixed-seed', targetCounts: { searchCollections: 4, filterActive: 4 } };
    const a = await runStressPlan(makeOps(), config);
    const b = await runStressPlan(makeOps(), config);
    expect(a.results.map((r) => r.operation)).toEqual(b.results.map((r) => r.operation));
  });

  it('different seeds can produce a different operation order', async () => {
    const a = await runStressPlan(makeOps(), { seed: 'seed-a', targetCounts: { searchCollections: 5, filterActive: 5 } });
    const b = await runStressPlan(makeOps(), { seed: 'seed-b', targetCounts: { searchCollections: 5, filterActive: 5 } });
    expect(a.results.map((r) => r.operation)).not.toEqual(b.results.map((r) => r.operation));
  });
});

describe('runStressPlan — failure and timeout accounting', () => {
  it('counts thrown errors as failures, not successes', async () => {
    const ops = makeOps({ searchCollections: async () => { throw new Error('boom'); } });
    const result = await runStressPlan(ops, { seed: 's', targetCounts: { searchCollections: 3 } });
    expect(result.countsByOperation.searchCollections.failure).toBe(3);
    expect(result.countsByOperation.searchCollections.success).toBe(0);
    expect(result.results.every((r) => r.error === 'boom')).toBe(true);
  });

  it('counts a hung operation as a timeout, not a failure or success', async () => {
    const ops = makeOps({ searchCollections: () => new Promise(() => {}) });
    const result = await runStressPlan(ops, { seed: 's', targetCounts: { searchCollections: 1 }, operationTimeoutMs: 20 });
    expect(result.countsByOperation.searchCollections.timeout).toBe(1);
    expect(result.results[0].timedOut).toBe(true);
  }, 10000);
});

describe('runStressPlan — periodic sampling', () => {
  it('takes samples at the configured interval, including a final sample', async () => {
    const result = await runStressPlan(makeOps(), {
      seed: 's',
      targetCounts: { searchCollections: 20 },
      sampleEveryNOperations: 5,
    });
    expect(result.samples.length).toBeGreaterThanOrEqual(4); // 20/5 = 4 checkpoints
    expect(result.samples[result.samples.length - 1].atCycle).toBe(19); // last index
  });

  it('reports blob URL outstanding via the provided callback', async () => {
    let outstanding = 3;
    const result = await runStressPlan(makeOps(), {
      seed: 's',
      targetCounts: { searchCollections: 5 },
      sampleEveryNOperations: 1,
      blobUrlOutstandingProvider: () => outstanding,
    });
    expect(result.samples[0].blobUrlOutstanding).toBe(3);
  });
});

describe('runStressPlan — cancellation', () => {
  it('stops early and produces a partial result when signalled', async () => {
    const signal: SoakCancelSignal = { cancelled: false };
    let executed = 0;
    const ops = makeOps({
      searchCollections: async () => {
        executed++;
        if (executed === 3) signal.cancelled = true;
      },
    });
    const result = await runStressPlan(ops, { seed: 's', targetCounts: { searchCollections: 10 }, signal });
    expect(result.cancelled).toBe(true);
    expect(result.results.length).toBeLessThan(10);
    expect(result.results.length).toBeGreaterThan(0);
  });
});

describe('runSoak — duration-driven termination', () => {
  it('stops once the configured duration elapses', async () => {
    const result = await runSoak(makeOps(), { seed: 's', durationMs: 150, sampleIntervalMs: 50 });
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(150);
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.cancelled).toBe(false);
  });

  it('cancels cleanly mid-run and still returns partial results', async () => {
    const signal: SoakCancelSignal = { cancelled: false };
    setTimeout(() => {
      signal.cancelled = true;
    }, 40);
    // A tiny real macrotask delay per operation (instead of an
    // instantly-resolving promise) so the loop actually yields to the
    // event loop each cycle — otherwise an unbroken chain of microtask
    // resolutions can starve the cancellation timer above indefinitely.
    const slowOps = makeOps({
      searchCollections: () => new Promise((resolve) => setTimeout(resolve, 5)),
      filterActive: () => new Promise((resolve) => setTimeout(resolve, 5)),
      bulkAssign: () => new Promise((resolve) => setTimeout(resolve, 5)),
    });
    const result = await runSoak(slowOps, { seed: 's', durationMs: 5000, signal, sampleIntervalMs: 20 });
    expect(result.cancelled).toBe(true);
    expect(result.totalDurationMs).toBeLessThan(5000);
  });

  it('uses weighted selection deterministically for the same seed', async () => {
    const config = { seed: 'weighted-seed', durationMs: 80, sampleIntervalMs: 200 };
    const a = await runSoak(makeOps(), config);
    const b = await runSoak(makeOps(), config);
    // Duration-driven runs may differ slightly in cycle count due to
    // real wall-clock timing, but the operation chosen at each shared
    // index should match (same rng draws in the same order).
    const minLen = Math.min(a.results.length, b.results.length);
    for (let i = 0; i < minLen; i++) {
      expect(a.results[i].operation).toBe(b.results[i].operation);
    }
  });
});

describe('latencySeriesFor', () => {
  it('extracts only successful elapsed times for the named operation, in order', async () => {
    const result = await runStressPlan(makeOps(), { seed: 's', targetCounts: { searchCollections: 5, filterActive: 5 } });
    const series = latencySeriesFor(result, 'searchCollections');
    expect(series).toHaveLength(5);
    expect(series.every((v) => typeof v === 'number')).toBe(true);
  });
});
