import type { HealthCheckReport } from '../../catalog/services/healthCheck';

interface Props {
  report: HealthCheckReport | null;
  loading: boolean;
  onRefresh: () => void;
  onClose: () => void;
}

/** Sprint P1, Section 11 (Data Integrity) — "Portfolio Health Check"
 * action. Read-only: reports issues, never auto-repairs them (per the
 * brief: "Do not silently repair destructive issues"). */
export function PortfolioHealthCheckPanel({ report, loading, onRefresh, onClose }: Props) {
  return (
    <div className="portfolio-modal-backdrop" role="dialog" aria-modal="true" aria-label="ตรวจสุขภาพคลัง">
      <div className="portfolio-modal">
        <div className="portfolio-modal-header">
          <h2>ตรวจสุขภาพคลัง</h2>
          <button type="button" className="btn" onClick={onClose}>
            ปิด
          </button>
        </div>

        <button type="button" className="btn btn--primary" onClick={onRefresh} disabled={loading}>
          {loading ? 'กำลังตรวจสอบ…' : 'ตรวจสอบใหม่'}
        </button>

        {report && (
          <dl className="portfolio-health-grid">
            <dt>จำนวนรายการทั้งหมด</dt>
            <dd>{report.recordCount}</dd>

            <dt>ไฟล์ต้นฉบับหาย (missing source references)</dt>
            <dd>
              {report.missingSourceReferences.length}
              {report.missingSourceReferences.length > 0 && (
                <ul>
                  {report.missingSourceReferences.map((m) => (
                    <li key={`${m.assetId}-${m.fileId}`}>
                      {m.assetId} — {m.role} ({m.fileId})
                    </li>
                  ))}
                </ul>
              )}
            </dd>

            <dt>ไม่มีภาพตัวอย่าง (missing previews)</dt>
            <dd>{report.missingPreviews.length}</dd>

            <dt>แฮชซ้ำ (duplicate hashes)</dt>
            <dd>
              {report.duplicateHashGroups.length}
              {report.duplicateHashGroups.length > 0 && (
                <ul>
                  {report.duplicateHashGroups.map((g) => (
                    <li key={g.sha256}>
                      {g.sha256.slice(0, 12)}… — {g.assetIds.join(', ')}
                    </li>
                  ))}
                </ul>
              )}
            </dd>

            <dt>ไฟล์กำพร้า (orphaned stored files)</dt>
            <dd>{report.orphanedFileIds.length}</dd>

            <dt>เมทาดาทาไม่ถูกต้อง (invalid metadata)</dt>
            <dd>{report.invalidMetadataAssetIds.length}</dd>

            <dt>สถานะ schema</dt>
            <dd>
              ตรงเวอร์ชันปัจจุบัน {report.migrationStatus.upToDate} รายการ · ต้องอัปเดต {report.migrationStatus.needsMigration} รายการ (v
              {report.migrationStatus.currentSchemaVersion})
            </dd>

            <dt>ตรวจล่าสุดเมื่อ</dt>
            <dd>{new Date(report.generatedAt).toLocaleString('th-TH')}</dd>
          </dl>
        )}
      </div>
    </div>
  );
}
