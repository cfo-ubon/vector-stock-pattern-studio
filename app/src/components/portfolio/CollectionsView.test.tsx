import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CollectionsView } from './CollectionsView';
import { createCollection } from '../../catalog/domain/collection';

function baseProps() {
  return {
    collections: [],
    collectionsLoading: false,
    collectionsError: null,
    assets: [],
    duplicateAssetIds: new Set<string>(),
    onCreateCollection: vi.fn(),
    onRenameCollection: vi.fn(),
    onUpdateDescription: vi.fn(),
    onArchiveCollection: vi.fn(),
    onUnarchiveCollection: vi.fn(),
    onDeleteCollection: vi.fn(),
    onSetCover: vi.fn(),
    onRemoveAssetsFromCollection: vi.fn(),
    onOpenAsset: vi.fn(),
    integrityReport: null,
    integrityLoading: false,
    onScanIntegrity: vi.fn(),
    onRepairOrphans: vi.fn(),
    onRepairCovers: vi.fn(),
    selectedCollectionId: null,
    onSelectCollection: vi.fn(),
  };
}

describe('CollectionsView', () => {
  it('the Integrity tab replaces the list with the integrity panel', () => {
    render(<CollectionsView {...baseProps()} />);
    const nav = within(screen.getByRole('navigation', { name: 'มุมมองคอลเลกชัน' }));
    fireEvent.click(nav.getByText('ตรวจสอบข้อมูล'));
    expect(screen.getByText('ตรวจสอบใหม่')).toBeInTheDocument();
    expect(screen.queryByText('+ สร้างคอลเลกชัน')).not.toBeInTheDocument();
  });

  it('the Active/Archived tabs filter the list by archive status', () => {
    const active = createCollection({ name: 'Active One' });
    const archived = { ...createCollection({ name: 'Archived One' }), isArchived: true };
    render(<CollectionsView {...baseProps()} collections={[active, archived]} />);

    const nav = within(screen.getByRole('navigation', { name: 'มุมมองคอลเลกชัน' }));
    fireEvent.click(nav.getByText('ใช้งานอยู่'));
    expect(screen.getByText('Active One')).toBeInTheDocument();
    expect(screen.queryByText('Archived One')).not.toBeInTheDocument();

    fireEvent.click(nav.getByText('เก็บถาวร'));
    expect(screen.getByText('Archived One')).toBeInTheDocument();
    expect(screen.queryByText('Active One')).not.toBeInTheDocument();
  });

  it('selecting a collection from the list shows its detail panel', () => {
    const collection = createCollection({ name: 'Selectable' });
    const onSelectCollection = vi.fn();
    render(<CollectionsView {...baseProps()} collections={[collection]} onSelectCollection={onSelectCollection} />);
    fireEvent.click(screen.getByText('Selectable'));
    expect(onSelectCollection).toHaveBeenCalledWith(collection.id);
  });

  it('renders the detail panel when selectedCollectionId is already set (survives a tab switch)', () => {
    const collection = createCollection({ name: 'Preselected' });
    render(<CollectionsView {...baseProps()} collections={[collection]} selectedCollectionId={collection.id} />);
    expect(screen.getByText('รายละเอียดคอลเลกชัน')).toBeInTheDocument();
  });

  it('real per-collection asset counts are computed from the passed-in assets, never hard-coded', () => {
    const collection = createCollection({ name: 'Counted' });
    const assets = [
      { collectionIds: [collection.id] },
      { collectionIds: [collection.id] },
      { collectionIds: [] },
    ] as never;
    render(<CollectionsView {...baseProps()} collections={[collection]} assets={assets} />);
    expect(screen.getByText('2 ชิ้นงาน')).toBeInTheDocument();
  });
});
