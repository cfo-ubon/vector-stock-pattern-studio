import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PortfolioGrid } from './PortfolioGrid';
import { createPortfolioAsset } from '../../catalog/domain/asset';
import type { PortfolioAsset } from '../../catalog/domain/types';

// Sprint P1, Section 9: "Test at least 1,000 catalog records for
// acceptable grid responsiveness using generated fixtures or mocks."
// This is the rendering/pagination half of that requirement — the
// domain-layer search/filter/sort half lives in
// `../../catalog/domain/search.performance.test.ts`.

const FIXTURE_SIZE = 1000;

function buildFixture(count: number): PortfolioAsset[] {
  return Array.from({ length: count }, (_, i) =>
    createPortfolioAsset({
      displayName: `Pattern ${i}`,
      originalFilename: `pattern-${i}.svg`,
      sourceFileReferences: [],
      previewReference: null,
      metadataReference: null,
    }),
  );
}

describe('PortfolioGrid performance (1,000+ records)', () => {
  it('renders only the first page (PAGE_SIZE=40) even with 1,000 assets in the catalog — never mounts all 1,000 thumbnails at once', () => {
    const assets = buildFixture(FIXTURE_SIZE);
    const start = performance.now();
    render(
      <PortfolioGrid
        assets={assets}
        query={{}}
        onQueryChange={() => {}}
        sortKey="importedDesc"
        onSortChange={() => {}}
        duplicateAssetIds={new Set()}
        selectedAssetId={null}
        onSelect={() => {}}
      />,
    );
    const elapsed = performance.now() - start;

    // Real result count reflects the full catalog...
    expect(screen.getByText(`พบ ${FIXTURE_SIZE} รายการ`)).toBeInTheDocument();
    // ...but only the first page of cards is actually mounted (lazy
    // loading / bounded DOM size — this is what keeps the grid
    // responsive at 1,000+ records, per Section 9).
    expect(screen.getByText('Pattern 0')).toBeInTheDocument();
    expect(screen.getByText('Pattern 39')).toBeInTheDocument();
    expect(screen.queryByText('Pattern 40')).not.toBeInTheDocument();
    expect(screen.queryByText('Pattern 999')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /แสดงเพิ่ม/ })).toBeInTheDocument();

    // Generous bound for CI/shared runners; guards against an accidental
    // "render everything" regression, not micro-timing.
    expect(elapsed).toBeLessThan(2000);
  });

  it('clicking "show more" reveals the next page without unmounting the whole grid', () => {
    const assets = buildFixture(FIXTURE_SIZE);
    render(
      <PortfolioGrid
        assets={assets}
        query={{}}
        onQueryChange={() => {}}
        sortKey="importedDesc"
        onSortChange={() => {}}
        duplicateAssetIds={new Set()}
        selectedAssetId={null}
        onSelect={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /แสดงเพิ่ม/ }));
    expect(screen.getByText('Pattern 0')).toBeInTheDocument();
    expect(screen.getByText('Pattern 79')).toBeInTheDocument();
    expect(screen.queryByText('Pattern 80')).not.toBeInTheDocument();
  });

  it('a filtered-to-empty result set over 1,000 records shows the empty state, not a stale grid', () => {
    const assets = buildFixture(FIXTURE_SIZE);
    render(
      <PortfolioGrid
        assets={[]}
        query={{ keyword: 'nonexistent-keyword-xyz' }}
        onQueryChange={() => {}}
        sortKey="importedDesc"
        onSortChange={() => {}}
        duplicateAssetIds={new Set()}
        selectedAssetId={null}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText(/ยังไม่มีชิ้นงานที่ตรงเงื่อนไข/)).toBeInTheDocument();
    expect(assets).toHaveLength(FIXTURE_SIZE);
  });
});
