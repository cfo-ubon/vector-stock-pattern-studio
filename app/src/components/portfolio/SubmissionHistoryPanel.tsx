import type { SubmissionRecord } from '../../catalog/submission/submissionRecord';
import { EXPORT_MARKETPLACE_OPTIONS } from '../../commercial/exportWorkflow';
import { useModalDismiss } from './useModalDismiss';

const STATUS_LABEL_TH: Record<string, string> = {
  DRAFT: 'ฉบับร่าง',
  READY: 'พร้อมส่ง',
  QUEUED: 'อยู่ในคิว',
  SUBMITTED: 'ส่งแล้ว',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ถูกปฏิเสธ',
  NEEDS_REVISION: 'ต้องแก้ไข',
  ARCHIVED: 'เก็บถาวร',
};

function marketplaceLabel(id: string): string {
  return EXPORT_MARKETPLACE_OPTIONS.find((m) => m.id === id)?.label ?? id;
}

interface Props {
  displayName: string;
  submissions: SubmissionRecord[];
  onClose: () => void;
}

/** Hotfix v1.0.1, Part 8 — Submission History. Read-only display over the
 * existing, unmodified `SubmissionRecord` store (`catalog/submission/`) —
 * no new tracking data, no "mark as submitted" action here (that stays in
 * the existing Stock Submission Center, per "No duplicated screens"). */
export function SubmissionHistoryPanel({ displayName, submissions, onClose }: Props) {
  const sorted = [...submissions].sort((a, b) => b.updatedAt - a.updatedAt);
  const { backdropRef, onKeyDown } = useModalDismiss(onClose);

  return (
    <div className="portfolio-modal-backdrop" ref={backdropRef} tabIndex={-1} onKeyDown={onKeyDown} role="dialog" aria-modal="true" aria-label={`ประวัติการส่งขาย — ${displayName}`}>
      <div className="portfolio-modal submission-history-dialog">
        <div className="portfolio-detail-header">
          <h2>ประวัติการส่งขาย — {displayName}</h2>
          <button type="button" className="btn" onClick={onClose}>
            ปิด
          </button>
        </div>

        {sorted.length === 0 ? (
          <p className="metadata-hint">ยังไม่มีประวัติการส่งขายชิ้นงานนี้</p>
        ) : (
          <table className="submission-history-table">
            <thead>
              <tr>
                <th>มาร์เก็ตเพลส</th>
                <th>วันที่</th>
                <th>เวอร์ชัน</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((submission) => (
                <tr key={submission.submissionId}>
                  <td>{marketplaceLabel(submission.marketplaceId)}</td>
                  <td>{new Date(submission.updatedAt).toLocaleString('th-TH')}</td>
                  <td>v{submission.version}</td>
                  <td>
                    <span className={`portfolio-badge portfolio-badge--${submission.status.toLowerCase()}`}>{STATUS_LABEL_TH[submission.status] ?? submission.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
