import { useEffect, useMemo, useRef, useState } from 'react';
import type { PortfolioAsset } from '../../catalog/domain/types';
import type { GenerateParams } from '../../engine/types';
import type { CommercialReadinessReport } from '../../commercial/domain/types';
import { loadDesignParamsForAsset } from '../../design/designParamsIO';
import { evaluateDesign, type DesignEvaluation } from '../../design/designEvaluation';
import { saveDesignVersion } from '../../design/designVersioning';
import { revalidateDesignVersion } from '../../design/designRevalidation';
import { hasSeamBreakRisk } from '../../design/patternSafety';
import { createHistory, pushHistory, undoHistory, redoHistory, canUndo, canRedo, type HistoryState } from '../../workbench/workbenchHistory';
import { PreviewCanvas } from '../PreviewCanvas';
import { DesignEditControls } from './DesignEditControls';
import { DesignInspectorPanel } from './DesignInspectorPanel';
import { DesignCoachPanel } from './DesignCoachPanel';
import type { ImportOutcome } from '../../catalog/import/importPipeline';
import './designEdit.css';

interface Props {
  asset: PortfolioAsset;
  existingAssets: PortfolioAsset[];
  originalReadiness: CommercialReadinessReport | null;
  onClose: () => void;
  /** Called after a version is successfully saved, so the caller can
   * reload the portfolio — the new version is a normal `PortfolioAsset`,
   * nothing about this screen owns its own separate storage. */
  onSaved: () => void;
}

const EVALUATE_DEBOUNCE_MS = 200;

/** Design Refinement Studio Pro, Mission 1/3/5 — Design Edit Mode. Loads
 * the asset's own real `GenerateParams`, lets the owner adjust them with
 * live re-evaluation on every change (Mission 5's Live Regeneration), and
 * "Approve" persists the result as a brand-new linked `PortfolioAsset`
 * (Mission 6's non-destructive versioning) — the original this screen was
 * opened from is never written to. */
