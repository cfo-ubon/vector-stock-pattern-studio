import { useMemo, useState } from 'react';
import type { TileData } from '../engine/types';
import { buildPreviewMarkup } from '../export/previewMarkup';

interface Props {
  tileData: TileData | null;
}

export function PreviewCanvas({ tileData }: Props) {
  const [repeat, setRepeat] = useState(3);
  const markup = useMemo(() => (tileData ? buildPreviewMarkup(tileData, repeat, 'main') : ''), [tileData, repeat]);

  if (!tileData) {
    return (
      <div className="preview-canvas preview-canvas--empty">
        <p>Click "Generate" to create a pattern.</p>
      </div>
    );
  }

  const { tileSize } = tileData.params;

  return (
    <div className="preview-canvas">
      <div className="preview-toolbar">
        <span>Tile preview</span>
        <div className="repeat-toggle">
          {[2, 3, 4].map((n) => (
            <button key={n} type="button" className={n === repeat ? 'active' : ''} onClick={() => setRepeat(n)}>
              {n}x{n}
            </button>
          ))}
        </div>
      </div>
      <div className="preview-surface">
        <svg
          viewBox={`0 0 ${tileSize * repeat} ${tileSize * repeat}`}
          className="preview-svg"
          role="img"
          aria-label="Seamless pattern preview"
          dangerouslySetInnerHTML={{ __html: markup }}
        />
      </div>
    </div>
  );
}
