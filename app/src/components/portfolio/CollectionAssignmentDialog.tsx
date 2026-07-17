import { useState } from 'react';
import type { Collection } from '../../catalog/domain/collection';
import type { BulkMembershipResult } from '../../catalog/services/collectionService';

interface Props {
  mode: 'assign' | 'remove';
  assetIds: string[];
  collections: Collection[];
  /** For `assign` mode on a single asset: collection ids the asset is
   * already a member of, so those checkboxes show as checked/disabled
   * rather than letting the user "assign" a no-op (Section 12: "no
   * duplicate membership"). Omitted for bulk operations, where mixed
   * membership across many assets makes a single checked/unchecked state
   * meaningless — the service's `skippedCount` communicates the no-op
   * outcome after the fact instead. */
  currentMembership?: ReadonlySet<string>;
  onConfirm: (collectionIds: string[]) => Promise<BulkMembershipResult>;
  onClose: () => void;
}

const TITLE_TH: Record<Props['mode'], string> = {
  assign: 'เพิ่มเข้าคอลเลกชัน',
  remove: 'นำออกจากคอลเลกชัน',
};

/** Portfolio Manager P2 Stage 2, Sections 12-13 — single dialog reused for
 * both single-asset and bulk assign/remove (one component, one result-
 * rendering path, per the architecture lock's "reuse existing... state
 * patterns" and to avoid duplicating the `BulkMembershipResult` summary
 * UI). Target workflow (Section 13): select assets -> this dialog opens
 * with those `assetIds` already fixed -> pick collection(s) -> confirm —
 * exactly 2 actions after asset selection (pick + confirm), under the
 * "<=3 primary actions" budget. Archived collections are shown but
 * disabled in `assign` mode (Rule 7); `remove` mode never disables any
 * collection, since removal is always allowed regardless of archive
 * state. */
export function CollectionAssignmentDialog({ mode, assetIds, collections, currentMembership, onConfirm, onClose }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BulkMembershipResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (busy || checked.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const r = await onConfirm([...checked]);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ดำเนินการไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const eligibleCollections = mode === 'assign' ? collections.filter((c) => !c.isArchived || currentMembership?.has(c.id)) : collections;
  const archivedExcluded = mode === 'assign' ? collections.filter((c) => c.isArchived && !currentMembership?.has(c.id)) : [];

  return (
    <div
      className="portfolio-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`${TITLE_TH[mode]} (${assetIds.length} ชิ้นงาน)`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="portfolio-modal">
        <div className="portfolio-modal-header">
          <h2>
            {TITLE_TH[mode]} ({assetIds.length} ชิ้นงาน)
          </h2>
          <button type="button" className="btn" onClick={onClose}>
            ปิด
          </button>
        </div>

        {!result ? (
          <>
            {eligibleCollections.length === 0 ? (
              <p className="gallery-empty">
                {mode === 'assign' ? 'ยังไม่มีคอลเลกชันที่ใช้งานอยู่ — สร้างคอลเลกชันก่อน' : 'ไม่มีคอลเลกชันให้เลือก'}
              </p>
            ) : (
              <ul className="collection-picker-list">
                {eligibleCollections.map((c) => {
                  const isMember = currentMembership?.has(c.id) ?? false;
                  const disabled = mode === 'assign' && isMember && assetIds.length === 1;
                  return (
                    <li key={c.id}>
                      <label className="portfolio-filter-checkbox">
                        <input
                          type="checkbox"
                          checked={checked.has(c.id) || disabled}
                          disabled={disabled || busy}
                          onChange={() => toggle(c.id)}
                        />
                        {c.name}
                        {disabled && <span className="metadata-hint"> (เป็นสมาชิกอยู่แล้ว)</span>}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}

            {archivedExcluded.length > 0 && (
              <p className="metadata-hint">คอลเลกชันที่เก็บถาวรแล้ว {archivedExcluded.length} รายการไม่แสดง — ไม่สามารถเพิ่มสมาชิกใหม่ได้จนกว่าจะกู้คืน</p>
            )}

            {error && (
              <p className="portfolio-error-text" role="alert">
                {error}
              </p>
            )}

            <div className="portfolio-form-actions">
              <button type="button" className="btn btn--primary" onClick={handleConfirm} disabled={busy || checked.size === 0}>
                {busy ? 'กำลังดำเนินการ…' : 'ยืนยัน'}
              </button>
              <button type="button" className="btn" onClick={onClose} disabled={busy}>
                ยกเลิก
              </button>
            </div>
          </>
        ) : (
          <div className="portfolio-bulk-result" role="status" aria-live="polite">
            <p>
              รวม {result.requestedCount} รายการ — สำเร็จ {result.changedCount} · ข้าม (ไม่มีการเปลี่ยนแปลง) {result.skippedCount} · ล้มเหลว{' '}
              {result.failedCount}
            </p>
            {result.failures.length > 0 && (
              <ul className="portfolio-bulk-failures">
                {result.failures.slice(0, 20).map((f, i) => (
                  <li key={i}>
                    {f.assetId} → {f.collectionId}: {f.reason === 'collection is archived' ? 'คอลเลกชันถูกเก็บถาวรแล้ว' : f.reason === 'collection not found' ? 'ไม่พบคอลเลกชัน' : f.reason === 'asset not found' ? 'ไม่พบชิ้นงาน' : f.reason}
                  </li>
                ))}
                {result.failures.length > 20 && <li>และอีก {result.failures.length - 20} รายการ…</li>}
              </ul>
            )}
            <div className="portfolio-form-actions">
              <button type="button" className="btn btn--primary" onClick={onClose}>
                เสร็จสิ้น
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
