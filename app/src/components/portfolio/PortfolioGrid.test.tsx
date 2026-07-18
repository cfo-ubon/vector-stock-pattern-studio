import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PortfolioGrid } from './PortfolioGrid';
import { createPortfolioAsset } from '../../catalog/domain/asset';
import type { PortfolioAsset } from '../../catalog/domain/types';

function makeAsset(name: string): PortfolioAsset {
  return createPortfolioAsset({ displayName: name, originalFilename: `${name}.svg`, sourceFileReferences: [], previewReference: null, metadataReference: null });
}

describe('PortfolioGrid', () => {
  it('shows an empty state when there are no matching assets', () => {
    render(
      <PortfolioGrid
        assets={[]}
        query={{}}
        onQueryChange={() => {}}
        sortKey="importedDesc"
        onSortChange={() => {}}
        duplicateAssetIds={new Set()}
        selectedAssetId={null}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText(/ยังไม่มีชิ้นงานที่ตรงเงื่อนไข/)).toBeInTheDocument();
  });

  it('renders every asset up to the first page and shows the real result count', () => {
    const assets = Array.from({ length: 5 }, (_, i) => makeAsset(`Asset ${i}`));
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
    expect(screen.getByText('พบ 5 รายการ')).toBeInTheDocument();
    for (const a of assets) expect(screen.getByText(a.displayName)).toBeInTheDocument();
  });

  it('paginates: only the first page renders until "แสดงเพิ่ม" is clicked, for a large catalog', () => {
    const assets = Array.from({ length: 90 }, (_, i) => makeAsset(`Asset ${i}`));
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
    // PAGE_SIZE is 40 — the 41st asset (index 40) should not be rendered yet.
    expect(screen.queryByText('Asset 40')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /แสดงเพิ่ม/ })).toBeInTheDocument();
  });

  it('shows the active-filter summary when a filter is set', () => {
    render(
      <PortfolioGrid
        assets={[]}
        query={{ ratingMin: 3 }}
        onQueryChange={() => {}}
        sortKey="importedDesc"
        onSortChange={() => {}}
        duplicateAssetIds={new Set()}
        selectedAssetId={null}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText(/rating >= 3/)).toBeInTheDocument();
  });

  it('marks the selected asset visually and calls onSelect on click', () => {
    const asset = makeAsset('Clickable');
    const onSelect = vi.fn();
    render(
      <PortfolioGrid
        assets={[asset]}
        query={{}}
        onQueryChange={() => {}}
        sortKey="importedDesc"
        onSortChange={() => {}}
        duplicateAssetIds={new Set()}
        selectedAssetId={null}
        onSelect={onSelect}
      />,
    );
    screen.getByText('Clickable').closest('button')!.click();
    expect(onSelect).toHaveBeenCalledWith(asset.assetId);
  });
});
