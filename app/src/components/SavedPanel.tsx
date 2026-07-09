import { useMemo, useRef } from 'react';
import type { TileData } from '../engine/types';
import { buildPreviewMarkup } from '../export/previewMarkup';
import { STOCK_SITES, type StockSiteId } from '../metadata/shutterstock';

/** A pattern the user chose to keep long-term, with per-stock-site
 * submission tracking ("ส่งขายเว็บไหนแล้วบ้าง") and a free-text note.
 * Persisted to localStorage, independent of the rolling Gallery. */
export interface SavedItem {
  id: string;
  tileData: TileData;
  /** Human-readable name derived from palette/category/layout at save time. */
  name: string;
  createdAt: number;
  note: string;
  submissions: Partial<Record<StockSiteId, boolean>>;
}

interface Props {
  items: SavedItem[];
  hasCurrent: boolean;
  onSaveCurrent: () => void;
  onLoad: (item: SavedItem) => void;
  onRemove: (id: string) => void;
  onToggleSubmission: (id: string, site: StockSiteId) => void;
  onNoteChange: (id: string, note: string) => void;
  /** Re-download this item's file bundle (single + 3x3 + SEO zip). */
  onDownload: (item: SavedItem) => void;
  /** Download the whole library as one zip then clear it automatically. */
  onMoveAllToDisk: () => void;
  /** Restore/merge a library from a library-backup.json file. */
  onImportBackup: (file: File) => void;
  /** Download a batch-upload metadata CSV for the whole library. */
  onExportCsv: (site: 'shutterstock' | 'adobestock') => void;
}

function Thumb({ tileData, instanceId }: { tileData: TileData; instanceId: string }) {
  const markup = useMemo(() => buildPreviewMarkup(tileData, 2, instanceId), [tileData, instanceId]);
  const { tileSize } = tileData.params;
  return <svg viewBox={`0 0 ${tileSize * 2} ${tileSize * 2}`} dangerouslySetInnerHTML={{ __html: markup }} />;
}

export function SavedPanel({
  items,
  hasCurrent,
  onSaveCurrent,
  onLoad,
  onRemove,
  onToggleSubmission,
  onNoteChange,
  onDownload,
  onMoveAllToDisk,
  onImportBackup,
  onExportCsv,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="saved-panel">
      <div className="gallery-header">
        <h3>📌 คลังลายที่บันทึก ({items.length})</h3>
        <button type="button" className="btn btn--save" disabled={!hasCurrent} onClick={onSaveCurrent}>
          💾 บันทึกเข้าคลัง + ดาวน์โหลดชุดไฟล์
        </button>
      </div>
      <div className="saved-toolbar">
        <button type="button" className="btn btn--save" disabled={items.length === 0} onClick={onMoveAllToDisk}>
          📦 ย้ายทั้งคลังลงเครื่อง (ดาวน์โหลดแล้วล้างคลังอัตโนมัติ)
        </button>
        <button type="button" className="btn btn--save" onClick={() => fileInputRef.current?.click()}>
          📥 นำเข้า backup
        </button>
        <button
          type="button"
          className="btn btn--save"
          disabled={items.length === 0}
          onClick={() => onExportCsv('shutterstock')}
          title="CSV ผูก metadata กับไฟล์เป็นชุดตอนอัปโหลด Shutterstock — ไม่ต้องกรอกฟอร์มทีละภาพ"
        >
          📄 CSV Shutterstock
        </button>
        <button
          type="button"
          className="btn btn--save"
          disabled={items.length === 0}
          onClick={() => onExportCsv('adobestock')}
          title="CSV ผูก metadata กับไฟล์เป็นชุดตอนอัปโหลด Adobe Stock — ไม่ต้องกรอกฟอร์มทีละภาพ"
        >
          📄 CSV Adobe Stock
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImportBackup(f);
            e.target.value = '';
          }}
        />
        <span className="saved-storage-note">
          คลังเก็บใน IndexedDB ของเบราว์เซอร์ — ไม่จำกัดจำนวนลาย (จุได้หลาย GB)
        </span>
      </div>
      {items.length === 0 ? (
        <p className="gallery-empty">
          กด "บันทึกเข้าคลัง" เพื่อเก็บลายที่จะส่งขายไว้ถาวร — ระบบจะดาวน์โหลดชุดไฟล์ให้อัตโนมัติทันที
          (zip เดียว: SVG ภาพเดี่ยว + SVG 3×3 ขนาดเต็ม 10000px + ไฟล์ SEO ครบทุกเว็บ)
          พร้อมติ๊กสถานะว่าส่งขายเว็บไหนแล้วบ้าง
        </p>
      ) : (
        <div className="saved-list">
          {items.map((item) => {
            const submittedCount = STOCK_SITES.filter((s) => item.submissions[s.id]).length;
            return (
              <div key={item.id} className="saved-card">
                <div className="saved-thumb" onClick={() => onLoad(item)} title="คลิกเพื่อโหลดลายนี้กลับมาที่ preview (SEO จะอัปเดตตาม)">
                  <Thumb tileData={item.tileData} instanceId={`saved-${item.id}`} />
                </div>
                <div className="saved-info">
                  <div className="saved-name-row">
                    <strong className="saved-name">{item.name}</strong>
                    <span className={`saved-badge ${submittedCount === STOCK_SITES.length ? 'saved-badge--done' : ''}`}>
                      ส่งแล้ว {submittedCount}/{STOCK_SITES.length} เว็บ
                    </span>
                  </div>
                  <div className="saved-sites">
                    {STOCK_SITES.map((s) => (
                      <label key={s.id} className={`saved-site ${item.submissions[s.id] ? 'saved-site--on' : ''}`}>
                        <input
                          type="checkbox"
                          checked={!!item.submissions[s.id]}
                          onChange={() => onToggleSubmission(item.id, s.id)}
                        />
                        <span>{s.label}</span>
                      </label>
                    ))}
                  </div>
                  <input
                    className="saved-note"
                    type="text"
                    placeholder="โน้ต เช่น วันที่ส่ง, ผลรีวิว, ยอดขาย..."
                    value={item.note}
                    onChange={(e) => onNoteChange(item.id, e.target.value)}
                  />
                  <div className="saved-actions">
                    <button type="button" className="link-btn" onClick={() => onDownload(item)}>
                      ⬇️ ดาวน์โหลดชุดไฟล์
                    </button>
                    <button type="button" className="link-btn" onClick={() => onLoad(item)}>
                      โหลดกลับมาแก้/ดู SEO
                    </button>
                    <button
                      type="button"
                      className="link-btn link-btn--danger"
                      onClick={() => {
                        if (window.confirm(`ลบ "${item.name}" ออกจากคลัง?`)) onRemove(item.id);
                      }}
                    >
                      ลบ
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
