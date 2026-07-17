import type { WorkflowStatus, SourceFileRole } from '../../catalog/domain/types';
import { WORKFLOW_STATUSES, SOURCE_FILE_ROLES } from '../../catalog/domain/types';
import type { PortfolioFilterQuery } from '../../catalog/domain/search';
import type { DashboardSummary } from '../../catalog/services/dashboard';

const WORKFLOW_LABEL_TH: Record<WorkflowStatus, string> = {
  DRAFT: 'ฉบับร่าง',
  READY_FOR_REVIEW: 'รอตรวจ',
  READY_TO_UPLOAD: 'พร้อมอัปโหลด',
  SUBMITTED: 'ส่งแล้ว',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ถูกปฏิเสธ',
  NEEDS_REVISION: 'ต้องแก้ไข',
};

interface Props {
  summary: DashboardSummary | null;
  query: PortfolioFilterQuery;
  onChange: (query: PortfolioFilterQuery) => void;
  onOpenImport: () => void;
  onOpenHealthCheck: () => void;
}

/** Sprint P1, Section 7 (left panel) + Section 10 (Dashboard — P1 Minimum).
 * Every number shown comes from `computeDashboardSummary` (real stored
 * data) — no hard-coded sample numbers. */
export function PortfolioSidebar({ summary, query, onChange, onOpenImport, onOpenHealthCheck }: Props) {
  const toggleStatus = (status: WorkflowStatus) => {
    const current = query.workflowStatus ?? [];
    const next = current.includes(status) ? current.filter((s) => s !== status) : [...current, status];
    onChange({ ...query, workflowStatus: next.length > 0 ? next : undefined });
  };

  const toggleAssetType = (role: SourceFileRole) => {
    const current = query.assetType ?? [];
    const next = current.includes(role) ? current.filter((r) => r !== role) : [...current, role];
    onChange({ ...query, assetType: next.length > 0 ? next : undefined });
  };

  return (
    <aside className="portfolio-sidebar">
      <div className="portfolio-sidebar-actions">
        <button type="button" className="btn btn--primary" onClick={onOpenImport}>
          + นำเข้าไฟล์
        </button>
        <button type="button" className="btn" onClick={onOpenHealthCheck}>
          ตรวจสุขภาพคลัง
        </button>
      </div>

      {summary && (
        <div className="portfolio-summary">
          <h3>ภาพรวมคลัง</h3>
          <dl className="portfolio-summary-grid">
            <dt>ทั้งหมด</dt>
            <dd>{summary.totalAssets}</dd>
            <dt>ใช้งานอยู่</dt>
            <dd>{summary.activeAssets}</dd>
            <dt>เก็บถาวร</dt>
            <dd>{summary.archivedAssets}</dd>
            <dt>รอตรวจ</dt>
            <dd>{summary.readyForReview}</dd>
            <dt>พร้อมอัปโหลด</dt>
            <dd>{summary.readyToUpload}</dd>
            <dt>ส่งแล้ว</dt>
            <dd>{summary.submitted}</dd>
            <dt>อนุมัติแล้ว</dt>
            <dd>{summary.approved}</dd>
            <dt>ถูกปฏิเสธ</dt>
            <dd>{summary.rejected}</dd>
            <dt>ไม่มีภาพตัวอย่าง</dt>
            <dd>{summary.missingPreview}</dd>
            <dt>อาจซ้ำ</dt>
            <dd>{summary.duplicateWarnings}</dd>
          </dl>
        </div>
      )}

      <div className="portfolio-filter-group">
        <h3>สถานะงาน</h3>
        {WORKFLOW_STATUSES.map((s) => (
          <label key={s} className="portfolio-filter-checkbox">
            <input type="checkbox" checked={(query.workflowStatus ?? []).includes(s)} onChange={() => toggleStatus(s)} />
            {WORKFLOW_LABEL_TH[s]}
          </label>
        ))}
      </div>

      <div className="portfolio-filter-group">
        <h3>ประเภทไฟล์</h3>
        {SOURCE_FILE_ROLES.map((role) => (
          <label key={role} className="portfolio-filter-checkbox">
            <input type="checkbox" checked={(query.assetType ?? []).includes(role)} onChange={() => toggleAssetType(role)} />
            {role}
          </label>
        ))}
      </div>

      <div className="portfolio-filter-group">
        <h3>ที่เก็บถาวร</h3>
        <select value={query.archived ?? 'active'} onChange={(e) => onChange({ ...query, archived: e.target.value as PortfolioFilterQuery['archived'] })}>
          <option value="active">เฉพาะที่ใช้งานอยู่</option>
          <option value="archived">เฉพาะที่เก็บถาวร</option>
          <option value="all">ทั้งหมด</option>
        </select>
      </div>

      <div className="portfolio-filter-group">
        <h3>ตัวกรองอื่นๆ</h3>
        <label className="portfolio-filter-checkbox">
          <input type="checkbox" checked={!!query.missingPreview} onChange={(e) => onChange({ ...query, missingPreview: e.target.checked || undefined })} />
          ไม่มีภาพตัวอย่าง
        </label>
        <label className="portfolio-filter-checkbox">
          <input type="checkbox" checked={!!query.missingSvg} onChange={(e) => onChange({ ...query, missingSvg: e.target.checked || undefined })} />
          ไม่มีไฟล์ SVG
        </label>
        <label className="portfolio-filter-checkbox">
          <input type="checkbox" checked={!!query.missingJson} onChange={(e) => onChange({ ...query, missingJson: e.target.checked || undefined })} />
          ไม่มีไฟล์ JSON
        </label>
        <label className="portfolio-filter-checkbox">
          <input type="checkbox" checked={!!query.onlyDuplicates} onChange={(e) => onChange({ ...query, onlyDuplicates: e.target.checked || undefined })} />
          เฉพาะที่อาจซ้ำ
        </label>
      </div>
    </aside>
  );
}
