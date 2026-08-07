interface Props {
  selectedCount: number;
  onSelectVisible: () => void;
  onClearSelection: () => void;
  onAssign: () => void;
  onRemove: () => void;
  busy: boolean;
  /** Hotfix v1.0.1, Part 5 — bulk export entry point. Optional so callers
   * that don't need it (none remain, but kept backward-compatible) don't
   * have to pass it. */
  onExport?: () => void;
  /** Design Refinement Studio Pro, Mission 4 — Batch Refinement entry
   * point. Optional for the same reason as `onExport`. */
  onBatchRefine?: () => void;
}

/** Portfolio Manager P2 Stage 2, Section 13 — appears above the asset
 * grid once at least one asset is multi-selected. "เลือกที่แสดงอยู่" only
 * selects the currently-*rendered* (paginated) page of results, never
 * assets hidden by pagination or the active filter — Section 11's "avoid
 * accidentally selecting hidden assets without clear feedback." Selection
 * is intentionally cleared whenever the search/filter query changes (see
 * `PortfolioManagerView.tsx`), so a stale selection can never silently
 * apply to a different result set. */
export function BulkActionBar({ selectedCount, onSelectVisible, onClearSelection, onAssign, onRemove, busy, onExport, onBatchRefine }: Props) {
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
      {onExport && (
        <button type="button" className="btn btn--small btn--primary" onClick={onExport} disabled={busy || selectedCount === 0}>
          📤 Export
        </button>
      )}
      {onBatchRefine && (
        <button type="button" className="btn btn--small" onClick={onBatchRefine} disabled={busy || selectedCount === 0}>
          🎨 Batch Refine
        </button>
      )}
    </div>
  );
}
