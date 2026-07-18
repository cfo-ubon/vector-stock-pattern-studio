import { describe, it, expect } from 'vitest';
import { toJsonReport, toConsoleSummary, toMarkdownReport } from './benchmarkReport';
import type { FullValidationReport } from './benchmarkReport';
import { collectEnvironmentMetadata } from './benchmarkRunner';
import { generateDataset } from './datasetGenerator';
import { smallDatasetConfig } from './datasetPresets';

function makeReport(overrides: Partial<FullValidationReport> = {}): FullValidationReport {
  const { manifest } = generateDataset({ ...smallDatasetConfig(), assetCount: 10, collectionCount: 3, avgMembershipsPerAsset: 1 });
  return {
    generatedAt: 1700000000000,
    gitCommit: 'abc1234',
    branch: 'test-branch',
    manifest,
    benchmarks: {
      environment: collectEnvironmentMetadata(),
      generatedAt: 1700000000000,
      results: [
        {
          name: 'sample-benchmark',
          category: 'test',
          status: 'success',
          warmupIterations: 1,
          measuredIterations: 5,
          stats: { count: 5, minMs: 1, maxMs: 5, meanMs: 3, medianMs: 3, p95Ms: null, p99Ms: null, stdDevMs: 1.5, opsPerSec: 333 },
          error: null,
          samplesMs: [1, 2, 3, 4, 5],
        },
        {
          name: 'failed-benchmark',
          category: 'test',
          status: 'failure',
          warmupIterations: 0,
          measuredIterations: 1,
          stats: null,
          error: 'boom',
          samplesMs: [],
        },
      ],
    },
    warnings: ['something is a bit slow'],
    failures: [],
    ...overrides,
  };
}

describe('toJsonReport', () => {
  it('round-trips as valid, parseable JSON containing every top-level field', () => {
    const report = makeReport();
    const json = toJsonReport(report);
    const parsed = JSON.parse(json);
    expect(parsed.generatedAt).toBe(report.generatedAt);
    expect(parsed.benchmarks.results).toHaveLength(2);
    expect(parsed.manifest.assetCount).toBe(10);
  });
});

describe('toConsoleSummary', () => {
  it('includes commit, environment, dataset, and every benchmark result', () => {
    const summary = toConsoleSummary(makeReport());
    expect(summary).toContain('abc1234');
    expect(summary).toContain('test-branch');
    expect(summary).toContain('sample-benchmark');
    expect(summary).toContain('failed-benchmark');
    expect(summary).toContain('boom');
    expect(summary).toContain('something is a bit slow');
  });

  it('handles a report with no manifest and no warnings/failures gracefully', () => {
    const summary = toConsoleSummary(makeReport({ manifest: null, warnings: [], failures: [] }));
    expect(summary).not.toContain('Dataset:');
    expect(summary).not.toContain('Warnings:');
  });
});

describe('toMarkdownReport', () => {
  it('produces a markdown table for the manifest and the benchmark results', () => {
    const md = toMarkdownReport(makeReport());
    expect(md).toContain('# Collection Validation Report');
    expect(md).toContain('| Field | Value |');
    expect(md).toContain('| Category | Name | Status |');
    expect(md).toContain('sample-benchmark');
    expect(md).toContain('## Warnings');
  });

  it('omits the Warnings/Failures sections when there are none', () => {
    const md = toMarkdownReport(makeReport({ warnings: [], failures: [] }));
    expect(md).not.toContain('## Warnings');
    expect(md).not.toContain('## Failures');
  });
});
