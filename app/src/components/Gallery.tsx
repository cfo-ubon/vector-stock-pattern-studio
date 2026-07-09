import { useMemo } from 'react';
import type { TileData } from '../engine/types';
import { buildPreviewMarkup } from '../export/previewMarkup';

export interface GalleryItem {
  id: string;
  tileData: TileData;
  createdAt: number;
}

interface Props {
  items: GalleryItem[];
  selectedId: string | null;
  onSelect: (item: GalleryItem) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  /** Multi-select for batch save-to-library. */
  checkedIds: ReadonlySet<string>;
  onToggleCheck: (id: string) => void;
  onSaveChecked: () => void;
}

function Thumb({ tileData, instanceId }: { tileData: TileData; instanceId: string }) {
  const markup = useMemo(() => buildPreviewMarkup(tileData, 2, instanceId), [tileData, instanceId]);
  const { tileSize } = tileData.params;
  return (
    <svg viewBox={`0 0 ${tileSize * 2} ${tileSize * 2}`} dangerouslySetInnerHTML={{ __html: markup }} />
  );
}

export function Gallery({ items, selectedId, onSelect, onRemove, onClear, checkedIds, onToggleCheck, onSaveChecked }: Props) {
  return (
    <div className="gallery">
      <div className="gallery-header">
        <h3>Gallery ({items.length})</h3>
        <div className="gallery-header-actions">
          {checkedIds.size > 0 && (
            <button type="button" className="btn btn--save" onClick={onSaveChecked}>
              💾 บันทึกที่ติ๊กเข้าคลัง ({checkedIds.size})
            </button>
          )}
          {items.length > 0 && (
            <button type="button" className="link-btn" onClick={onClear}>
              Clear all
            </button>
          )}
        </div>
      </div>
      {items.length === 0 ? (
        <p className="gallery-empty">Generated patterns will be saved here for this session.</p>
      ) : (
        <>
          <p className="gallery-hint">ติ๊กมุมซ้ายบนของหลายๆ ลายเพื่อบันทึกเข้าคลังเป็นชุดเดียว</p>
          <div className="gallery-grid">
            {items.map((item) => {
              const checked = checkedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`gallery-thumb ${item.id === selectedId ? 'gallery-thumb--active' : ''}`}
                  onClick={() => onSelect(item)}
                >
                  <Thumb tileData={item.tileData} instanceId={item.id} />
                  <button
                    type="button"
                    className={`gallery-thumb__check ${checked ? 'gallery-thumb__check--on' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleCheck(item.id);
                    }}
                    aria-label={checked ? 'เอาออกจากที่เลือก' : 'เลือกเพื่อบันทึกเข้าคลัง'}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    className="gallery-thumb__remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(item.id);
                    }}
                    aria-label="Remove from gallery"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
