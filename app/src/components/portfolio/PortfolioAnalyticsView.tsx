import type { DashboardSummary } from '../../catalog/services/dashboard';
import { usePreviewUrl } from './usePreviewUrl';
import type { PortfolioAsset } from '../../catalog/domain/types';

interface RecentItemProps {
  asset: PortfolioAsset;
  onOpen: (assetId: string) => void;
}

function RecentItem({ asset, onOpen }: RecentItemProps) {
  const { url, broken } = usePreviewUrl(asset.previewReference);
  return (
    <button type="button" className="portfolio-analytics-recent-item" onClick={() => onOpen(asset.assetId)}>
      <div className="portfolio-analytics-recent-thumb">{url && !broken ? <img src={url} alt={asset.displayName} /> : <div className="portfolio-thumb-placeholder">{asset.assetType.toUpperCase()}</div>}</div>
      <span title={asset.displayName}>{asset.displayName}</span>
    </button>
  );
}

interface Props {
  summary: DashboardSummary | null;
  onOpenAsset: (assetId: string) => void;
}

/** AI-SBOS Mission, Part 9 — Portfolio Analytics. Every number here is the
 * exact same `DashboardSummary` (`catalog/services/dashboard.ts`'s
 * `computeDashboardSummary`) the Library sidebar already computes — this
 * view only gives Analytics its own clearly-labeled screen instead of
 * being buried in the Library's sidebar, per the mission's "Portfolio
 * becomes Library, History, Search, Collections, Analytics, Submission
 * History" — no new metric, no new computation. `recentlyImported` doubles
 * as a lightweight recent-activity view. */
export function PortfolioAnalyticsView({ summary, onOpenAsset }: Props) {
  if (!summary) {
    return <p className="portfolio-loading">กำลังโหลดข้อมูล…</p>;
  }

  return (
    <div className="portfolio-analytics">
      <h2>📊 Analytics — ภาพรวมคลังผลงาน</h2>
      <dl className="portfolio-analytics-grid">
        <div className="portfolio-analytics-tile">
          <dt>ทั้งหมด</dt>
          <dd>{summary.totalAssets}</dd>
        </div>
        <div className="portfolio-analytics-tile">
          <dt>ใช้งานอยู่</dt>
          <dd>{summary.activeAssets}</dd>
        </div>
        <div className="portfolio-analytics-tile">
          <dt>เก็บถาวร</dt>
          <dd>{summary.archivedAssets}</dd>
        </div>
        <div className="portfolio-analytics-tile">
          <dt>รอตรวจ</dt>
          <dd>{summary.readyForReview}</dd>
        </div>
        <div className="portfolio-analytics-tile">
          <dt>พร้อมอัปโหลด</dt>
          <dd>{summary.readyToUpload}</dd>
        </div>
        <div className="portfolio-analytics-tile">
          <dt>ส่งแล้ว</dt>
          <dd>{summary.submitted}</dd>
        </div>
        <div className="portfolio-analytics-tile">
          <dt>อนุมัติแล้ว</dt>
          <dd>{summary.approved}</dd>
        </div>
        <div className="portfolio-analytics-tile">
          <dt>ถูกปฏิเสธ</dt>
          <dd>{summary.rejected}</dd>
        </div>
        <div className="portfolio-analytics-tile">
          <dt>ไม่มีภาพตัวอย่าง</dt>
          <dd>{summary.missingPreview}</dd>
        </div>
        <div className="portfolio-analytics-tile">
          <dt>อาจซ้ำ</dt>
          <dd>{summary.duplicateWarnings}</dd>
        </div>
      </dl>

      <section className="portfolio-analytics-section">
        <h3>นำเข้า/สร้างล่าสุด</h3>
        {summary.recentlyImported.length === 0 ? (
          <p className="metadata-hint">ยังไม่มีชิ้นงาน</p>
        ) : (
          <div className="portfolio-analytics-recent-list">
            {summary.recentlyImported.map((asset) => (
              <RecentItem key={asset.assetId} asset={asset} onOpen={onOpenAsset} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
