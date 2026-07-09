import { useMemo, useState } from 'react';
import type { TileData } from '../engine/types';
import { buildPreviewMarkup } from '../export/previewMarkup';

interface Props {
  tileData: TileData | null;
  /** Called when the user drags the post-gen pattern-scale slider.
   * Receives the new scale factor (1 = as generated). */
  onRescale?: (patternScale: number) => void;
}

const REPEAT_OPTIONS = [
  { n: 1, label: '1×1 (ภาพเดี่ยว)' },
  { n: 2, label: '2×2' },
  { n: 3, label: '3×3 (เช็ค seamless)' },
  { n: 4, label: '4×4' },
];

export function PreviewCanvas({ tileData, onRescale }: Props) {
  // Defaults to 1x1 since the primary sale format is a single standalone
  // image, not a repeated swatch — 3x3 stays one click away to verify
  // seamlessness before export.
  const [repeat, setRepeat] = useState(1);
  const markup = useMemo(() => (tileData ? buildPreviewMarkup(tileData, repeat, 'main') : ''), [tileData, repeat]);

  if (!tileData) {
    return (
      <div className="preview-canvas preview-canvas--empty">
        <p>Click "Generate" to create a pattern.</p>
      </div>
    );
  }

  const { tileSize } = tileData.params;
  const scalePct = Math.round((tileData.params.patternScale ?? 1) * 100);

  return (
    <div className="preview-canvas">
      <div className="preview-toolbar">
        <span>Tile preview</span>
        <div className="repeat-toggle">
          {REPEAT_OPTIONS.map(({ n, label }) => (
            <button key={n} type="button" className={n === repeat ? 'active' : ''} onClick={() => setRepeat(n)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {onRescale && (
        <div className="rescale-row">
          <span className="rescale-label">
            🔍 ขนาดลวดลาย: <strong>{scalePct}%</strong>
          </span>
          <input
            type="range"
            min={40}
            max={250}
            step={5}
            value={scalePct}
            onChange={(e) => onRescale(Number(e.target.value) / 100)}
            aria-label="Pattern scale"
          />
          <button
            type="button"
            className="stepper-btn"
            disabled={scalePct === 100}
            onClick={() => onRescale(1)}
          >
            100%
          </button>
          <span className="rescale-hint">
            ปรับหลัง gen ได้เลย — ความหนาแน่นคงสัดส่วนเดิมอัตโนมัติ (ลายเดิม seed เดิม แค่ละเอียดขึ้น/ใหญ่ขึ้น)
          </span>
        </div>
      )}
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
