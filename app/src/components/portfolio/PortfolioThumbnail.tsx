import { useState } from 'react';
import type { PortfolioAsset } from '../../catalog/domain/types';
import type { AssetExportStatus } from '../../commercial/exportWorkflow';
import { usePreviewUrl } from './usePreviewUrl';

const WORKFLOW_LABEL_TH: Record<PortfolioAsset['workflowStatus'], string> = {
  DRAFT: 'ฉบับร่าง',
  READY_FOR_REVIEW: 'รอตรวจ',
  READY_TO_UPLOAD: 'พร้อมอัปโหลด',
  SUBMITTED: 'ส่งแล้ว',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ถูกปฏิเสธ',
  NEEDS_REVISION: 'ต้องแก้ไข',
};

interface Props {
  asset: PortfolioAsset;
  selected: boolean;
  isDuplicate: boolean;
  onSelect: (assetId: string) => void;
  /** Portfolio Manager P2 Stage 2, Section 11 — when set, renders an
   * accessible checkbox for multi-selection (bulk collection assignment)
   * alongside the existing single-select "open detail" click target. The
   * checkbox intercepts its own click/keyboard events (`stopPropagation`)
   * so toggling it never also opens the detail panel. */
  multiSelectable?: boolean;
  multiChecked?: boolean;
  onToggleMultiSelect?: (assetId: string) => void;
  /** Hotfix v1.0.1, Part 7 — Export Status badge, batch-derived by the
   * caller (`deriveAssetExportStatus` in `commercial/exportWorkflow.ts`).
   * Optional so existing callers/tests that don't pass it keep working. */
  exportStatus?: AssetExportStatus;
}

export function PortfolioThumbnail({ asset, selected, isDuplicate, onSelect, multiSelectable, multiChecked, onToggleMultiSelect, exportStatus }: Props) {
  const { url, broken } = usePreviewUrl(asset.previewReference);
  const [loadFailed, setLoadFailed] = useState(false);
  const fileTypes = [...new Set(asset.sourceFileReferences.map((r) => r.role))];
  const showPlaceholder = !url || broken || loadFailed;

  return (
    <button
      type="button"
      className={`portfolio-thumb${selected ? ' portfolio-thumb--selected' : ''}`}
      onClick={() => onSelect(asset.assetId)}
      aria-pressed={selected}
    >
      <div className="portfolio-thumb-preview">
        {multiSelectable && (
          <span
            className="portfolio-thumb-checkbox"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={!!multiChecked}
              onChange={() => onToggleMultiSelect?.(asset.assetId)}
              aria-label={`เลือก ${asset.displayName} สำหรับการดำเนินการหลายรายการ`}
            />
          </span>
        )}
        {!showPlaceholder && url ? (
          <img src={url} alt={asset.displayName} loading="lazy" onError={() => setLoadFailed(true)} />
        ) : (
          <div className="portfolio-thumb-placeholder">{asset.assetType.toUpperCase()}</div>
        )}
      </div>
      <div className="portfolio-thumb-meta">
        <div className="portfolio-thumb-name" title={asset.displayName}>
          {asset.displayName}
        </div>
        <div className="portfolio-thumb-id">{asset.assetId}</div>
        <div className="portfolio-thumb-badges">
          <span className={`portfolio-badge portfolio-badge--${asset.workflowStatus.toLowerCase()}`}>{WORKFLOW_LABEL_TH[asset.workflowStatus]}</span>
          {exportStatus && <span className={`portfolio-badge portfolio-badge--${exportStatus.id}`}>{exportStatus.label}</span>}
          {isDuplicate && <span className="portfolio-badge portfolio-badge--warning">⚠ ซ้ำ</span>}
          {asset.isArchived && <span className="portfolio-badge portfolio-badge--archived">เก็บถาวร</span>}
        </div>
        <div className="portfolio-thumb-filetypes">
          {fileTypes.map((t) => (
            <span key={t} className="portfolio-filetype-chip">
              {t}
            </span>
          ))}
        </div>
        <div className="portfolio-thumb-rating" aria-label={`คะแนน ${asset.rating}/5`}>
          {'★'.repeat(asset.rating)}
          {'☆'.repeat(5 - asset.rating)}
        </div>
        {(asset.styleDna || asset.presetId) && <div className="portfolio-thumb-style">{asset.styleDna ?? asset.presetId}</div>}
        <div className="portfolio-thumb-date">{new Date(asset.importedAt).toLocaleDateString('th-TH')}</div>
      </div>
    </button>
  );
}
