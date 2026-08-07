import { useState } from 'react';
import type { PortfolioAsset } from '../../catalog/domain/types';
import { PALETTES } from '../../palettes/palettes';
import { HIERARCHY_PRESETS } from '../../engine/hierarchy';
import { runBatchRefinement, type BatchRefinementAdjustments, type BatchRefinementItemOutcome } from '../../design/batchRefinement';
import { useModalDismiss } from '../portfolio/useModalDismiss';
import './designEdit.css';

interface Props {
  assets: PortfolioAsset[];
  existingAssets: PortfolioAsset[];
  onClose: () => void;
  onFinished: () => void;
}

function summarize(results: BatchRefinementItemOutcome[]) {
  return {
    applied: results.filter((r) => r.status === 'applied').length,
    duplicate: results.filter((r) => r.status === 'duplicate').length,
    skippedNoParams: results.filter((r) => r.status === 'skippedNoParams').length,
    error: results.filter((r) => r.status === 'error').length,
  };
}

/** Design Refinement Studio Pro, Mission 4 — Batch Refinement. One
 * owner-defined adjustment, applied to every selected asset via
 * `design/batchRefinement.ts`'s `runBatchRefinement` — the exact same
 * non-destructive `saveDesignVersion`/`revalidateDesignVersion` path a
 * single Design Edit Mode Approve already uses, just looped. No new
 * scoring/business logic here, only the adjustment form and progress UI. */