export function DesignEditView({ asset, existingAssets, originalReadiness, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryState<GenerateParams>>(createHistory<GenerateParams>());
  const [evaluation, setEvaluation] = useState<DesignEvaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveOutcome, setSaveOutcome] = useState<ImportOutcome | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [revalidating, setRevalidating] = useState(false);
  const [revalidationError, setRevalidationError] = useState<string | null>(null);
  const [revalidatedScore, setRevalidatedScore] = useState<{ commercialScore: number; band: string } | null>(null);
  const [actionCount, setActionCount] = useState(0);
  const [safetyConfirmed, setSafetyConfirmed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    loadDesignParamsForAsset(asset).then((params) => {
      if (cancelled) return;
      if (!params) {
        setLoadError('ไม่พบพารามิเตอร์การออกแบบของชิ้นงานนี้ — อาจเป็นไฟล์ที่นำเข้าด้วยมือโดยไม่มี JSON ต้นฉบับ จึงยังแก้ไขแบบไม่ทำลายต้นฉบับไม่ได้');
        setLoading(false);
        return;
      }
      setHistory(createHistory(params));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.assetId]);

  const params = history.present;

  useEffect(() => {
    if (!params) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setEvaluating(true);
    debounceRef.current = setTimeout(() => {
      setEvaluation(evaluateDesign(params));
      setEvaluating(false);
    }, EVALUATE_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [params]);

  const handleChange = (patch: Partial<GenerateParams>) => {
    if (!params) return;
    setHistory((h) => pushHistory(h, { ...params, ...patch }));
    setActionCount((n) => n + 1);
    setSaveOutcome(null);
    setSafetyConfirmed(false);
  };

  // Mission 5 — Pattern Safety: Approve requires one explicit confirmation
  // click when `hasSeamBreakRisk` is true, the same "warn, don't silently
  // block or silently allow" pattern already used for possibleDuplicate.
  const hasSeamRisk = evaluation ? hasSeamBreakRisk(evaluation) : false;

  const handleApprove = async (forceImportAsNew: boolean) => {
    if (!params || !evaluation) return;
    if (hasSeamRisk && !safetyConfirmed) return;
    setSaving(true);
    setSaveError(null);
    setRevalidationError(null);
    setRevalidatedScore(null);
    setActionCount((n) => n + 1);
    try {
      const outcome = await saveDesignVersion(asset, params, evaluation.tileData, existingAssets, { forceImportAsNew });
      setSaveOutcome(outcome);
      if (outcome.status === 'imported') {
        setRevalidating(true);
        try {
          // Mission 2 — Commercial Revalidation: a brand-new Design Version
          // has no QualitySnapshot yet; re-run the exact same QA/readiness
          // pipeline Factory/Autopilot already run on every asset so it
          // isn't left permanently "never evaluated."
          const revalidation = await revalidateDesignVersion(outcome.asset, evaluation.tileData, existingAssets, []);
          setRevalidatedScore({ commercialScore: revalidation.snapshot.commercialScore, band: revalidation.readiness.band });
        } catch (e) {
          setRevalidationError(e instanceof Error ? e.message : 'ตรวจสอบ Commercial Readiness ของเวอร์ชันใหม่ไม่สำเร็จ');
        } finally {
          setRevalidating(false);
        }
        onSaved();
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'บันทึกเวอร์ชันใหม่ไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const hasEdits = useMemo(() => canUndo(history), [history]);

  return (
    <div className="design-edit-backdrop" role="dialog" aria-modal="true" aria-label={`ปรับแต่งลาย — ${asset.displayName}`}>
      <div className="design-edit-view">
        <div className="design-edit-header">
          <div>
            <h2>🎨 Edit Design — {asset.displayName}</h2>
            <p className="metadata-hint">ทุกการแก้ไขจะบันทึกเป็นเวอร์ชันใหม่เสมอ — ต้นฉบับจะไม่ถูกเขียนทับ</p>
          </div>
          <div className="design-edit-header-actions">
            <span className="metadata-hint">Actions this session: {actionCount}</span>
            <button type="button" className="btn" onClick={onClose}>
              ปิด
            </button>
          </div>
        </div>

        {loading && <p className="metadata-hint">กำลังโหลดพารามิเตอร์…</p>}
        {loadError && <p className="portfolio-error-text" role="alert">{loadError}</p>}

        {params && (
          <div className="design-edit-body">
            <div className="design-edit-controls-col">
              <div className="design-edit-history-bar">
                <button type="button" className="btn btn--small" disabled={!canUndo(history)} onClick={() => setHistory(undoHistory)}>
                  ↶ Undo
                </button>
                <button type="button" className="btn btn--small" disabled={!canRedo(history)} onClick={() => setHistory(redoHistory)}>
                  ↷ Redo
                </button>
              </div>
              <DesignEditControls params={params} onChange={handleChange} />
            </div>

            <div className="design-edit-preview-col">
              <PreviewCanvas tileData={evaluation?.tileData ?? null} />
              <div className="design-edit-approve-bar">
                {hasSeamRisk && !safetyConfirmed && (
                  <div className="design-edit-save-warning" role="alert">
                    <p>
                      🧵 มุม tile 4 มุมเสี่ยงเป็นรอยกากบาทว่างเมื่อต่อลายซ้ำ (Corner Continuity ต่ำ) — ตรวจสอบที่พรีวิว 3×3/4×4 หรือเปิด "แสดงเส้นขอบ Tile"
                      ก่อนบันทึก
                    </p>
                    <button type="button" className="btn btn--small" onClick={() => setSafetyConfirmed(true)}>
                      เข้าใจแล้ว บันทึกต่อ
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={saving || revalidating || !hasEdits || (hasSeamRisk && !safetyConfirmed)}
                  onClick={() => handleApprove(false)}
                >
                  {saving ? 'กำลังบันทึก…' : '✅ Approve — Save as New Version'}
                </button>
                {saveOutcome?.status === 'possibleDuplicate' && (
                  <div className="design-edit-save-warning">
                    <p>ผลลัพธ์นี้อาจซ้ำกับ "{saveOutcome.existingAsset.displayName}" — บันทึกเป็นเวอร์ชันใหม่ต่อไปหรือไม่?</p>
                    <button type="button" className="btn btn--small" onClick={() => handleApprove(true)}>
                      บันทึกเป็นเวอร์ชันใหม่ต่อไป
                    </button>
                  </div>
                )}
                {saveOutcome?.status === 'blockedDuplicate' && (
                  <p className="portfolio-error-text" role="alert">
                    ผลลัพธ์นี้ตรงกับ "{saveOutcome.existingAsset.displayName}" ทุก byte — ไม่มีการเปลี่ยนแปลงจริงให้บันทึก
                  </p>
                )}
                {saveOutcome?.status === 'imported' && <p className="metadata-hint">✅ บันทึกเวอร์ชันใหม่แล้ว — ต้นฉบับยังอยู่ครบ</p>}
                {revalidating && <p className="metadata-hint">กำลังตรวจสอบ Commercial Readiness ของเวอร์ชันใหม่…</p>}
                {revalidatedScore && (
                  <p className="metadata-hint">
                    📊 Commercial Revalidation: score {revalidatedScore.commercialScore} — {revalidatedScore.band}
                  </p>
                )}
                {revalidationError && (
                  <p className="portfolio-error-text" role="alert">
                    {revalidationError}
                  </p>
                )}
                {saveError && (
                  <p className="portfolio-error-text" role="alert">
                    {saveError}
                  </p>
                )}
              </div>
            </div>

            <div className="design-edit-inspector-col">
              <DesignInspectorPanel evaluation={evaluation} evaluating={evaluating} originalReadiness={originalReadiness} />
              <DesignCoachPanel evaluation={evaluation} originalReadiness={originalReadiness} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
