import { useState } from 'react';
import type { PortfolioAsset } from '../../catalog/domain/types';
import type { Collection } from '../../catalog/domain/collection';
import type { CommercialReadinessReport } from '../../commercial/domain/types';
import type { SeoScoreReport } from '../../catalog/seo/seoScoring';
import type { AssetExportStatus } from '../../commercial/exportWorkflow';
import { usePreviewUrl } from './usePreviewUrl';
import { useModalDismiss } from './useModalDismiss';

const WORKFLOW_LABEL_TH: Record<PortfolioAsset['workflowStatus'], string> = {
  DRAFT: 'ฉบับร่าง',
  READY_FOR_REVIEW: 'รอตรวจ',
  READY_TO_UPLOAD: 'พร้อมอัปโหลด',
  SUBMITTED: 'ส่งแล้ว',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ถูกปฏิเสธ',
  NEEDS_REVISION: 'ต้องแก้ไข',
};

function scoreBandClass(score: number): string {
  if (score >= 95) return 'commercial-score--ready';
  if (score >= 60) return 'commercial-score--needs-work';
  return 'commercial-score--blocked';
}

interface Props {
  asset: PortfolioAsset;
  readiness: CommercialReadinessReport | null;
  seoScore: SeoScoreReport | null;
  collections: Collection[];
  exportStatus: AssetExportStatus;
  onClose: () => void;
  onOpenEditDetails: () => void;
  onExport: () => void;
  onOpenSubmissionHistory: () => void;
}

/** Hotfix v1.0.1, Part 1 — Preview Dialog. Every score shown here is read
 * from an already-computed report the caller passes in (Commercial
 * Readiness from `readinessEngine.ts`, SEO Score from `seoScoring.ts`,
 * Export Status from `exportWorkflow.ts`) — this component computes
 * nothing itself, it only displays. */
export function AssetPreviewDialog({ asset, readiness, seoScore, collections, exportStatus, onClose, onOpenEditDetails, onExport, onOpenSubmissionHistory }: Props) {
  const svgRef = asset.sourceFileReferences.find((r) => r.role === 'svg') ?? null;
  const pngRef = asset.sourceFileReferences.find((r) => r.role === 'png') ?? null;
  const [previewRole, setPreviewRole] = useState<'svg' | 'png'>(svgRef ? 'svg' : 'png');
  const activeFileId = previewRole === 'svg' ? (svgRef?.fileId ?? asset.previewReference) : (pngRef?.fileId ?? asset.previewReference);
  const { url, broken } = usePreviewUrl(activeFileId);
  const assignedCollections = collections.filter((c) => asset.collectionIds.includes(c.id));
  const { backdropRef, onKeyDown } = useModalDismiss(onClose);

  return (
    <div className="portfolio-modal-backdrop" ref={backdropRef} tabIndex={-1} onKeyDown={onKeyDown} role="dialog" aria-modal="true" aria-label={`ตัวอย่าง ${asset.displayName}`}>
      <div className="portfolio-modal asset-preview-dialog">
        <div className="portfolio-detail-header">
          <h2>{asset.displayName}</h2>
          <button type="button" className="btn" onClick={onClose}>
            ปิด
          </button>
        </div>

        <div className="asset-preview-large">
          {url && !broken ? <img src={url} alt={asset.displayName} /> : <div className="portfolio-thumb-placeholder">{asset.assetType.toUpperCase()}</div>}
        </div>

        {svgRef && pngRef && (
          <div className="asset-preview-format-toggle" role="group" aria-label="สลับตัวอย่าง SVG/PNG">
            <button type="button" className={`btn btn--small${previewRole === 'svg' ? ' btn--primary' : ''}`} onClick={() => setPreviewRole('svg')}>
              ตัวอย่าง SVG
            </button>
            <button type="button" className={`btn btn--small${previewRole === 'png' ? ' btn--primary' : ''}`} onClick={() => setPreviewRole('png')}>
              ตัวอย่าง PNG
            </button>
          </div>
        )}

        <div className="portfolio-detail-id-row">
          <code>{asset.assetId}</code>
        </div>

        <section className="portfolio-detail-section asset-preview-scores">
          <div className="asset-preview-score-tile">
            <span className="asset-preview-score-label">Commercial Score</span>
            {readiness ? (
              <span className={`commercial-score-badge ${scoreBandClass(readiness.score)}`}>
                {readiness.score}% — {readiness.band}
              </span>
            ) : (
              <span className="metadata-hint">ยังไม่มีข้อมูล</span>
            )}
          </div>
          <div className="asset-preview-score-tile">
            <span className="asset-preview-score-label">SEO Score</span>
            {seoScore ? <span className="commercial-score-badge">{seoScore.overall}%</span> : <span className="metadata-hint">ยังไม่มีข้อมูล SEO (ยังไม่มี submission)</span>}
          </div>
          <div className="asset-preview-score-tile">
            <span className="asset-preview-score-label">สถานะ Export</span>
            <span className={`portfolio-badge portfolio-badge--${exportStatus.id}`}>{exportStatus.label}</span>
          </div>
        </section>

        {readiness && (
          <section className="portfolio-detail-section">
            <h3>Marketplace Readiness</h3>
            <ul className="commercial-check-list">
              {readiness.checks.map((check) => (
                <li key={check.id} className={`commercial-check commercial-check--${check.status.toLowerCase()}`}>
                  <strong>{check.label}:</strong> {check.status} — {check.detail}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="portfolio-detail-section">
          <h3>ข้อมูลชิ้นงาน</h3>
          <dl className="portfolio-metadata-grid">
            <dt>คอลเลกชัน</dt>
            <dd>{assignedCollections.length > 0 ? assignedCollections.map((c) => c.name).join(', ') : '—'}</dd>
            <dt>สถานะงาน</dt>
            <dd>{WORKFLOW_LABEL_TH[asset.workflowStatus]}</dd>
          </dl>
        </section>

        <section className="portfolio-detail-section portfolio-detail-actions">
          <button type="button" className="btn btn--primary" onClick={onExport}>
            📤 Export
          </button>
          <button type="button" className="btn" onClick={onOpenEditDetails}>
            ✏️ แก้ไขรายละเอียด
          </button>
          <button type="button" className="btn" onClick={onOpenSubmissionHistory}>
            🕓 ประวัติการส่งขาย
          </button>
        </section>
      </div>
    </div>
  );
}
