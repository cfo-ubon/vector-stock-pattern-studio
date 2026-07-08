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
}

function Thumb({ tileData, instanceId }: { tileData: TileData; instanceId: string }) {
  const markup = useMemo(() => buildPreviewMarkup(tileData, 2, instanceId), [tileData, instanceId]);
  const { tileSize } = tileData.params;
  return (
    <svg viewBox={`0 0 ${tileSize * 2} ${tileSize * 2}`} dangerouslySetInnerHTML={{ __html: markup }} />
  );
}

export function Gallery({ items, selectedId, onSelect, onRemove, onClear }: Props) {
  return (
    <div className="gallery">
      <div className="gallery-header">
        <h3>Gallery ({items.length})</h3>
        {items.length > 0 && (
          <button type="button" className="link-btn" onClick={onClear}>
            Clear all
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="gallery-empty">Generated patterns will be saved here for this session.</p>
      ) : (
        <div className="gallery-grid">
          {items.map((item) => (
            <div
              key={item.id}
              className={`gallery-thumb ${item.id === selectedId ? 'gallery-thumb--active' : ''}`}
              onClick={() => onSelect(item)}
            >
              <Thumb tileData={item.tileData} instanceId={item.id} />
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
          ))}
        </div>
      )}
    </div>
  );
}
