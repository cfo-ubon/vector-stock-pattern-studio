import { useMemo, useState } from 'react';
import type { Collection } from '../../catalog/domain/collection';
import { CollectionCard } from './CollectionCard';

type CollectionSortKey = 'name' | 'updatedDesc' | 'countDesc';

const SORT_LABEL_TH: Record<CollectionSortKey, string> = {
  name: 'ชื่อ',
  updatedDesc: 'อัปเดตล่าสุด',
  countDesc: 'จำนวนชิ้นงานมากสุด',
};

interface Props {
  collections: Collection[];
  assetCountByCollectionId: ReadonlyMap<string, number>;
  integrityFlaggedIds: ReadonlySet<string>;
  selectedCollectionId: string | null;
  onSelect: (collectionId: string) => void;
  onCreateNew: () => void;
  loading: boolean;
  error: string | null;
}

/** Portfolio Manager P2 Stage 2, Section 4 — the Collection list/grid.
 * Same "search + sort toolbar above a responsive card grid" shape as
 * `PortfolioGrid.tsx`, reusing the same `.portfolio-grid`/`.portfolio-thumb`
 * CSS classes (via `CollectionCard`) rather than a parallel grid system.
 * Collections are a small, bounded set (Stage 1 target ~100) so this uses
 * a plain in-memory filter/sort, no pagination — consistent with
 * `collectionStore.searchCollectionsByName`'s own "small, bounded set"
 * rationale. */
export function CollectionList({
  collections,
  assetCountByCollectionId,
  integrityFlaggedIds,
  selectedCollectionId,
  onSelect,
  onCreateNew,
  loading,
  error,
}: Props) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<CollectionSortKey>('name');

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = needle ? collections.filter((c) => c.normalizedName.includes(needle)) : collections;
    const sorted = [...filtered];
    switch (sortKey) {
      case 'name':
        sorted.sort((a, b) => a.normalizedName.localeCompare(b.normalizedName));
        break;
      case 'updatedDesc':
        sorted.sort((a, b) => b.updatedAt - a.updatedAt);
        break;
      case 'countDesc':
        sorted.sort((a, b) => (assetCountByCollectionId.get(b.id) ?? 0) - (assetCountByCollectionId.get(a.id) ?? 0));
        break;
    }
    return sorted;
  }, [collections, search, sortKey, assetCountByCollectionId]);

  return (
    <div className="portfolio-grid-area">
      <div className="portfolio-grid-toolbar">
        <input
          type="search"
          className="portfolio-search-input"
          placeholder="ค้นหาชื่อคอลเลกชัน…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="ค้นหาคอลเลกชัน"
        />
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as CollectionSortKey)} aria-label="เรียงลำดับคอลเลกชัน">
          {Object.entries(SORT_LABEL_TH).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn--primary" onClick={onCreateNew}>
          + สร้างคอลเลกชัน
        </button>
      </div>

      <div className="portfolio-grid-summary">
        <span>พบ {shown.length} คอลเลกชัน</span>
      </div>

      {error && <p className="portfolio-error-text">{error}</p>}
      {loading ? (
        <p className="portfolio-loading">กำลังโหลดคอลเลกชัน…</p>
      ) : shown.length === 0 ? (
        <p className="gallery-empty">
          {collections.length === 0 ? 'ยังไม่มีคอลเลกชัน — กด "+ สร้างคอลเลกชัน" เพื่อเริ่มจัดกลุ่มชิ้นงาน' : 'ไม่พบคอลเลกชันที่ตรงกับการค้นหา'}
        </p>
      ) : (
        <div className="portfolio-grid">
          {shown.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              assetCount={assetCountByCollectionId.get(collection.id) ?? 0}
              hasIntegrityIssue={integrityFlaggedIds.has(collection.id)}
              selected={collection.id === selectedCollectionId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
