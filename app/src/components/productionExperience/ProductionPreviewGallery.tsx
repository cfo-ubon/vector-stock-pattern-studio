import type { PortfolioAsset, WorkflowStatus } from '../../catalog/domain/types';
import type { CommercialReadinessReport } from '../../commercial/domain/types';
import type { QualitySnapshot } from '../../catalog/quality/qualitySnapshotStore';
import { usePreviewUrl } from '../portfolio/usePreviewUrl';

const WORKFLOW_LABEL_TH: Record<WorkflowStatus, string> = {
  DRAFT: 'ฉบับร่าง',
  READY_FOR_REVIEW: 'รอตรวจ',
  READY_TO_UPLOAD: 'พร้อมอัปโหลด',
  SUBMITTED: 'ส่งแล้ว',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ถูกปฏิเสธ',
  NEEDS_REVISION: 'ต้องแก้ไข',
};

interface CardProps {
  asset: PortfolioAsset;
  readiness: CommercialReadinessReport | null;
  qualitySnapshot: QualitySnapshot | null;
  selected: boolean;
  onToggleSelect: () => void;
  onPreview: () => void;
  onEdit: () => void;
  onExport: () => void;
}

function GalleryCard({ asset, readiness, qualitySnapshot, selected, onToggleSelect, onPreview, onEdit, onExport }: CardProps) {
  const { url, broken } = usePreviewUrl(asset.previewReference);
  const marketplaceReady = readiness?.band === 'READY';
  const seoReady = readiness?.checks.find((c) => c.id === 'seoExists')?.status === 'PASS';

  return (
    <div className={`pe-gallery-card${selected ? ' pe-gallery-card--selected' : ''}`}>
      <label className="pe-gallery-select">
        <input type="checkbox" checked={selected} onChange={onToggleSelect} aria-label={`เลือก ${asset.displayName}`} />
      </label>
      <div className="pe-gallery-thumb">{url && !broken ? <img src={url} alt={asset.displayName} /> : <div className="portfolio-thumb-placeholder">{asset.assetType.toUpperCase()}</div>}</div>
      <div className="pe-gallery-meta">
        <strong title={asset.displayName}>{asset.displayName}</strong>
        <div className="pe-gallery-scores">
          <span className="pe-gallery-score-tile">
            Commercial <strong>{readiness ? `${readiness.score}%` : '—'}</strong>
          </span>
          <span className="pe-gallery-score-tile">
            Quality <strong>{qualitySnapshot ? Math.round(qualitySnapshot.beautyScore) : '—'}</strong>
          </span>
        </div>
        <div className="pe-gallery-badges">
          <span className={`pe-gallery-badge ${marketplaceReady ? 'pe-gallery-badge--good' : 'pe-gallery-badge--warn'}`}>{marketplaceReady ? '✅ Marketplace Ready' : '⚠ Not Ready'}</span>
          <span className={`pe-gallery-badge ${seoReady ? 'pe-gallery-badge--good' : 'pe-gallery-badge--warn'}`}>{seoReady ? '✅ SEO Ready' : '⚠ SEO Missing'}</span>
        </div>
        <span className="pe-gallery-status">{WORKFLOW_LABEL_TH[asset.workflowStatus]}</span>
      </div>
      <div className="pe-gallery-actions">
        <button type="button" className="btn btn--small" onClick={onPreview}>
          👁 Preview
        </button>
        <button type="button" className="btn btn--small" onClick={onEdit}>
          🎨 Edit
        </button>
        <button type="button" className="btn btn--small btn--primary" onClick={onExport}>
          📤 Export
        </button>
      </div>
    </div>
  );
}

interface Props {
  assets: PortfolioAsset[];
  readinessByAsset: Map<string, CommercialReadinessReport>;
  latestSnapshotByAsset: Map<string, QualitySnapshot>;
  selectedIds: Set<string>;
  onToggleSelect: (assetId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onPreview: (assetId: string) => void;
  onEdit: (assetId: string) => void;
  onExport: (assetId: string) => void;
  onBulkExport: () => void;
  busy: boolean;
}

/** AI-SBOS Mission, Part 5 — Preview Gallery. Immediately after generation
 * (or any time via the Gallery tab), shows every produced pattern with the
 * real Commercial Score/Quality Score/Marketplace Ready/SEO Ready/Status
 * the Commercial Pipeline (`readinessEngine.ts`) and Quality Classifier
 * (`qualitySnapshotStore.ts`) already compute — no new scoring here, only
 * display. Preview/Edit/Export per card, plus multi-select + bulk export,
 * so the owner never has to leave Today's Production for routine work. */
export function ProductionPreviewGallery({
  assets,
  readinessByAsset,
  latestSnapshotByAsset,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onPreview,
  onEdit,
  onExport,
  onBulkExport,
  busy,
}: Props) {
  if (assets.length === 0) {
    return <p className="pe-empty">ยังไม่มีชิ้นงานที่จะแสดง — กด "✨ Generate Now" ในแท็บ Progress ก่อน</p>;
  }

  return (
    <div className="pe-gallery">
      <div className="pe-gallery-toolbar">
        <span>{assets.length} ชิ้นงาน</span>
        <button type="button" className="btn btn--small" onClick={onSelectAll} disabled={busy}>
          เลือกทั้งหมด
        </button>
        <button type="button" className="btn btn--small" onClick={onClearSelection} disabled={busy}>
          ล้างการเลือก
        </button>
        {selectedIds.size > 0 && (
          <button type="button" className="btn btn--small btn--primary" onClick={onBulkExport} disabled={busy}>
            📤 Export ที่เลือก ({selectedIds.size})
          </button>
        )}
      </div>
      <div className="pe-gallery-grid">
        {assets.map((asset) => (
          <GalleryCard
            key={asset.assetId}
            asset={asset}
            readiness={readinessByAsset.get(asset.assetId) ?? null}
            qualitySnapshot={latestSnapshotByAsset.get(asset.assetId) ?? null}
            selected={selectedIds.has(asset.assetId)}
            onToggleSelect={() => onToggleSelect(asset.assetId)}
            onPreview={() => onPreview(asset.assetId)}
            onEdit={() => onEdit(asset.assetId)}
            onExport={() => onExport(asset.assetId)}
          />
        ))}
      </div>
    </div>
  );
}
