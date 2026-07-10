import { useMemo } from 'react';
import type { TileData } from '../engine/types';
import { computeTrendFit, TREND_PRESETS } from '../engine/trendEngine';

interface Props {
  tileData: TileData | null;
}

const ROWS: Array<{ key: keyof NonNullable<ReturnType<typeof computeTrendFit>>; label: string }> = [
  { key: 'hueFit', label: 'Hue' },
  { key: 'saturationFit', label: 'Saturation' },
  { key: 'lightnessFit', label: 'Lightness' },
  { key: 'densityFit', label: 'Density' },
  { key: 'overlapFit', label: 'Overlap' },
];

function scoreColor(v: number): string {
  if (v >= 80) return '#5fbf7f';
  if (v >= 55) return '#e0b84a';
  return '#e0715a';
}

/** Only rendered when the current pattern has a Trend Intelligence preset
 * applied (`params.trend`). Shows how closely the *actual* generated
 * colors/density/overlap match that trend's declared reference ranges —
 * computed from real HSL statistics of the colors in use and the real
 * density/overlap settings, not a static label. */
export function TrendPanel({ tileData }: Props) {
  const trendId = tileData?.params.trend;
  const preset = trendId ? TREND_PRESETS[trendId] : undefined;
  const fit = useMemo(() => (tileData && trendId ? computeTrendFit(tileData, trendId) : null), [tileData, trendId]);
  if (!tileData || !trendId || !preset || !fit) return null;

  return (
    <div className="quality-panel">
      <div className="metadata-header">
        <h3>📈 Trend Fit — {preset.label}</h3>
        <span className="metadata-hint">คำนวณจาก HSL จริงของสีที่ใช้ + ค่า density/overlap จริง (heuristic ภายในเครื่อง)</span>
      </div>
      <div className="quality-overall">
        <span className="quality-overall-num" style={{ color: scoreColor(fit.overall) }}>
          {fit.overall}
        </span>
        <span className="quality-overall-label">/ 100</span>
      </div>
      <div className="quality-rows">
        {ROWS.map((r) => (
          <div className="quality-row" key={r.key}>
            <span className="quality-row-label">{r.label}</span>
            <div className="quality-bar">
              <div className="quality-bar-fill" style={{ width: `${fit[r.key]}%`, background: scoreColor(fit[r.key]) }} />
            </div>
            <span className="quality-row-num">{fit[r.key]}</span>
          </div>
        ))}
      </div>
      <p className="metadata-hint">
        ⚠️ เป็นการเทียบลักษณะสี/องค์ประกอบภายในเครื่องกับเกณฑ์ที่ผู้พัฒนากำหนดไว้ล่วงหน้าเท่านั้น — ไม่ใช่ข้อมูลเทรนด์แบบเรียลไทม์
        จากอินเทอร์เน็ต และไม่ใช่การรับประกันความนิยมในตลาดจริง
      </p>
    </div>
  );
}
