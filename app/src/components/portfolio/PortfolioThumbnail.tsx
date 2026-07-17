import { useState } from 'react';
import type { PortfolioAsset } from '../../catalog/domain/types';
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
}

export function PortfolioThumbnail({ asset, selected, isDuplicate, onSelect }: Props) {
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
