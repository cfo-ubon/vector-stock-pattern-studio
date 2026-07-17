interface Props {
  selectedCount: number;
  onSelectVisible: () => void;
  onClearSelection: () => void;
  onAssign: () => void;
  onRemove: () => void;
  busy: boolean;
}

/** Portfolio Manager P2 Stage 2, Section 13 — appears above the asset
 * grid once at least one asset is multi-selected. "เลือกที่แสดงอยู่" only
 * selects the currently-*rendered* (paginated) page of results, never
 * assets hidden by pagination or the active filter — Section 11's "avoid
 * accidentally selecting hidden assets without clear feedback." Selection
 * is intentionally cleared whenever the search/filter query changes (see
 * `PortfolioManagerView.tsx`), so a stale selection can never silently
 * apply to a different result set. */
export function BulkActionBar({ selectedCount, onSelectVisible, onClearSelection, onAssign, onRemove, busy }: Props) {
  return (
    <div className="portfolio-bulk-action-bar" role="toolbar" aria-label="การดำเนินการหลายรายการ">
      <span>เลือกแล้ว {selectedCount} รายการ</span>
      <button type="button" className="btn btn--small" onClick={onSelectVisible} disabled={busy}>
        เลือกที่แสดงอยู่ทั้งหมด
      </button>
      <button type="button" className="btn btn--small" onClick={onClearSelection} disabled={busy}>
        ล้างการเลือก
      </button>
      <button type="button" className="btn btn--small btn--primary" onClick={onAssign} disabled={busy || selectedCount === 0}>
        เพิ่มเข้าคอลเลกชัน
      </button>
      <button type="button" className="btn btn--small" onClick={onRemove} disabled={busy || selectedCount === 0}>
        นำออกจากคอลเลกชัน
      </button>
    </div>
  );
}
