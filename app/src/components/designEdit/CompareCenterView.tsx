import { useEffect, useState } from 'react';
import type { PortfolioAsset } from '../../catalog/domain/types';
import { loadDesignParamsForAsset } from '../../design/designParamsIO';
import { evaluateDesign, type DesignEvaluation } from '../../design/designEvaluation';
import type { PatternBeautyScore } from '../../engine/patternBeautyScore';
import { diffJson, type JsonDiffEntry } from '../../workbench/jsonDiff';
import { buildPreviewMarkup } from '../../export/previewMarkup';
import { PreviewCanvas } from '../PreviewCanvas';
import { useModalDismiss } from '../portfolio/useModalDismiss';
import './designEdit.css';

interface Props {
  assetA: PortfolioAsset;
  assetB: PortfolioAsset;
  onClose: () => void;
}

type ViewMode = 'sideBySide' | 'slider';

function scoreDeltaClass(delta: number): string {
  if (delta > 0.5) return 'compare-delta--up';
  if (delta < -0.5) return 'compare-delta--down';
  return 'compare-delta--flat';
}

/** Design Refinement Studio Pro, Mission 3 — Compare Center. Both sides
 * are evaluated with the exact same `evaluateDesign` (Mission 2's live
 * evaluation engine) the Inspector already uses — no separate comparison
 * scoring model. The params diff reuses `workbench/jsonDiff.ts`'s already
 * generic, spec-agnostic `diffJson` (built for the Design Workbench's own
 * "Compare versions" feature) rather than writing a second diff engine. */
export function CompareCenterView({ assetA, assetB, onClose }: Props) {
  const { backdropRef, onKeyDown } = useModalDismiss(onClose);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [evalA, setEvalA] = useState<DesignEvaluation | null>(null);
  const [evalB, setEvalB] = useState<DesignEvaluation | null>(null);
  const [paramsDiff, setParamsDiff] = useState<JsonDiffEntry[]>([]);
  const [mode, setMode] = useState<ViewMode>('sideBySide');
  const [sliderPct, setSliderPct] = useState(50);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([loadDesignParamsForAsset(assetA), loadDesignParamsForAsset(assetB)]).then(([paramsA, paramsB]) => {
      if (cancelled) return;
      if (!paramsA || !paramsB) {
        setLoadError('เปรียบเทียบไม่ได้ — เวอร์ชันหนึ่งไม่มีพารามิเตอร์การออกแบบต้นฉบับ (อาจนำเข้าด้วยมือโดยไม่มี JSON)');
        setLoading(false);
        return;
      }
      setEvalA(evaluateDesign(paramsA));
      setEvalB(evaluateDesign(paramsB));
      setParamsDiff(diffJson(paramsA, paramsB));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [assetA, assetB]);

  const sliderMarkupA = evalA ? buildPreviewMarkup(evalA.tileData, 1, 'compare-slider-a') : '';
  const sliderMarkupB = evalB ? buildPreviewMarkup(evalB.tileData, 1, 'compare-slider-b') : '';
  const tileSize = evalA?.tileData.params.tileSize ?? evalB?.tileData.params.tileSize ?? 400;
  const beautyKeys = evalA ? (Object.keys(evalA.beauty) as (keyof PatternBeautyScore)[]) : [];

  return (
    <div className="portfolio-modal-backdrop" ref={backdropRef} tabIndex={-1} onKeyDown={onKeyDown} role="dialog" aria-modal="true" aria-label="เปรียบเทียบเวอร์ชัน">
      <div className="portfolio-modal compare-center-modal">
        <div className="portfolio-detail-header">
          <h2>🔍 Compare Center</h2>
          <button type="button" className="btn" onClick={onClose}>
            ปิด
          </button>
        </div>

        {loading && <p className="metadata-hint">กำลังโหลด…</p>}
        {loadError && (
          <p className="portfolio-error-text" role="alert">
            {loadError}
          </p>
        )}

        {evalA && evalB && (
          <>
            <div className="compare-mode-toggle" role="group" aria-label="โหมดเปรียบเทียบ">
              <button type="button" className={`btn btn--small${mode === 'sideBySide' ? ' btn--primary' : ''}`} onClick={() => setMode('sideBySide')}>
                Side-by-side
              </button>
              <button type="button" className={`btn btn--small${mode === 'slider' ? ' btn--primary' : ''}`} onClick={() => setMode('slider')}>
                Slider Overlay
              </button>
            </div>

            {mode === 'sideBySide' ? (
              <div className="compare-side-by-side">
                <div className="compare-pane">
                  <h4>{assetA.displayName}</h4>
                  <PreviewCanvas tileData={evalA.tileData} instanceId="compare-a" />
                </div>
                <div className="compare-pane">
                  <h4>{assetB.displayName}</h4>
                  <PreviewCanvas tileData={evalB.tileData} instanceId="compare-b" />
                </div>
              </div>
            ) : (
              <div className="compare-slider-wrap">
                <div className="compare-slider-labels">
                  <span>{assetA.displayName}</span>
                  <span>{assetB.displayName}</span>
                </div>
                <div className="compare-slider-canvas">
                  <svg viewBox={`0 0 ${tileSize} ${tileSize}`} className="compare-slider-svg" dangerouslySetInnerHTML={{ __html: sliderMarkupB }} />
                  <div className="compare-slider-clip" style={{ clipPath: `inset(0 ${100 - sliderPct}% 0 0)` }}>
                    <svg viewBox={`0 0 ${tileSize} ${tileSize}`} className="compare-slider-svg" dangerouslySetInnerHTML={{ __html: sliderMarkupA }} />
                  </div>
                  <div className="compare-slider-handle" style={{ left: `${sliderPct}%` }} />
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={sliderPct}
                  onChange={(e) => setSliderPct(Number(e.target.value))}
                  aria-label="เลื่อนเพื่อเปรียบเทียบ"
                  className="compare-slider-input"
                />
              </div>
            )}

            <section className="portfolio-detail-section">
              <h3>Quality Score เปรียบเทียบ</h3>
              <table className="compare-score-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>{assetA.displayName}</th>
                    <th>{assetB.displayName}</th>
                    <th>ต่าง</th>
                  </tr>
                </thead>
                <tbody>
                  {beautyKeys.map((key) => {
                    const a = evalA.beauty[key];
                    const b = evalB.beauty[key];
                    const delta = b - a;
                    return (
                      <tr key={key}>
                        <td>{key}</td>
                        <td>{Math.round(a)}</td>
                        <td>{Math.round(b)}</td>
                        <td className={scoreDeltaClass(delta)}>
                          {delta > 0 ? '+' : ''}
                          {Math.round(delta)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            <section className="portfolio-detail-section">
              <h3>พารามิเตอร์ที่ต่างกัน ({paramsDiff.length})</h3>
              {paramsDiff.length === 0 ? (
                <p className="metadata-hint">พารามิเตอร์เหมือนกันทุกจุด</p>
              ) : (
                <ul className="compare-params-diff">
                  {paramsDiff.map((entry) => (
                    <li key={entry.path}>
                      <code>{entry.path}</code>: {JSON.stringify(entry.before)} → {JSON.stringify(entry.after)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
