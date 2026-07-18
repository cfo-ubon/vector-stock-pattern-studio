import { describe, it, expect } from 'vitest';
import { createPortfolioAsset } from './asset';
import { searchPortfolioAssets, sortPortfolioAssets, describeActiveFilters } from './search';
import type { PortfolioAsset } from './types';
import { WORKFLOW_STATUSES } from './types';

// Sprint P1, Section 9: "Test at least 1,000 catalog records for
// acceptable grid responsiveness using generated fixtures or mocks."
// This exercises the pure domain-layer search/filter/sort path (the same
// functions `PortfolioManagerView` calls on every keystroke/filter
// change) against a 1,000+ record fixture. See
// `../../components/portfolio/PortfolioGrid.performance.test.tsx` for the
// rendering/pagination half of this requirement.

const FIXTURE_SIZE = 1200;

function buildFixture(count: number): PortfolioAsset[] {
  const assets: PortfolioAsset[] = [];
  for (let i = 0; i < count; i++) {
    const status = WORKFLOW_STATUSES[i % WORKFLOW_STATUSES.length];
    const asset = createPortfolioAsset({
      displayName: `Pattern ${i} ${i % 7 === 0 ? 'floral' : 'geometric'}`,
      originalFilename: `pattern-${i}.svg`,
      sourceFileReferences:
        i % 5 === 0
          ? []
          : [{ fileId: `file-${i}`, role: 'svg', filename: `pattern-${i}.svg`, mimeType: 'image/svg+xml', fileSize: 1000 + i, sha256: `hash-${i}` }],
      previewReference: i % 5 === 0 ? null : `file-${i}`,
      metadataReference: null,
      styleDna: i % 3 === 0 ? 'botanical-line' : null,
      generatorVersion: `1.${i % 4}.0`,
    });
    assets.push({ ...asset, workflowStatus: status, rating: i % 6, tags: i % 10 === 0 ? ['seasonal'] : [] });
  }
  return assets;
}

describe('portfolio search/sort performance (1,000+ records)', () => {
  it('generates a 1,000+ record fixture', () => {
    const assets = buildFixture(FIXTURE_SIZE);
    expect(assets).toHaveLength(FIXTURE_SIZE);
  });

  it('keyword search across 1,000+ records completes well within an interactive budget', () => {
    const assets = buildFixture(FIXTURE_SIZE);
    const start = performance.now();
    const results = searchPortfolioAssets(assets, { keyword: 'floral' });
    const elapsed = performance.now() - start;
    expect(results.length).toBeGreaterThan(0);
    // Generous bound for CI/shared runners — a real browser is far faster;
    // this guards against an accidental O(n^2) regression, not micro-timing.
    expect(elapsed).toBeLessThan(200);
  });

  it('combined filters (status + rating + missing preview + archived toggle) complete within budget', () => {
    const assets = buildFixture(FIXTURE_SIZE);
    const start = performance.now();
    const results = searchPortfolioAssets(assets, {
      workflowStatus: ['DRAFT', 'READY_FOR_REVIEW'],
      ratingMin: 2,
      missingPreview: false,
      archived: 'all',
      generatorVersion: '1.2.0',
    });
    const elapsed = performance.now() - start;
    expect(results.every((a) => a.workflowStatus === 'DRAFT' || a.workflowStatus === 'READY_FOR_REVIEW')).toBe(true);
    expect(elapsed).toBeLessThan(200);
  });

  it('every sort key sorts 1,000+ records within budget and preserves the record count', () => {
    const assets = buildFixture(FIXTURE_SIZE);
    const sortKeys = ['importedDesc', 'importedAsc', 'createdDesc', 'createdAsc', 'name', 'rating', 'workflowStatus', 'fileSize'] as const;
    for (const key of sortKeys) {
      const start = performance.now();
      const sorted = sortPortfolioAssets(assets, key);
      const elapsed = performance.now() - start;
      expect(sorted).toHaveLength(FIXTURE_SIZE);
      expect(elapsed).toBeLessThan(200);
    }
  });

  it('does not mutate the source array when sorting (grid re-renders rely on this)', () => {
    const assets = buildFixture(FIXTURE_SIZE);
    const originalFirstId = assets[0].assetId;
    sortPortfolioAssets(assets, 'name');
    expect(assets[0].assetId).toBe(originalFirstId);
  });

  it('describeActiveFilters stays cheap regardless of catalog size (it only inspects the query)', () => {
    const start = performance.now();
    const parts = describeActiveFilters({ ratingMin: 3, workflowStatus: ['APPROVED'], onlyDuplicates: true });
    const elapsed = performance.now() - start;
    expect(parts.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(20);
  });
});
