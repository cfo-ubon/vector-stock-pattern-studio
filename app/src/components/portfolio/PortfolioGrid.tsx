import { useState } from 'react';
import type { PortfolioAsset } from '../../catalog/domain/types';
import type { PortfolioFilterQuery, PortfolioSortKey } from '../../catalog/domain/search';
import { describeActiveFilters } from '../../catalog/domain/search';
import type { AssetExportStatus } from '../../commercial/exportWorkflow';
import { PortfolioThumbnail } from './PortfolioThumbnail';
import { BulkActionBar } from './BulkActionBar';

const PAGE_SIZE = 40;

const SORT_LABEL_TH: Record<PortfolioSortKey, string> = {
  importedDesc: 'นำเข้าล่าสุด',
  importedAsc: 'นำเข้าเก่าสุด',
  createdDesc: 'สร้างล่าสุด',
  createdAsc: 'สร้างเก่าสุด',
  name: 'ชื่อ',
  rating: 'คะแนน',
  workflowStatus: 'สถานะงาน',
  fileSize: 'ขนาดไฟล์',
};

interface Props {
  assets: PortfolioAsset[];
  query: PortfolioFilterQuery;
  onQueryChange: (query: PortfolioFilterQuery) => void;
  sortKey: PortfolioSortKey;
  onSortChange: (key: PortfolioSortKey) => void;
  duplicateAssetIds: ReadonlySet<string>;
  selectedAssetId: string | null;
  onSelect: (assetId: string) => void;
  /** Portfolio Manager P2 Stage 2, Sections 11/13 — multi-selection for
   * bulk collection assignment. All optional so this component's existing
   * single-select-only callers (none remain, but future tests may not
   * need bulk features) keep working without passing every prop. */
  multiSelectedIds?: ReadonlySet<string>;
  onToggleMultiSelect?: (assetId: string) => void;
  onSelectVisible?: (assetIds: string[]) => void;
  onClearSelection?: () => void;
  onBulkAssign?: () => void;
  onBulkRemove?: () => void;
  bulkBusy?: boolean;
  /** Hotfix v1.0.1, Part 5 — bulk export entry point, forwarded to
   * `BulkActionBar`'s optional Export button. */
  onBulkExport?: () => void;
  /** Design Refinement Studio Pro, Mission 4 — Batch Refinement entry
   * point, forwarded to `BulkActionBar`'s optional Batch Refine button. */
  onBulkRefine?: () => void;
  /** Hotfix v1.0.1, Part 7 — per-asset Export Status, batch-derived once
   * by the caller (see `PortfolioManagerView.tsx`'s `exportStatusByAsset`)
   * and forwarded to each `PortfolioThumbnail` for its status badge. */
  exportStatusByAsset?: Map<string, AssetExportStatus>;
}

/** Sprint P1, Section 7 (main area) + Section 8 (search/filter/sort UI).
 * Pagination follows `ProjectExplorer.tsx`'s existing "show more" pattern
 * (no virtualized-list dependency anywhere in this app) — validated for
 * 1,000+ records in `PortfolioGrid.performance.test.tsx`. */
export function PortfolioGrid({
  assets,
  query,
  onQueryChange,
  sortKey,
  onSortChange,
  duplicateAssetIds,
  selectedAssetId,
  onSelect,
  multiSelectedIds,
  onToggleMultiSelect,
  onSelectVisible,
  onClearSelection,
  onBulkAssign,
  onBulkRemove,
  bulkBusy,
  onBulkExport,
  onBulkRefine,
  exportStatusByAsset,
}: Props) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const shown = assets.slice(0, visible);
  const activeFilters = describeActiveFilters(query);

  return (
    <div className="portfolio-grid-area">
      <div className="portfolio-grid-toolbar">
        <input
          type="search"
          className="portfolio-search-input"
          placeholder="ค้นหาชื่อ, Asset ID, แท็ก, Style DNA…"
          value={query.keyword ?? ''}
          onChange={(e) => {
            setVisible(PAGE_SIZE);
            onQueryChange({ ...query, keyword: e.target.value || undefined });
          }}
          aria-label="ค้นหาคลังชิ้นงาน"
        />
        <select value={sortKey} onChange={(e) => onSortChange(e.target.value as PortfolioSortKey)} aria-label="เรียงลำดับ">
          {Object.entries(SORT_LABEL_TH).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="portfolio-grid-summary">
        <span>พบ {assets.length} รายการ</span>
        {activeFilters.length > 0 && <span className="portfolio-active-filters">ตัวกรอง: {activeFilters.join(' · ')}</span>}
      </div>

      {multiSelectedIds && multiSelectedIds.size > 0 && onSelectVisible && onClearSelection && onBulkAssign && onBulkRemove && (
        <BulkActionBar
          selectedCount={multiSelectedIds.size}
          onSelectVisible={() => onSelectVisible(shown.map((a) => a.assetId))}
          onClearSelection={onClearSelection}
          onAssign={onBulkAssign}
          onRemove={onBulkRemove}
          busy={!!bulkBusy}
          onExport={onBulkExport}
          onBatchRefine={onBulkRefine}
        />
      )}

      {assets.length === 0 ? (
        <p className="gallery-empty">ยังไม่มีชิ้นงานที่ตรงเงื่อนไข — ลองล้างตัวกรอง หรือกด "+ นำเข้าไฟล์"</p>
      ) : (
        <>
          <div className="portfolio-grid">
            {shown.map((asset) => (
              <PortfolioThumbnail
                key={asset.assetId}
                asset={asset}
                selected={asset.assetId === selectedAssetId}
                isDuplicate={duplicateAssetIds.has(asset.assetId)}
                onSelect={onSelect}
                multiSelectable={!!onToggleMultiSelect}
                multiChecked={multiSelectedIds?.has(asset.assetId)}
                onToggleMultiSelect={onToggleMultiSelect}
                exportStatus={exportStatusByAsset?.get(asset.assetId)}
              />
            ))}
          </div>
          {visible < assets.length && (
            <button type="button" className="btn" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
              แสดงเพิ่ม ({assets.length - visible} รายการที่เหลือ)
            </button>
          )}
        </>
      )}
    </div>
  );
}