export function BatchRefinementView({ assets, existingAssets, onClose, onFinished }: Props) {
  const { backdropRef, onKeyDown } = useModalDismiss(onClose);
  const [paletteId, setPaletteId] = useState('');
  const [hierarchyPresetId, setHierarchyPresetId] = useState('');
  const [densityDelta, setDensityDelta] = useState(0);
  const [negativeSpaceDelta, setNegativeSpaceDelta] = useState(0);
  const [overlapDelta, setOverlapDelta] = useState(0);
  const [rotationJitterDelta, setRotationJitterDelta] = useState(0);
  const [scaleJitterDelta, setScaleJitterDelta] = useState(0);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<BatchRefinementItemOutcome[] | null>(null);

  const adjustments: BatchRefinementAdjustments = {
    paletteId: paletteId || undefined,
    hierarchyPresetId: hierarchyPresetId || undefined,
    densityDelta: densityDelta || undefined,
    negativeSpaceDelta: negativeSpaceDelta || undefined,
    overlapDelta: overlapDelta || undefined,
    rotationJitterDelta: rotationJitterDelta || undefined,
    scaleJitterDelta: scaleJitterDelta || undefined,
  };
  const hasAnyAdjustment = Object.values(adjustments).some((v) => v !== undefined);

  const handleRun = async () => {
    setRunning(true);
    setResults(null);
    setProgress({ done: 0, total: assets.length });
    const outcomes = await runBatchRefinement(assets, adjustments, existingAssets, (done, total) => setProgress({ done, total }));
    setResults(outcomes);
    setRunning(false);
    onFinished();
  };

  const summary = results ? summarize(results) : null;

  return (
    <div className="portfolio-modal-backdrop" ref={backdropRef} tabIndex={-1} onKeyDown={onKeyDown} role="dialog" aria-modal="true" aria-label="ปรับแต่งหลายชิ้นงานพร้อมกัน">
      <div className="portfolio-modal version-history-modal">
        <div className="portfolio-detail-header">
          <h2>🎨 Batch Refine — {assets.length} ชิ้นงาน</h2>
          <button type="button" className="btn" onClick={onClose} disabled={running}>
            ปิด
          </button>
        </div>

        <p className="metadata-hint">
          ปรับได้ทีละหลายชิ้นงานพร้อมกัน — แต่ละชิ้นงานจะได้เวอร์ชันใหม่ของตัวเอง (ไม่ทับต้นฉบับ) เลือกเฉพาะช่องที่ต้องการเปลี่ยน ช่องที่เว้นว่าง/เป็น 0 จะไม่เปลี่ยนอะไรเลยสำหรับชิ้นงานนั้น
        </p>

        {!results && (
          <div className="design-edit-controls">
            <div className="design-edit-field-row">
              <label htmlFor="batch-palette">Palette (เว้นว่าง = ไม่เปลี่ยน)</label>
              <select id="batch-palette" value={paletteId} onChange={(e) => setPaletteId(e.target.value)} disabled={running}>
                <option value="">— ไม่เปลี่ยน —</option>
                {PALETTES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="design-edit-field-row">
              <label htmlFor="batch-hierarchy">Hierarchy preset (เว้นว่าง = ไม่เปลี่ยน)</label>
              <select id="batch-hierarchy" value={hierarchyPresetId} onChange={(e) => setHierarchyPresetId(e.target.value)} disabled={running}>
                <option value="">— ไม่เปลี่ยน —</option>
                {Object.entries(HIERARCHY_PRESETS).map(([id, p]) => (
                  <option key={id} value={id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="design-edit-field-row">
              <label htmlFor="batch-density">Motif Density: {densityDelta > 0 ? '+' : ''}{Math.round(densityDelta * 100)}%</label>
              <input id="batch-density" type="range" min={-0.5} max={0.5} step={0.05} value={densityDelta} onChange={(e) => setDensityDelta(Number(e.target.value))} disabled={running} />
            </div>

            <div className="design-edit-field-row">
              <label htmlFor="batch-negative-space">Negative Space: {negativeSpaceDelta > 0 ? '+' : ''}{Math.round(negativeSpaceDelta * 100)}%</label>
              <input
                id="batch-negative-space"
                type="range"
                min={-0.5}
                max={0.5}
                step={0.05}
                value={negativeSpaceDelta}
                onChange={(e) => setNegativeSpaceDelta(Number(e.target.value))}
                disabled={running}
              />
            </div>

            <div className="design-edit-field-row">
              <label htmlFor="batch-overlap">Overlap: {overlapDelta > 0 ? '+' : ''}{Math.round(overlapDelta * 100)}%</label>
              <input id="batch-overlap" type="range" min={-0.5} max={0.5} step={0.05} value={overlapDelta} onChange={(e) => setOverlapDelta(Number(e.target.value))} disabled={running} />
            </div>

            <div className="design-edit-field-row">
              <label htmlFor="batch-rotation">Rotation Jitter: {rotationJitterDelta > 0 ? '+' : ''}{Math.round(rotationJitterDelta * 100)}%</label>
              <input
                id="batch-rotation"
                type="range"
                min={-0.5}
                max={0.5}
                step={0.05}
                value={rotationJitterDelta}
                onChange={(e) => setRotationJitterDelta(Number(e.target.value))}
                disabled={running}
              />
            </div>

            <div className="design-edit-field-row">
              <label htmlFor="batch-scale-jitter">Scale Jitter: {scaleJitterDelta > 0 ? '+' : ''}{Math.round(scaleJitterDelta * 100)}%</label>
              <input
                id="batch-scale-jitter"
                type="range"
                min={-0.5}
                max={0.5}
                step={0.05}
                value={scaleJitterDelta}
                onChange={(e) => setScaleJitterDelta(Number(e.target.value))}
                disabled={running}
              />
            </div>

            <button type="button" className="btn btn--primary" disabled={running || !hasAnyAdjustment} onClick={() => void handleRun()}>
              {running ? `กำลังประมวลผล ${progress?.done ?? 0}/${progress?.total ?? assets.length}…` : `✅ ใช้กับ ${assets.length} ชิ้นงาน`}
            </button>
          </div>
        )}

        {summary && (
          <section className="portfolio-detail-section">
            <h3>ผลลัพธ์</h3>
            <ul className="version-history-list">
              <li className="version-history-row">✅ สร้างเวอร์ชันใหม่สำเร็จ: {summary.applied}</li>
              {summary.duplicate > 0 && <li className="version-history-row">⚠ ข้าม (ผลลัพธ์ซ้ำ/อาจซ้ำ): {summary.duplicate}</li>}
              {summary.skippedNoParams > 0 && <li className="version-history-row">⚠ ข้าม (ไม่มีพารามิเตอร์ต้นฉบับ): {summary.skippedNoParams}</li>}
              {summary.error > 0 && <li className="version-history-row portfolio-error-text">❌ ผิดพลาด: {summary.error}</li>}
            </ul>
            <button type="button" className="btn btn--primary" onClick={onClose}>
              เสร็จสิ้น
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
