import { useMemo, useState } from 'react';
import type { TileData } from '../engine/types';
import { buildPreviewMarkup } from '../export/previewMarkup';

interface Props {
  tileData: TileData | null;
  /** Called when the user drags the post-gen pattern-scale slider.
   * Receives the new scale factor (1 = as generated). */
  onRescale?: (patternScale: number) => void;
  /** `buildPreviewMarkup`'s own SVG-id namespace — must be unique among
   * every `PreviewCanvas` mounted on the page at once (see that function's
   * doc comment). Defaults to `'main'`, the single-canvas case every
   * existing caller relies on; Compare Center (Mission 3) is the first
   * caller that mounts two at once and must pass distinct ids. */
  instanceId?: string;
}

const REPEAT_OPTIONS = [
  { n: 1, label: '1×1 (ภาพเดี่ยว)' },
  { n: 2, label: '2×2' },
  { n: 3, label: '3×3 (เช็ค seamless)' },
  { n: 4, label: '4×4' },
];

/** Design Refinement Studio Pro, Mission 5 (Pattern Safety) — draws one
 * dashed border per tile instance at its real, predictable position within
 * the repeated grid (`buildPreviewMarkup`'s own `<pattern>` tiles at
 * `x = i * tileSize, y = j * tileSize` — see that function's doc comment),
 * appended as a sibling `<g>` after the pattern fill so it renders in the
 * same coordinate space with no extra positioning/overlay element needed. */
function buildTileBorderOverlay(tileSize: number, repeat: number): string {
  let rects = '';
  for (let j = 0; j < repeat; j++) {
    for (let i = 0; i < repeat; i++) {
      rects += `<rect x="${i * tileSize}" y="${j * tileSize}" width="${tileSize}" height="${tileSize}" fill="none" stroke="#ff3b6f" stroke-width="2" stroke-dasharray="10 6" />`;
    }
  }
  return `<g class="tile-border-overlay" pointer-events="none">${rects}</g>`;
}

export function PreviewCanvas({ tileData, onRescale, instanceId = 'main' }: Props) {
  // Defaults to 1x1 since the primary sale format is a single standalone
  // image, not a repeated swatch — 3x3 stays one click away to verify
  // seamlessness before export.
  const [repeat, setRepeat] = useState(1);
  const [showTileBorders, setShowTileBorders] = useState(false);
  const markup = useMemo(() => {
    if (!tileData) return '';
    const base = buildPreviewMarkup(tileData, repeat, instanceId);
    return showTileBorders ? base + buildTileBorderOverlay(tileData.params.tileSize, repeat) : base;
  }, [tileData, repeat, instanceId, showTileBorders]);

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
        <button
          type="button"
          className={`tile-border-toggle${showTileBorders ? ' active' : ''}`}
          onClick={() => setShowTileBorders((v) => !v)}
          aria-pressed={showTileBorders}
        >
          🔲 แสดงเส้นขอบ Tile
        </button>
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
