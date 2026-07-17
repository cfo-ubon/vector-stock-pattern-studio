import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CollectionDetailPanel } from './CollectionDetailPanel';
import { createCollection } from '../../catalog/domain/collection';
import { createPortfolioAsset } from '../../catalog/domain/asset';

function noopHandlers() {
  return {
    onRename: vi.fn().mockResolvedValue(undefined),
    onUpdateDescription: vi.fn().mockResolvedValue(undefined),
    onArchive: vi.fn().mockResolvedValue(undefined),
    onUnarchive: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onSetCover: vi.fn().mockResolvedValue(undefined),
    onRemoveAssets: vi.fn().mockResolvedValue({ requestedCount: 0, changedCount: 0, skippedCount: 0, failedCount: 0, failures: [] }),
    onOpenAsset: vi.fn(),
    onClose: vi.fn(),
  };
}

function makeAsset(name: string) {
  return createPortfolioAsset({ displayName: name, originalFilename: `${name}.svg`, sourceFileReferences: [], previewReference: null, metadataReference: null });
}

describe('CollectionDetailPanel', () => {
  it('renaming on blur calls onRename with the id and new name', async () => {
    const collection = createCollection({ name: 'Old Name' });
    const handlers = noopHandlers();
    render(<CollectionDetailPanel collection={collection} memberAssets={[]} duplicateAssetIds={new Set()} {...handlers} />);

    const nameInput = screen.getByLabelText('ชื่อคอลเลกชัน');
    fireEvent.change(nameInput, { target: { value: 'New Name' } });
    fireEvent.blur(nameInput);

    await waitFor(() => expect(handlers.onRename).toHaveBeenCalledWith(collection.id, 'New Name'));
  });

  it('archive and delete use visually distinct confirmation flows (Section 8)', () => {
    const collection = createCollection({ name: 'Distinguish Me' });
    const handlers = noopHandlers();
    render(<CollectionDetailPanel collection={collection} memberAssets={[]} duplicateAssetIds={new Set()} {...handlers} />);

    fireEvent.click(screen.getByText('เก็บเข้าที่เก็บถาวร'));
    const archiveConfirm = screen.getByText(/เก็บคอลเลกชันนี้เข้าที่เก็บถาวร/).closest('.collection-archive-confirm');
    expect(archiveConfirm).not.toBeNull();
    expect(archiveConfirm?.className).not.toContain('portfolio-delete-confirm');

    fireEvent.click(screen.getByText('ลบคอลเลกชันนี้'));
    const deleteConfirm = screen.getByText('ไม่ลบชิ้นงานใดๆ').closest('.portfolio-delete-confirm');
    expect(deleteConfirm).not.toBeNull();
    expect(deleteConfirm?.className).not.toContain('collection-archive-confirm');
  });

  it('delete confirmation explains assets are not deleted and only membership references are removed', () => {
    const collection = createCollection({ name: 'Explain Me' });
    const handlers = noopHandlers();
    render(<CollectionDetailPanel collection={collection} memberAssets={[makeAsset('A'), makeAsset('B')]} duplicateAssetIds={new Set()} {...handlers} />);
    fireEvent.click(screen.getByText('ลบคอลเลกชันนี้'));
    const confirmText = screen.getByText('ไม่ลบชิ้นงานใดๆ').closest('.portfolio-delete-confirm')!.textContent;
    expect(confirmText).toContain('2 ชิ้นงาน');
  });

  it('confirming delete calls onDelete with the collection id', async () => {
    const collection = createCollection({ name: 'Delete Me' });
    const handlers = noopHandlers();
    render(<CollectionDetailPanel collection={collection} memberAssets={[]} duplicateAssetIds={new Set()} {...handlers} />);
    fireEvent.click(screen.getByText('ลบคอลเลกชันนี้'));
    fireEvent.click(screen.getByText('ยืนยันลบ'));
    await waitFor(() => expect(handlers.onDelete).toHaveBeenCalledWith(collection.id));
  });

  it('unarchiving an archived collection shows a restore button instead of the archive flow', () => {
    const collection = { ...createCollection({ name: 'Archived' }), isArchived: true };
    const handlers = noopHandlers();
    render(<CollectionDetailPanel collection={collection} memberAssets={[]} duplicateAssetIds={new Set()} {...handlers} />);
    fireEvent.click(screen.getByText('กู้คืนจากที่เก็บถาวร'));
    expect(handlers.onUnarchive).toHaveBeenCalledWith(collection.id);
  });

  it('the cover select only lists member assets, and selecting one calls onSetCover', () => {
    const collection = createCollection({ name: 'Cover Test' });
    const a = makeAsset('Member A');
    const handlers = noopHandlers();
    render(<CollectionDetailPanel collection={collection} memberAssets={[a]} duplicateAssetIds={new Set()} {...handlers} />);
    fireEvent.change(screen.getByLabelText('เลือกปกคอลเลกชันจากชิ้นงานสมาชิก'), { target: { value: a.assetId } });
    expect(handlers.onSetCover).toHaveBeenCalledWith(collection.id, a.assetId);
  });

  it('selecting members and removing them calls onRemoveAssets with the selected ids', async () => {
    const collection = createCollection({ name: 'Members' });
    const a = makeAsset('Member A');
    const b = makeAsset('Member B');
    const handlers = noopHandlers();
    render(<CollectionDetailPanel collection={collection} memberAssets={[a, b]} duplicateAssetIds={new Set()} {...handlers} />);

    fireEvent.click(screen.getByLabelText(`เลือก ${a.displayName}`));
    fireEvent.click(screen.getByText('นำออกจากคอลเลกชันนี้'));
    await waitFor(() => expect(handlers.onRemoveAssets).toHaveBeenCalledWith([a.assetId], collection.id));
  });

  it('shows an empty state pointing at the Assets tab when there are no members', () => {
    const collection = createCollection({ name: 'Empty' });
    const handlers = noopHandlers();
    render(<CollectionDetailPanel collection={collection} memberAssets={[]} duplicateAssetIds={new Set()} {...handlers} />);
    expect(screen.getByText(/ยังไม่มีชิ้นงาน/)).toBeInTheDocument();
  });
});
