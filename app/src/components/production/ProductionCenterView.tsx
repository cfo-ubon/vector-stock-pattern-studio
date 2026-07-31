import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PortfolioAsset } from '../../catalog/domain/types';
import { loadSubmissions, whenSubmissionStoreHydrated } from '../../catalog/submission/submissionStore';
import { createSubmission, transitionSubmission } from '../../catalog/submission/submissionService';
import type { SubmissionRecord } from '../../catalog/submission/submissionRecord';
import { listMarketplaceProfiles } from '../../catalog/submission/marketplaceProfile';
import { SUBMISSION_STATUSES, canTransitionSubmissionStatus } from '../../catalog/submission/submissionStatus';
import type { SubmissionStatus } from '../../catalog/submission/submissionStatus';
import { parseCsv, previewImport, autoDetectColumnMapping, buildImportTemplateCsv } from '../../catalog/import/marketplaceResultImport';
import type { MappedImportRow } from '../../catalog/import/marketplaceResultImport';
import { loadSalesEvents, putSalesEvent } from '../../catalog/submission/salesRevenueStore';
import { createSalesEvent } from '../../catalog/submission/salesRevenue';
import { loadRejectionRecords, putRejectionRecord } from '../../catalog/submission/rejectionStore';
import { createRejectionRecord } from '../../catalog/submission/rejectionIntelligence';
import { generateCommercialFeedback } from '../../catalog/commercial/commercialFeedbackEngine';
import type { CommercialFeedbackReport } from '../../catalog/commercial/commercialFeedbackEngine';
import { generateProductionRecommendations } from '../../catalog/commercial/productionRecommendations';
import type { ProductionRecommendationReport } from '../../catalog/commercial/productionRecommendations';
import { importHistoricalPortfolio } from '../../catalog/import/historicalPortfolioImport';
import type { HistoricalFileEntry, HistoricalImportReport } from '../../catalog/import/historicalPortfolioImport';
import { loadImportHistory, putImportHistoryRecord, createImportHistoryRecord } from '../../catalog/import/importHistoryStore';
import type { ImportHistoryRecord } from '../../catalog/import/importHistoryStore';
import { buildProductionBackup, restoreProductionBackup, isProductionBackupArchiveShape } from '../../catalog/backup/productionBackup';
import type { ProductionBackupArchive } from '../../catalog/backup/productionBackup';
import { createProductionQueueItem, transitionProductionQueueItem, PRODUCTION_QUEUE_STATUSES, canTransitionProductionQueueStatus } from '../../catalog/queue/productionQueue';
import type { ProductionQueueItem, ProductionQueueStatus } from '../../catalog/queue/productionQueue';
import { loadProductionQueueItems, putProductionQueueItem } from '../../catalog/queue/productionQueueStore';
import { createProductionBatch, addQueueItemToBatch, PRODUCTION_BATCH_TYPES } from '../../catalog/queue/productionBatch';
import type { ProductionBatch, ProductionBatchType } from '../../catalog/queue/productionBatch';
import { loadProductionBatches, putProductionBatch } from '../../catalog/queue/productionBatchStore';
import './productionCenter.css';

// Build 026, Phase 17 — the first-ever UI for the Submission Center
// foundation (`catalog/submission/`, Build 015) and every Build 026
// engine layered on top of it (Commercial Feedback, Production
// Recommendations, Historical Importer, Production Backup). Every
// domain module this view calls already has its own unit tests and was
// verified independently — this component's own job is only wiring:
// loading data, rendering it, and forwarding user actions to the
// existing, unmodified service functions. It never duplicates
// validation/scoring/classification logic that already lives in
// `catalog/`.

type ProductionTab = 'submissions' | 'import-results' | 'commercial' | 'recommendations' | 'queue' | 'historical-import' | 'backup';

const QUEUE_STATUS_LABEL_TH: Record<ProductionQueueStatus, string> = {
  IDEA: 'ไอเดีย',
  GENERATED: 'สร้างแล้ว',
  QUALITY_REVIEW: 'ตรวจคุณภาพ',
  READY: 'พร้อมส่ง',
  PACKAGE_PREPARED: 'เตรียมแพ็กเกจแล้ว',
  SUBMITTED: 'ส่งแล้ว',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ถูกปฏิเสธ',
  PERFORMANCE_TRACKING: 'ติดตามยอดขาย',
};

