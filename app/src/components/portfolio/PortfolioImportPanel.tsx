import { useCallback, useRef, useState } from 'react';
import type { PortfolioAsset } from '../../catalog/domain/types';
import { importFileGroup, importFiles, type ImportOutcome } from '../../catalog/import/importPipeline';
import { useModalDismiss } from './useModalDismiss';

interface Props {
  existingAssets: PortfolioAsset[];
  onImported: () => void;
  onClose: () => void;
}

const OUTCOME_LABEL_TH: Record<ImportOutcome['status'], string> = {
  imported: 'นำเข้าแล้ว',
  blockedDuplicate: 'ซ้ำกับที่มีอยู่ (ถูกบล็อก)',
  possibleDuplicate: 'อาจซ้ำ (รอตัดสินใจ)',
  error: 'ผิดพลาด',
};

/** Sprint P1, Section 5 (Import Workflow) UI: drag-and-drop + file picker,
 * groups by basename (spec's `spring-garden-001.svg/.png/.json` example),
 * runs `importFiles`, and shows a clear per-group result summary
 * including explicit resolution for `possibleDuplicate` groups (Section 4:
 * "warn the user and allow an explicit import-as-new decision"). */
export function PortfolioImportPanel({ existingAssets, onImported, onClose }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [outcomes, setOutcomes] = useState<ImportOutcome[]>([]);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const runImport = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setImporting(true);
      try {
        const result = await importFiles(files, existingAssets);
        setOutcomes((prev) => [...result.outcomes, ...prev]);
        if (result.importedCount > 0) onImported();
      } finally {
        setImporting(false);
      }
    },
    [existingAssets, onImported],
  );

  const resolvePossibleDuplicate = useCallback(
    async (outcome: Extract<ImportOutcome, { status: 'possibleDuplicate' }>, action: 'importAsNew' | 'skip') => {
      if (action === 'skip') {
        setOutcomes((prev) => prev.filter((o) => o !== outcome));
        return;
      }
      const retried = await importFileGroup(outcome.group, existingAssets, { forceImportAsNew: true });
      setOutcomes((prev) => [retried, ...prev.filter((o) => o !== outcome)]);
      if (retried.status === 'imported') onImported();
    },
    [existingAssets, onImported],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      void runImport(files);
    },
    [runImport],
  );

  const { backdropRef, onKeyDown } = useModalDismiss(onClose);

  return (
    <div className="portfolio-modal-backdrop" ref={backdropRef} tabIndex={-1} onKeyDown={onKeyDown} role="dialog" aria-modal="true" aria-label="นำเข้าไฟล์">
      <div className="portfolio-modal portfolio-import-modal">
        <div className="portfolio-modal-header">
          <h2>นำเข้าไฟล์เข้าคลัง</h2>
          <button type="button" className="btn" onClick={onClose}>
            ปิด
          </button>
        </div>

        <div
          className={`portfolio-dropzone${dragOver ? ' portfolio-dropzone--active' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
          }}
        >
          <p>ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์</p>
          <p className="metadata-hint">
            รองรับ SVG, PNG, JPG, JSON, EPS, AI — ไฟล์ที่ชื่อเหมือนกัน (เช่น spring-garden-001.svg และ .png และ .json) จะถูกจัดกลุ่มเป็นชิ้นงานเดียวอัตโนมัติ
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              void runImport(files);
              e.target.value = '';
            }}
          />
        </div>

        {importing && <p className="portfolio-import-progress">กำลังนำเข้า…</p>}

        {outcomes.length > 0 && (
          <div className="portfolio-import-results">
            <p className="portfolio-import-summary">
              นำเข้าสำเร็จ {outcomes.filter((o) => o.status === 'imported').length} รายการ · ข้าม/บล็อก{' '}
              {outcomes.filter((o) => o.status === 'blockedDuplicate').length} รายการ · รอตัดสินใจ{' '}
              {outcomes.filter((o) => o.status === 'possibleDuplicate').length} รายการ · ผิดพลาด{' '}
              {outcomes.filter((o) => o.status === 'error').length} รายการ
            </p>
            <ul className="portfolio-import-outcome-list">
              {outcomes.map((outcome, i) => (
                <li key={`${outcome.basename}-${i}`} className={`portfolio-import-outcome portfolio-import-outcome--${outcome.status}`}>
                  <span className="portfolio-import-outcome-badge">{OUTCOME_LABEL_TH[outcome.status]}</span>
                  <span className="portfolio-import-outcome-name">{outcome.basename}</span>
                  {outcome.status === 'imported' && outcome.warnings.length > 0 && (
                    <ul className="portfolio-import-warnings">
                      {outcome.warnings.map((w, wi) => (
                        <li key={wi}>{w}</li>
                      ))}
                    </ul>
                  )}
                  {outcome.status === 'error' && <span className="portfolio-import-outcome-detail">{outcome.message}</span>}
                  {outcome.status === 'blockedDuplicate' && (
                    <span className="portfolio-import-outcome-detail">ตรงกับ {outcome.existingAsset.displayName} ({outcome.existingAsset.assetId}) ทุก byte</span>
                  )}
                  {outcome.status === 'possibleDuplicate' && (
                    <div className="portfolio-import-duplicate-actions">
                      <span className="portfolio-import-outcome-detail">
                        อาจซ้ำกับ {outcome.existingAsset.displayName} ({outcome.matchedOn.join(', ')})
                      </span>
                      <button type="button" className="btn btn--small" onClick={() => resolvePossibleDuplicate(outcome, 'importAsNew')}>
                        นำเข้าเป็นชิ้นใหม่
                      </button>
                      <button type="button" className="btn btn--small" onClick={() => resolvePossibleDuplicate(outcome, 'skip')}>
                        ข้าม
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {outcomes.length === 0 && !importing && <p className="metadata-hint">ยังไม่ได้เลือกไฟล์</p>}
      </div>
    </div>
  );
}
