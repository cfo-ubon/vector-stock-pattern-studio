import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CollectionList } from './CollectionList';
import { CollectionDetailPanel } from './CollectionDetailPanel';
import { createCollection } from '../../catalog/domain/collection';
import { createPortfolioAsset } from '../../catalog/domain/asset';
import type { Collection } from '../../catalog/domain/collection';
import type { PortfolioAsset } from '../../catalog/domain/types';

// Portfolio Manager P2 Stage 2, Section 21 (Performance Targets — UI half).
// `catalog/services/collectionService.performance.test.ts` (Stage 1)
// already covers the service-layer bulk assign/remove/integrity-scan
// targets at 1,000/20,000-asset scale; this file covers the UI-rendering
// half specifically: collection list render/search at 100 collections,
// and bounded (paginated) member-grid rendering for a large collection —
// never mounting every member card at once, mirroring
// `PortfolioGrid.performance.test.tsx`'s existing 1,000-asset convention.

function makeCollections(count: number): Collection[] {
  return Array.from({ length: count }, (_, i) => createCollection({ name: `Perf Collection ${i}`, now: 1700000000000 + i }));
}

function makeAssets(count: number, collectionId: string): PortfolioAsset[] {
  return Array.from({ length: count }, (_, i) => ({
    ...createPortfolioAsset({
      displayName: `Member ${i}`,
      originalFilename: `member-${i}.svg`,
      sourceFileReferences: [],
      previewReference: null,
      metadataReference: null,
    }),
    collectionIds: [collectionId],
  }));
}

describe('Collection UI performance (100 collections / bounded member rendering)', () => {
  it('CollectionList renders 100 collections responsively', () => {
    const collections = makeCollections(100);
    const counts = new Map(collections.map((c) => [c.id, 3]));
    const start = performance.now();
    render(
      <CollectionList
        collections={collections}
        assetCountByCollectionId={counts}
        integrityFlaggedIds={new Set()}
        selectedCollectionId={null}
        onSelect={() => {}}
        onCreateNew={() => {}}
        loading={false}
        error={null}
      />,
    );
    const elapsed = performance.now() - start;
    console.log(`[perf] CollectionList initial render (100 collections): ${elapsed.toFixed(1)}ms`);
    expect(screen.getByText('พบ 100 คอลเลกชัน')).toBeInTheDocument();
    // Generous CI-safe bound, not micro-timing.
    expect(elapsed).toBeLessThan(2000);
  });

  it('CollectionList search filter over 100 collections stays fast', () => {
    const collections = makeCollections(100);
    render(
      <CollectionList
        collections={collections}
        assetCountByCollectionId={new Map()}
        integrityFlaggedIds={new Set()}
        selectedCollectionId={null}
        onSelect={() => {}}
        onCreateNew={() => {}}
        loading={false}
        error={null}
      />,
    );
    const input = screen.getByLabelText('ค้นหาคอลเลกชัน');
    const start = performance.now();
    fireEvent.change(input, { target: { value: 'Perf Collection 42' } });
    const elapsed = performance.now() - start;
    console.log(`[perf] CollectionList search filter (100 collections): ${elapsed.toFixed(1)}ms`);
    expect(screen.getByText('Perf Collection 42')).toBeInTheDocument();
    expect(screen.getByText('พบ 1 คอลเลกชัน')).toBeInTheDocument();
    expect(elapsed).toBeLessThan(100);
  });

  it('CollectionDetailPanel never mounts more than one page of member cards for a 1,000-asset collection', () => {
    const collection = createCollection({ name: 'Huge Collection' });
    const members = makeAssets(1000, collection.id);
    const start = performance.now();
    render(
      <CollectionDetailPanel
        collection={collection}
        memberAssets={members}
        duplicateAssetIds={new Set()}
        onRename={async () => {}}
        onUpdateDescription={async () => {}}
        onArchive={async () => {}}
        onUnarchive={async () => {}}
        onDelete={async () => {}}
        onSetCover={async () => {}}
        onRemoveAssets={async () => ({ requestedCount: 0, changedCount: 0, skippedCount: 0, failedCount: 0, failures: [] })}
        onOpenAsset={() => {}}
        onClose={() => {}}
      />,
    );
    const elapsed = performance.now() - start;
    console.log(`[perf] CollectionDetailPanel first render with 1,000 members: ${elapsed.toFixed(1)}ms`);

    // Real total shown in the header...
    expect(screen.getByText('ชิ้นงานในคอลเลกชันนี้ (1000)')).toBeInTheDocument();
    // ...but only the first page of member *cards* is actually mounted
    // (the cover-picker <select> separately lists every member as a plain
    // <option> — cheap text nodes, not full thumbnail cards with their own
    // Blob-URL-holding preview hook — so it is scoped out of this check;
    // see the member grid specifically).
    const memberGrid = document.querySelector('.collection-member-grid') as HTMLElement;
    expect(within(memberGrid).getByText('Member 0')).toBeInTheDocument();
    expect(within(memberGrid).getByText('Member 39')).toBeInTheDocument();
    expect(within(memberGrid).queryByText('Member 40')).not.toBeInTheDocument();
    expect(within(memberGrid).queryByText('Member 999')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /แสดงเพิ่ม/ })).toBeInTheDocument();
    expect(elapsed).toBeLessThan(2000);
  });
});
