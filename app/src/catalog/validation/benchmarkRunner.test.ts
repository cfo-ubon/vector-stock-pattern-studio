import { describe, it, expect } from 'vitest';
import { runBenchmarkCase, runBenchmarkSuite, collectEnvironmentMetadata } from './benchmarkRunner';

describe('runBenchmarkCase', () => {
  it('excludes warm-up iterations from the reported sample count', async () => {
    let calls = 0;
    const result = await runBenchmarkCase({
      name: 'counts calls',
      category: 'test',
      warmupIterations: 3,
      measuredIterations: 4,
      run: () => {
        calls++;
      },
    });
    expect(calls).toBe(7); // 3 warmup + 4 measured
    expect(result.samplesMs).toHaveLength(4);
    expect(result.stats?.count).toBe(4);
  });

  it('computes correct min/max/mean/median for a known sample set', async () => {
    const delays = [10, 20, 30, 40, 50];
    let i = 0;
    const result = await runBenchmarkCase({
      name: 'known delays',
      category: 'test',
      warmupIterations: 0,
      measuredIterations: 5,
      run: async () => {
        const d = delays[i++];
        await new Promise((r) => setTimeout(r, d));
      },
    });
    expect(result.stats?.count).toBe(5);
    expect(result.stats!.minMs).toBeGreaterThanOrEqual(9);
    expect(result.stats!.maxMs).toBeGreaterThanOrEqual(result.stats!.minMs);
    // Median of [10,20,30,40,50]-ish delays should sit near the middle.
    expect(result.stats!.medianMs).toBeGreaterThan(result.stats!.minMs);
  }, 10000);

  it('p95/p99 are null below their sample-count thresholds', async () => {
    const result = await runBenchmarkCase({ name: 'tiny sample', category: 'test', measuredIterations: 3, warmupIterations: 0, run: () => {} });
    expect(result.stats?.p95Ms).toBeNull();
    expect(result.stats?.p99Ms).toBeNull();
  });

  it('stdDev is null for a single-sample run', async () => {
    const result = await runBenchmarkCase({ name: 'one sample', category: 'test', measuredIterations: 1, warmupIterations: 0, run: () => {} });
    expect(result.stats?.stdDevMs).toBeNull();
  });

  it('reports timeout status without throwing, and never includes a stack trace', async () => {
    const result = await runBenchmarkCase({
      name: 'hangs',
      category: 'test',
      measuredIterations: 1,
      warmupIterations: 0,
      timeoutMs: 20,
      run: () => new Promise(() => {}),
    });
    expect(result.status).toBe('timeout');
    expect(result.error).toBeTruthy();
    expect(result.error).not.toMatch(/at .*:\d+:\d+/); // no stack-trace-shaped line
  });

  it('reports failure status for a thrown error, with a clean message', async () => {
    const result = await runBenchmarkCase({
      name: 'throws',
      category: 'test',
      measuredIterations: 1,
      warmupIterations: 0,
      run: () => {
        throw new Error('deliberate test failure');
      },
    });
    expect(result.status).toBe('failure');
    expect(result.error).toBe('deliberate test failure');
  });

  it('a failing warm-up iteration does not itself fail the benchmark', async () => {
    let call = 0;
    const result = await runBenchmarkCase({
      name: 'warmup fails once',
      category: 'test',
      warmupIterations: 1,
      measuredIterations: 2,
      run: () => {
        call++;
        if (call === 1) throw new Error('warmup-only failure');
      },
    });
    expect(result.status).toBe('success');
  });
});

describe('runBenchmarkSuite', () => {
  it('runs every case and attaches environment metadata', async () => {
    const report = await runBenchmarkSuite([
      { name: 'a', category: 'cat', warmupIterations: 0, measuredIterations: 1, run: () => {} },
      { name: 'b', category: 'cat', warmupIterations: 0, measuredIterations: 1, run: () => {} },
    ]);
    expect(report.results).toHaveLength(2);
    expect(report.results.map((r) => r.name)).toEqual(['a', 'b']);
    expect(report.environment.nodeVersion).toMatch(/^v/);
  });

  it('handles an empty case list without error', async () => {
    const report = await runBenchmarkSuite([]);
    expect(report.results).toEqual([]);
  });
});

describe('collectEnvironmentMetadata', () => {
  it('reports real, non-fabricated values in a Node environment', () => {
    const env = collectEnvironmentMetadata();
    expect(env.nodeVersion).toBe(process.version);
    expect(env.cpuCount).toBeGreaterThan(0);
    expect(typeof env.timestamp).toBe('number');
  });
});
