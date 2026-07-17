import { useState } from 'react';
import type { CollectionIntegrityReport, BulkMembershipResult } from '../../catalog/services/collectionService';

interface Props {
  report: CollectionIntegrityReport | null;
  loading: boolean;
  onScan: () => Promise<void>;
  onRepairOrphans: () => Promise<BulkMembershipResult>;
  onRepairCovers: () => Promise<BulkMembershipResult>;
}

/** Portfolio Manager P2 Stage 2, Section 16 — Collection Integrity panel.
 * Same "scan is read-only, repair is a separate explicit action" shape as
 * P1's `PortfolioHealthCheckPanel.tsx`, extended with real repair buttons
 * (P1's Health Check is deliberately read-only-forever — see
 * `TECHNICAL_DEBT_REGISTER.md` P1-6 — but Stage 1's own integrity design,
 * ADR-005, always intended lazy *repairable* drift, not permanent manual
 * cleanup). Rendered inline as one of the Collections area's tabs
 * (Section 3: "All/Active/Archived/Integrity"), not a modal, since the
 * brief lists it as a first-class navigation destination rather than an
 * ancillary dialog. */
export function CollectionIntegrityPanel({ report, loading, onScan, onRepairOrphans, onRepairCovers }: Props) {
  const [repairingOrphans, setRepairingOrphans] = useState(false);
  const [repairingCovers, setRepairingCovers] = useState(false);
  const [lastRepairResult, setLastRepairResult] = useState<{ kind: 'orphans' | 'covers'; result: BulkMembershipResult } | null>(null);
  const [repairError, setRepairError] = useState<string | null>(null);

  const runRepairOrphans = async () => {
    setRepairingOrphans(true);
    setRepairError(null);
    try {
      const result = await onRepairOrphans();
      setLastRepairResult({ kind: 'orphans', result });
    } catch (e) {
      setRepairError(e instanceof Error ? e.message : 'ซ่อมแซมไม่สำเร็จ');
    } finally {
      setRepairingOrphans(false);
    }
  };

  const runRepairCovers = async () => {
    setRepairingCovers(true);
    setRepairError(null);
    try {
      const result = await onRepairCovers();
      setLastRepairResult({ kind: 'covers', result });
    } catch (e) {
      setRepairError(e instanceof Error ? e.message : 'ซ่อมแซมไม่สำเร็จ');
    } finally {
      setRepairingCovers(false);
    }
  };

  const hasOrphans = (report?.orphanedMemberships.length ?? 0) > 0;
  const hasStaleCovers = (report?.invalidCoverAssetReferences.length ?? 0) > 0;

  return (
    <div className="collection-integrity-panel">
      <div className="portfolio-grid-toolbar">
        <button type="button" className="btn btn--primary" onClick={() => void onScan()} disabled={loading}>
          {loading ? 'กำลังตรวจสอบ…' : 'ตรวจสอบใหม่'}
        </button>
      </div>

      {!report && !loading && <p className="metadata-hint">กด "ตรวจสอบใหม่" เพื่อเริ่มการตรวจสอบความถูกต้องของข้อมูลคอลเลกชัน</p>}

      {report && (
        <dl className="portfolio-health-grid">
          <dt>คอลเลกชันทั้งหมด</dt>
          <dd>{report.totalCollections}</dd>
          <dt>ชิ้นงานทั้งหมด</dt>
          <dd>{report.totalAssets}</dd>

          <dt>ชิ้นงานที่อ้างอิงคอลเลกชันที่ไม่มีอยู่จริง (orphaned)</dt>
          <dd>
            {report.orphanedMemberships.length}
            {hasOrphans && (
              <>
                <ul>
                  {report.orphanedMemberships.slice(0, 20).map((m) => (
                    <li key={m.assetId}>
                      {m.assetId} → {m.invalidCollectionIds.join(', ')}
                    </li>
                  ))}
                  {report.orphanedMemberships.length > 20 && <li>และอีก {report.orphanedMemberships.length - 20} รายการ…</li>}
                </ul>
                <button type="button" className="btn btn--small" onClick={() => void runRepairOrphans()} disabled={repairingOrphans}>
                  {repairingOrphans ? 'กำลังซ่อมแซม…' : 'ซ่อมแซมการอ้างอิงที่ไม่ถูกต้อง'}
                </button>
              </>
            )}
          </dd>

          <dt>ปกคอลเลกชันที่อ้างอิงชิ้นงานที่ถูกลบ (stale cover)</dt>
          <dd>
            {report.invalidCoverAssetReferences.length}
            {hasStaleCovers && (
              <>
                <ul>
                  {report.invalidCoverAssetReferences.slice(0, 20).map((r) => (
                    <li key={r.collectionId}>
                      {r.collectionId} → {r.coverAssetId}
                    </li>
                  ))}
                </ul>
                <button type="button" className="btn btn--small" onClick={() => void runRepairCovers()} disabled={repairingCovers}>
                  {repairingCovers ? 'กำลังซ่อมแซม…' : 'ล้างปกที่อ้างอิงไม่ถูกต้อง'}
                </button>
              </>
            )}
          </dd>

          <dt>ตรวจล่าสุดเมื่อ</dt>
          <dd>{new Date(report.generatedAt).toLocaleString('th-TH')}</dd>
        </dl>
      )}

      {repairError && (
        <p className="portfolio-error-text" role="alert">
          {repairError}
        </p>
      )}

      {lastRepairResult && (
        <p className="metadata-hint" role="status" aria-live="polite">
          {lastRepairResult.kind === 'orphans' ? 'ซ่อมแซมการอ้างอิงคอลเลกชันที่ไม่ถูกต้องแล้ว' : 'ล้างปกคอลเลกชันที่ไม่ถูกต้องแล้ว'} — สำเร็จ{' '}
          {lastRepairResult.result.changedCount} รายการ
        </p>
      )}

      {report && !hasOrphans && !hasStaleCovers && <p className="metadata-hint">ไม่พบปัญหาความถูกต้องของข้อมูล</p>}
    </div>
  );
}
