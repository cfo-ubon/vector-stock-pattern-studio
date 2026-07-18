import { describe, it, expect } from 'vitest';
import {
  compareAgainstSprint1,
  compareBatchAgainstSprint1,
  toMarkdownComparisonTable,
  currentEnvironmentDescription,
  SPRINT2_OPERATION_TO_SPRINT1_BENCHMARK_NAME,
} from './baselineCompare';
import { SPRINT1_BASELINE } from './sprint1Baseline';

const SPRINT1_ENV = SPRINT1_BASELINE.metrics[0].environmentDescription;

describe('compareAgainstSprint1', () => {
  it('classifies improved when the new median is meaningfully faster', () => {
    const row = compareAgainstSprint1({ benchmarkName: 'list-collections', datasetIdentity: 'small-1000x100', medianMs: 0.3, environmentDescription: SPRINT1_ENV });
    expect(row.classification).toBe('improved');
  });

  it('classifies stable when within the warning threshold', () => {
    const row = compareAgainstSprint1({ benchmarkName: 'list-collections', datasetIdentity: 'small-1000x100', medianMs: 0.56, environmentDescription: SPRINT1_ENV });
    expect(row.classification).toBe('stable');
  });

  it('classifies warning at 15%+ degradation', () => {
    const row = compareAgainstSprint1({ benchmarkName: 'list-collections', datasetIdentity: 'small-1000x100', medianMs: 0.54 * 1.2, environmentDescription: SPRINT1_ENV });
    expect(row.classification).toBe('warning');
  });

  it('classifies regression at 30%+ degradation', () => {
    const row = compareAgainstSprint1({ benchmarkName: 'list-collections', datasetIdentity: 'small-1000x100', medianMs: 0.54 * 1.5, environmentDescription: SPRINT1_ENV });
    expect(row.classification).toBe('regression');
  });

  it('classifies non_comparable across a different environment', () => {
    const row = compareAgainstSprint1({ benchmarkName: 'list-collections', datasetIdentity: 'small-1000x100', medianMs: 999, environmentDescription: 'v18.0.0 | darwin/arm64 | Other CPU' });
    expect(row.classification).toBe('non_comparable');
  });

  it('classifies no_baseline for a benchmark Sprint 1 never measured', () => {
    const row = compareAgainstSprint1({ benchmarkName: 'integrity-repair', datasetIdentity: 'small-1000x100', medianMs: 5, environmentDescription: SPRINT1_ENV });
    expect(row.classification).toBe('no_baseline');
  });

  it('never mutates the committed SPRINT1_BASELINE fixture', () => {
    const before = JSON.stringify(SPRINT1_BASELINE);
    compareAgainstSprint1({ benchmarkName: 'bulk-assign-1000', datasetIdentity: 'large-100000x10000', medianMs: 5000, environmentDescription: SPRINT1_ENV });
    expect(JSON.stringify(SPRINT1_BASELINE)).toBe(before);
  });
});

describe('compareBatchAgainstSprint1', () => {
  it('produces one row per measurement, in order', () => {
    const rows = compareBatchAgainstSprint1([
      { benchmarkName: 'list-collections', datasetIdentity: 'small-1000x100', medianMs: 0.5, environmentDescription: SPRINT1_ENV },
      { benchmarkName: 'bulk-assign-1000', datasetIdentity: 'medium-10000x1000', medianMs: 100, environmentDescription: SPRINT1_ENV },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].benchmarkName).toBe('list-collections');
    expect(rows[1].benchmarkName).toBe('bulk-assign-1000');
  });
});

describe('toMarkdownComparisonTable', () => {
  it('renders a header row and one row per comparison', () => {
    const rows = compareBatchAgainstSprint1([{ benchmarkName: 'list-collections', datasetIdentity: 'small-1000x100', medianMs: 0.5, environmentDescription: SPRINT1_ENV }]);
    const md = toMarkdownComparisonTable(rows);
    expect(md).toContain('| Benchmark | Dataset |');
    expect(md).toContain('list-collections');
    expect(md).toContain('small-1000x100');
  });
});

describe('currentEnvironmentDescription', () => {
  it('produces a real, non-empty environment fingerprint', () => {
    expect(currentEnvironmentDescription().length).toBeGreaterThan(0);
  });
});

describe('SPRINT2_OPERATION_TO_SPRINT1_BENCHMARK_NAME', () => {
  // Regression test for P2.5-6: `searchCollections` (Sprint 2's
  // `searchCollectionsByName` op) must never be mapped onto Sprint 1's
  // `search-collection-filter` baseline — that baseline actually measured
  // `searchPortfolioAssets`, an unrelated asset-search-by-membership call.
  // The two run at very different costs (fast in-memory array filter vs.
  // a full `loadCollections()` IndexedDB getAll), so comparing them
  // produced a false ~559% "regression" the first time Sprint 2's stress
  // run compared against baseline.
  it('has no entry for searchCollections', () => {
    expect(SPRINT2_OPERATION_TO_SPRINT1_BENCHMARK_NAME.searchCollections).toBeUndefined();
  });

  it('maps every entry to a benchmark name Sprint 1 actually recorded', () => {
    const knownNames = new Set(SPRINT1_BASELINE.metrics.map((m) => m.benchmarkName));
    for (const baselineName of Object.values(SPRINT2_OPERATION_TO_SPRINT1_BENCHMARK_NAME)) {
      expect(knownNames.has(baselineName!)).toBe(true);
    }
  });

  it('includes the expected comparable operations', () => {
    expect(SPRINT2_OPERATION_TO_SPRINT1_BENCHMARK_NAME).toMatchObject({
      filterActive: 'filter-active-archived',
      openCollection: 'open-collection-metadata',
      bulkAssign: 'bulk-assign-1000',
      bulkRemove: 'bulk-remove-1000',
      integrityScan: 'integrity-scan',
    });
  });
});
