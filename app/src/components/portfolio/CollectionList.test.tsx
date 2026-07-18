import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollectionList } from './CollectionList';
import { createCollection } from '../../catalog/domain/collection';

describe('CollectionList', () => {
  it('shows a loading state', () => {
    render(
      <CollectionList
        collections={[]}
        assetCountByCollectionId={new Map()}
        integrityFlaggedIds={new Set()}
        selectedCollectionId={null}
        onSelect={() => {}}
        onCreateNew={() => {}}
        loading={true}
        error={null}
      />,
    );
    expect(screen.getByText('กำลังโหลดคอลเลกชัน…')).toBeInTheDocument();
  });

  it('shows an empty state pointing at "สร้างคอลเลกชัน" when there are none', () => {
    render(
      <CollectionList
        collections={[]}
        assetCountByCollectionId={new Map()}
        integrityFlaggedIds={new Set()}
        selectedCollectionId={null}
        onSelect={() => {}}
        onCreateNew={() => {}}
        loading={false}
        error={null}
      />,
    );
    expect(screen.getByText(/ยังไม่มีคอลเลกชัน/)).toBeInTheDocument();
  });

  it('shows an error message', () => {
    render(
      <CollectionList
        collections={[]}
        assetCountByCollectionId={new Map()}
        integrityFlaggedIds={new Set()}
        selectedCollectionId={null}
        onSelect={() => {}}
        onCreateNew={() => {}}
        loading={false}
        error="โหลดคอลเลกชันไม่สำเร็จ"
      />,
    );
    expect(screen.getByText('โหลดคอลเลกชันไม่สำเร็จ')).toBeInTheDocument();
  });

  it('filters by search text (case-insensitive substring on the normalized name)', () => {
    const a = createCollection({ name: 'Spring Florals' });
    const b = createCollection({ name: 'Winter Frost' });
    render(
      <CollectionList
        collections={[a, b]}
        assetCountByCollectionId={new Map()}
        integrityFlaggedIds={new Set()}
        selectedCollectionId={null}
        onSelect={() => {}}
        onCreateNew={() => {}}
        loading={false}
        error={null}
      />,
    );
    fireEvent.change(screen.getByLabelText('ค้นหาคอลเลกชัน'), { target: { value: 'spring' } });
    expect(screen.getByText('Spring Florals')).toBeInTheDocument();
    expect(screen.queryByText('Winter Frost')).not.toBeInTheDocument();
  });

  it('the "+ สร้างคอลเลกชัน" button calls onCreateNew', () => {
    const onCreateNew = vi.fn();
    render(
      <CollectionList
        collections={[]}
        assetCountByCollectionId={new Map()}
        integrityFlaggedIds={new Set()}
        selectedCollectionId={null}
        onSelect={() => {}}
        onCreateNew={onCreateNew}
        loading={false}
        error={null}
      />,
    );
    fireEvent.click(screen.getByText('+ สร้างคอลเลกชัน'));
    expect(onCreateNew).toHaveBeenCalled();
  });

  it('shows the real result count', () => {
    const a = createCollection({ name: 'A' });
    const b = createCollection({ name: 'B' });
    render(
      <CollectionList
        collections={[a, b]}
        assetCountByCollectionId={new Map([[a.id, 3]])}
        integrityFlaggedIds={new Set()}
        selectedCollectionId={null}
        onSelect={() => {}}
        onCreateNew={() => {}}
        loading={false}
        error={null}
      />,
    );
    expect(screen.getByText('พบ 2 คอลเลกชัน')).toBeInTheDocument();
    expect(screen.getByText('3 ชิ้นงาน')).toBeInTheDocument();
    expect(screen.getByText('0 ชิ้นงาน')).toBeInTheDocument();
  });
});