const BATCH_TYPE_LABEL_TH: Record<ProductionBatchType, string> = {
  collection: 'คอลเลกชัน',
  'production-batch': 'ชุดผลิต',
  'submission-batch': 'ชุดส่งงาน',
  'seasonal-campaign': 'แคมเปญตามฤดูกาล',
  'marketplace-batch': 'ชุดตามตลาด',
  'experimental-batch': 'ชุดทดลอง',
};

interface Props {
  assets: PortfolioAsset[];
  onClose: () => void;
}

const STATUS_LABEL_TH: Record<SubmissionStatus, string> = {
  DRAFT: 'ฉบับร่าง',
  READY: 'พร้อมส่ง',
  QUEUED: 'อยู่ในคิว',
  SUBMITTED: 'ส่งแล้ว',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ถูกปฏิเสธ',
  NEEDS_REVISION: 'ต้องแก้ไข',
  ARCHIVED: 'เก็บถาวร',
};

export function ProductionCenterView({ assets, onClose }: Props) {
  const [tab, setTab] = useState<ProductionTab>('submissions');

  return (
    <div className="production-center">
      <div className="production-center-header">
        <h1>🏭 ศูนย์การผลิต (Production Center)</h1>
        <button type="button" className="btn" onClick={onClose}>
          ← กลับ Portfolio Manager
        </button>
      </div>
      <nav className="production-tab-nav" aria-label="แท็บศูนย์การผลิต">
        {(
          [
            ['submissions', 'ติดตามการส่ง'],
            ['import-results', 'นำเข้าผลลัพธ์'],
            ['commercial', 'ผลตอบรับเชิงพาณิชย์'],
            ['recommendations', 'คำแนะนำการผลิต'],
            ['queue', 'คิวการผลิต'],
            ['historical-import', 'นำเข้าผลงานเก่า'],
            ['backup', 'สำรอง/กู้คืน'],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" className={`btn${tab === key ? ' btn--primary' : ''}`} aria-pressed={tab === key} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === 'submissions' && <SubmissionTrackerTab assets={assets} />}
      {tab === 'import-results' && <MarketplaceResultsTab assets={assets} />}
      {tab === 'commercial' && <CommercialDashboardTab assets={assets} />}
      {tab === 'recommendations' && <RecommendationsTab assets={assets} />}
      {tab === 'queue' && <ProductionQueueTab assets={assets} />}
      {tab === 'historical-import' && <HistoricalImportTab />}
      {tab === 'backup' && <BackupTab />}
    </div>
  );
}

// --- Submission Tracker ---------------------------------------------

function SubmissionTrackerTab({ assets }: { assets: PortfolioAsset[] }) {
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [marketplaceId, setMarketplaceId] = useState(listMarketplaceProfiles()[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState('');
  const [category, setCategory] = useState('');

  const refresh = useCallback(() => setSubmissions(loadSubmissions()), []);

  useEffect(() => {
    void whenSubmissionStoreHydrated().then(refresh);
  }, [refresh]);

  const assetById = useMemo(() => new Map(assets.map((a) => [a.assetId, a])), [assets]);

  const handleCreate = useCallback(() => {
    if (!selectedAssetId || !marketplaceId) return;
    const asset = assetById.get(selectedAssetId);
    createSubmission({
      patternId: selectedAssetId,
      marketplaceId,
      titleSnapshot: title,
      descriptionSnapshot: description,
      keywordSnapshot: keywords.split(',').map((k) => k.trim()).filter(Boolean),
      category: category || null,
      productionAssetId: asset?.productionAssetId ?? null,
    });
    setTitle('');
    setDescription('');
    setKeywords('');
    setCategory('');
    refresh();
  }, [selectedAssetId, marketplaceId, title, description, keywords, category, assetById, refresh]);

  const handleTransition = useCallback(
    (submissionId: string, to: SubmissionStatus) => {
      transitionSubmission(submissionId, to);
      refresh();
    },
    [refresh],
  );

  return (
    <div className="production-panel">
      <section className="production-card">
        <h2>สร้างการส่งใหม่</h2>
        <div className="production-form-grid">
          <label>
            ชิ้นงาน
            <select value={selectedAssetId} onChange={(e) => setSelectedAssetId(e.target.value)}>
              <option value="">— เลือกชิ้นงาน —</option>
              {assets.map((a) => (
                <option key={a.assetId} value={a.assetId}>
                  {a.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            ตลาด
            <select value={marketplaceId} onChange={(e) => setMarketplaceId(e.target.value)}>
              {listMarketplaceProfiles().map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            ชื่อเรื่อง
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            คำอธิบาย
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label>
            คำค้น (คั่นด้วยจุลภาค)
            <input value={keywords} onChange={(e) => setKeywords(e.target.value)} />
          </label>
          <label>
            หมวดหมู่
            <input value={category} onChange={(e) => setCategory(e.target.value)} />
          </label>
        </div>
        <button type="button" className="btn btn--primary" disabled={!selectedAssetId || !marketplaceId} onClick={handleCreate}>
          + สร้างการส่ง
        </button>
      </section>

      <section className="production-card">
        <h2>รายการการส่งทั้งหมด ({submissions.length})</h2>
        {submissions.length === 0 ? (
          <p>ยังไม่มีการส่ง</p>
        ) : (
          <table className="production-table">
            <thead>
              <tr>
                <th>ชิ้นงาน</th>
                <th>ตลาด</th>
                <th>สถานะ</th>
                <th>การกระทำ</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.submissionId}>
                  <td>{assetById.get(s.patternId)?.displayName ?? s.patternId}</td>
                  <td>{s.marketplaceId}</td>
                  <td>{STATUS_LABEL_TH[s.status]}</td>
                  <td>
                    {SUBMISSION_STATUSES.filter((to) => canTransitionSubmissionStatus(s.status, to)).map((to) => (
                      <button key={to} type="button" className="btn btn--small" onClick={() => handleTransition(s.submissionId, to)}>
                        → {STATUS_LABEL_TH[to]}
                      </button>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

// --- Marketplace Results Import --------------------------------------

function MarketplaceResultsTab({ assets }: { assets: PortfolioAsset[] }) {
  const [preview, setPreview] = useState<{ rows: MappedImportRow[]; errors: { rowIndex: number; message: string }[] } | null>(null);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    const text = await file.text();
    const allRows = parseCsv(text);
    if (allRows.length === 0) return;
    const mapping = autoDetectColumnMapping(allRows[0]);
    const result = previewImport(allRows.slice(1), mapping);
    setPreview(result);
    setApplyMessage(null);
  }, []);

  const handleApply = useCallback(async () => {
    if (!preview) return;
    await whenSubmissionStoreHydrated();
    const assetByProductionId = new Map(assets.filter((a) => a.productionAssetId).map((a) => [a.productionAssetId as string, a]));
    let matched = 0;
    let unmatched = 0;
    for (const row of preview.rows) {
      const asset = assetByProductionId.get(row.productionAssetId);
      if (!asset) {
        unmatched++;
        continue;
      }
      const existing = loadSubmissions().find((s) => s.patternId === asset.assetId && s.marketplaceId === row.marketplace);
      if (!existing) {
        unmatched++;
        continue;
      }
      matched++;
      if (row.status && canTransitionSubmissionStatus(existing.status, row.status as SubmissionStatus)) {
        transitionSubmission(existing.submissionId, row.status as SubmissionStatus);
      }
      if (row.rejectionReason) {
        await putRejectionRecord(createRejectionRecord({ submissionId: existing.submissionId, marketplaceReasonText: row.rejectionReason }));
      }
      if (row.downloads || row.revenue) {
        await putSalesEvent(
          createSalesEvent({
            productionAssetId: row.productionAssetId,
            marketplaceId: row.marketplace,
            date: row.submittedDate ?? Date.now(),
            downloads: row.downloads ?? 0,
            grossRevenue: row.revenue ?? 0,
            currency: row.currency ?? 'USD',
          }),
        );
      }
    }
    setApplyMessage(`นำเข้าสำเร็จ: ${matched} รายการที่ตรงกัน, ${unmatched} รายการที่ไม่พบการส่งที่ตรงกัน`);
  }, [preview, assets]);

  return (
    <div className="production-panel">
      <section className="production-card">
        <h2>นำเข้าผลลัพธ์จากตลาด (CSV)</h2>
        <p>
          ดาวน์โหลด{' '}
          <button
            type="button"
            className="btn btn--small"
            onClick={() => {
              const blob = new Blob([buildImportTemplateCsv()], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'marketplace-results-template.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            แม่แบบ CSV
          </button>
        </p>
        <input type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && void handleFile(e.target.files[0])} />
        {preview && (
          <div>
            <p>
              แถวที่อ่านได้: {preview.rows.length}, แถวที่มีปัญหา: {preview.errors.length}
            </p>
            {preview.errors.map((err) => (
              <p key={err.rowIndex} className="production-error-text">
                แถว {err.rowIndex + 1}: {err.message}
              </p>
            ))}
            <button type="button" className="btn btn--primary" onClick={() => void handleApply()}>
              นำผลลัพธ์ไปใช้กับการส่งที่มีอยู่
            </button>
            {applyMessage && <p>{applyMessage}</p>}
          </div>
        )}
      </section>
    </div>
  );
}

// --- Commercial Dashboard ---------------------------------------------

function CommercialDashboardTab({ assets }: { assets: PortfolioAsset[] }) {
  const [report, setReport] = useState<CommercialFeedbackReport | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    try {
      await whenSubmissionStoreHydrated();
      const submissions = loadSubmissions();
      const [salesEvents, rejectionRecords] = await Promise.all([loadSalesEvents(), loadRejectionRecords()]);
      setReport(generateCommercialFeedback({ assets, submissions, salesEvents, rejectionRecords }));
    } finally {
      setLoading(false);
    }
  }, [assets]);

  return (
    <div className="production-panel">
      <section className="production-card">
        <h2>เครื่องมือผลตอบรับเชิงพาณิชย์</h2>
        <p>วิเคราะห์ผลลัพธ์จริงจากการส่ง (อนุมัติ/ปฏิเสธ/ยอดขาย) แยกตาม preset/Style DNA/composition — ไม่แตะต้อง Beauty/Commercial Score เดิม</p>
        <button type="button" className="btn btn--primary" disabled={loading} onClick={() => void handleGenerate()}>
          {loading ? 'กำลังวิเคราะห์…' : 'วิเคราะห์ตอนนี้'}
        </button>
        {report && (
          <div>
            <p>
              อัตราการอนุมัติรวม: {report.portfolioApprovalRate !== null ? `${Math.round(report.portfolioApprovalRate * 100)}%` : 'ไม่มีข้อมูล'} (
              {report.portfolioDecidedCount} รายการที่ตัดสินแล้ว)
            </p>
            <table className="production-table">
              <thead>
                <tr>
                  <th>มิติ</th>
                  <th>ค่า</th>
                  <th>อัตราอนุมัติ</th>
                  <th>ความเชื่อมั่น</th>
                  <th>คำอธิบาย</th>
                </tr>
              </thead>
              <tbody>
                {report.dimensions.map((d) => (
                  <tr key={`${d.dimension}-${d.value}`}>
                    <td>{d.dimension}</td>
                    <td>{d.value}</td>
                    <td>{d.approvalRate !== null ? `${Math.round(d.approvalRate * 100)}%` : '—'}</td>
                    <td>{d.confidence}</td>
                    <td>{d.explanation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// --- Recommendations ----------------------------------------------------

function RecommendationsTab({ assets }: { assets: PortfolioAsset[] }) {
  const [report, setReport] = useState<ProductionRecommendationReport | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    try {
      await whenSubmissionStoreHydrated();
      const submissions = loadSubmissions();
      const [salesEvents, rejectionRecords] = await Promise.all([loadSalesEvents(), loadRejectionRecords()]);
      const feedback = generateCommercialFeedback({ assets, submissions, salesEvents, rejectionRecords });
      const availablePresetIds = [...new Set(assets.map((a) => a.presetId).filter((v): v is string => !!v))];
      setReport(generateProductionRecommendations({ assets, availablePresetIds, commercialFeedback: feedback }));
    } finally {
      setLoading(false);
    }
  }, [assets]);

  return (
    <div className="production-panel">
      <section className="production-card">
        <h2>ควรผลิตอะไรต่อไป</h2>
        <p>อ้างอิงจาก preset ที่มีอยู่ในคลังของคุณเท่านั้น (ยังไม่รวม preset ที่ไม่เคยสร้างมาก่อน)</p>
        <button type="button" className="btn btn--primary" disabled={loading} onClick={() => void handleGenerate()}>
          {loading ? 'กำลังคำนวณ…' : 'สร้างคำแนะนำ'}
        </button>
        {report && (
          <div>
            {report.excludedDueToDuplicateRisk.length > 0 && (
              <p>ไม่แนะนำ (มีชิ้นงานมากเกินไปแล้ว): {report.excludedDueToDuplicateRisk.join(', ')}</p>
            )}
            <ol>
              {report.recommendations.map((r) => (
                <li key={r.presetId}>
                  <strong>{r.presetId}</strong> (คะแนน {r.score}) — {r.reason}
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}

// --- Production Queue & Batches --------------------------------------------

function ProductionQueueTab({ assets }: { assets: PortfolioAsset[] }) {
  const [items, setItems] = useState<ProductionQueueItem[]>([]);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [ideaNote, setIdeaNote] = useState('');
  const [batchName, setBatchName] = useState('');
  const [batchType, setBatchType] = useState<ProductionBatchType>('production-batch');

  const refresh = useCallback(async () => {
    const [loadedItems, loadedBatches] = await Promise.all([loadProductionQueueItems(), loadProductionBatches()]);
    setItems(loadedItems);
    setBatches(loadedBatches);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const assetById = useMemo(() => new Map(assets.map((a) => [a.assetId, a])), [assets]);
  const batchById = useMemo(() => new Map(batches.map((b) => [b.batchId, b])), [batches]);

  const handleCreateIdea = useCallback(async () => {
    if (!ideaNote.trim()) return;
    await putProductionQueueItem(createProductionQueueItem({ ideaNote }));
    setIdeaNote('');
    await refresh();
  }, [ideaNote, refresh]);

  const handleTransition = useCallback(
    async (item: ProductionQueueItem, to: ProductionQueueStatus) => {
      await putProductionQueueItem(transitionProductionQueueItem(item, to));
      await refresh();
    },
    [refresh],
  );

  const handleCreateBatch = useCallback(async () => {
    if (!batchName.trim()) return;
    await putProductionBatch(createProductionBatch({ name: batchName, batchType }));
    setBatchName('');
    await refresh();
  }, [batchName, batchType, refresh]);

  const handleAssignToBatch = useCallback(
    async (item: ProductionQueueItem, batchId: string) => {
      if (!batchId) return;
      const batch = batchById.get(batchId);
      if (!batch) return;
      await putProductionBatch(addQueueItemToBatch(batch, item.queueItemId));
      await putProductionQueueItem({ ...item, batchId, updatedAt: Date.now() });
      await refresh();
    },
    [batchById, refresh],
  );

  return (
    <div className="production-panel">
      <section className="production-card">
        <h2>คิวการผลิต (9 ขั้นตอน)</h2>
        <p>ติดตามไอเดียตั้งแต่ก่อนสร้างจนถึงติดตามยอดขาย: ไอเดีย → สร้างแล้ว → ตรวจคุณภาพ → พร้อมส่ง → เตรียมแพ็กเกจแล้ว → ส่งแล้ว → อนุมัติแล้ว/ถูกปฏิเสธ → ติดตามยอดขาย</p>
        <div className="production-form-grid">
          <label>
            ไอเดียใหม่
            <input value={ideaNote} onChange={(e) => setIdeaNote(e.target.value)} placeholder="เช่น ลายดอกไม้หรูสำหรับกระดาษห่อของขวัญ" />
          </label>
        </div>
        <button type="button" className="btn btn--primary" disabled={!ideaNote.trim()} onClick={() => void handleCreateIdea()}>
          + เพิ่มไอเดียเข้าคิว
        </button>
      </section>

      <section className="production-card">
        <h2>รายการในคิว ({items.length})</h2>
        {items.length === 0 ? (
          <p>ยังไม่มีรายการในคิว</p>
        ) : (
          <table className="production-table">
            <thead>
              <tr>
                <th>ไอเดีย/ชิ้นงาน</th>
                <th>สถานะ</th>
                <th>ชุดงาน</th>
                <th>การกระทำ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.queueItemId}>
                  <td>{item.assetId ? assetById.get(item.assetId)?.displayName ?? item.assetId : item.ideaNote}</td>
                  <td>{QUEUE_STATUS_LABEL_TH[item.status]}</td>
                  <td>
                    <select value={item.batchId ?? ''} onChange={(e) => void handleAssignToBatch(item, e.target.value)}>
                      <option value="">— ไม่มีชุดงาน —</option>
                      {batches.map((b) => (
                        <option key={b.batchId} value={b.batchId}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {PRODUCTION_QUEUE_STATUSES.filter((to) => canTransitionProductionQueueStatus(item.status, to)).map((to) => (
                      <button key={to} type="button" className="btn btn--small" onClick={() => void handleTransition(item, to)}>
                        → {QUEUE_STATUS_LABEL_TH[to]}
                      </button>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="production-card">
        <h2>ชุดงาน / แคมเปญ ({batches.length})</h2>
        <div className="production-form-grid">
          <label>
            ชื่อชุดงาน
            <input value={batchName} onChange={(e) => setBatchName(e.target.value)} />
          </label>
          <label>
            ประเภท
            <select value={batchType} onChange={(e) => setBatchType(e.target.value as ProductionBatchType)}>
              {PRODUCTION_BATCH_TYPES.map((t) => (
                <option key={t} value={t}>
                  {BATCH_TYPE_LABEL_TH[t]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="button" className="btn btn--primary" disabled={!batchName.trim()} onClick={() => void handleCreateBatch()}>
          + สร้างชุดงาน
        </button>
        {batches.length > 0 && (
          <ul>
            {batches.map((b) => (
              <li key={b.batchId}>
                {b.name} ({BATCH_TYPE_LABEL_TH[b.batchType]}) — {b.queueItemIds.length} รายการ
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// --- Historical Import ---------------------------------------------------

function HistoricalImportTab() {
  const [report, setReport] = useState<HistoricalImportReport | null>(null);
  const [history, setHistory] = useState<ImportHistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshHistory = useCallback(async () => setHistory(await loadImportHistory()), []);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  const handleFiles = useCallback(
    async (fileList: FileList) => {
      setLoading(true);
      try {
        const entries: HistoricalFileEntry[] = Array.from(fileList).map((file) => ({
          file,
          relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
        }));
        const { loadPortfolioAssets } = await import('../../catalog/storage/portfolioStore');
        const existingAssets = await loadPortfolioAssets();
        const { report: newReport } = await importHistoricalPortfolio(entries, existingAssets);
        setReport(newReport);
        await putImportHistoryRecord(createImportHistoryRecord(newReport));
        await refreshHistory();
      } finally {
        setLoading(false);
      }
    },
    [refreshHistory],
  );

  return (
    <div className="production-panel">
      <section className="production-card">
        <h2>นำเข้าผลงานเก่า</h2>
        <p>เลือกโฟลเดอร์ portfolio_phase_1/, portfolio_phase_1b_review/ หรือ reports/build_02x/ — ไฟล์ต้นฉบับจะไม่ถูกแก้ไขหรือลบ</p>
        <p className="production-hint">
          บน iPad (Safari) ไม่รองรับการเลือกทั้งโฟลเดอร์ — กรุณาเลือกไฟล์ทั้งหมดในโฟลเดอร์พร้อมกันแทน (แตะเลือกหลายไฟล์ได้ในหน้าต่างเลือกไฟล์)
        </p>
        <input
          type="file"
          multiple
          // @ts-expect-error -- webkitdirectory is a real, widely-supported attribute not yet in the DOM typings this repo targets.
          webkitdirectory=""
          disabled={loading}
          onChange={(e) => e.target.files && void handleFiles(e.target.files)}
        />
        {loading && <p>กำลังนำเข้า…</p>}
        {report && (
          <div>
            <p>นำเข้าสำเร็จ: {report.assetsImported}, ข้ามเพราะซ้ำ: {report.assetsSkippedAsDuplicate}, ผิดพลาด: {report.assetsErrored}</p>
            <p>รายงานที่พบ: {report.manifestEntriesFound} แถว, build ที่พบ: {report.buildLabelsSeen.join(', ') || '—'}</p>
            {report.missingReferences.length > 0 && (
              <p>อ้างอิงที่หาไฟล์ไม่พบ: {report.missingReferences.map((m) => m.key).join(', ')}</p>
            )}
            {report.malformedManifestFiles.length > 0 && <p>ไฟล์รายงานที่อ่านไม่ได้: {report.malformedManifestFiles.join(', ')}</p>}
          </div>
        )}
      </section>
      <section className="production-card">
        <h2>ประวัติการนำเข้า ({history.length})</h2>
        <ul>
          {history.map((h) => (
            <li key={h.importId}>
              {new Date(h.importedAt).toLocaleString('th-TH')} — นำเข้า {h.report.assetsImported} ชิ้น จาก {h.report.buildLabelsSeen.join(', ') || 'ไม่ทราบแหล่งที่มา'}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// --- Backup ---------------------------------------------------------------

function BackupTab() {
  const [status, setStatus] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    const archive = await buildProductionBackup();
    const blob = new Blob([JSON.stringify(archive)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `production-backup-${new Date(archive.createdAt).toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus(`สร้างไฟล์สำรองสำเร็จ: ${archive.stats.submissionCount} การส่ง, ${archive.stats.qualitySnapshotCount} การประเมินคุณภาพ, ${archive.stats.batchCount} ชุดงาน`);
  }, []);

  const handleImport = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!isProductionBackupArchiveShape(parsed)) {
        setStatus('ไฟล์นี้ไม่ใช่ไฟล์สำรองของศูนย์การผลิตที่ถูกต้อง');
        return;
      }
      const result = await restoreProductionBackup(parsed as ProductionBackupArchive);
      setStatus(
        `กู้คืนสำเร็จ: การส่ง ${result.submissionsRestored}, ยอดขาย ${result.salesEventsRestored}, การปฏิเสธ ${result.rejectionRecordsRestored}, การประเมินคุณภาพ ${result.qualitySnapshotsRestored}, คิวงาน ${result.queueItemsRestored}, ชุดงาน ${result.batchesRestored}, ประวัตินำเข้า ${result.importHistoryRestored}, บัญชีตลาด ${result.marketplaceRegistrationsRestored}`,
      );
    } catch (e) {
      setStatus(e instanceof Error ? `กู้คืนไม่สำเร็จ: ${e.message}` : 'กู้คืนไม่สำเร็จ');
    }
  }, []);

  return (
    <div className="production-panel">
      <section className="production-card">
        <h2>สำรองข้อมูลศูนย์การผลิต</h2>
        <p>ครอบคลุมการส่ง, ยอดขาย, การปฏิเสธ, การประเมินคุณภาพ, คิวงาน, ชุดงาน, ประวัตินำเข้า และบัญชีตลาด (แยกจากการสำรอง Collection เดิม)</p>
        <button type="button" className="btn btn--primary" onClick={() => void handleExport()}>
          ดาวน์โหลดไฟล์สำรอง
        </button>
      </section>
      <section className="production-card">
        <h2>กู้คืนจากไฟล์สำรอง</h2>
        <input type="file" accept=".json" onChange={(e) => e.target.files?.[0] && void handleImport(e.target.files[0])} />
        {status && <p>{status}</p>}
      </section>
    </div>
  );
}
