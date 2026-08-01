import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PortfolioAsset } from '../../catalog/domain/types';
import { loadFilesForAsset } from '../../catalog/storage/portfolioStore';
import { loadSubmissions, whenSubmissionStoreHydrated } from '../../catalog/submission/submissionStore';
import { MARKETPLACE_LIST, type MarketplaceId } from '../../metadata/marketplaceProfiles';
import { downloadBlobFile } from '../../export/svgExporter';
import { loadCommercialPipelineContext, type CommercialPipelineContext } from '../../commercial/loadCommercialPipelineContext';
import { buildExportReadinessDashboard } from '../../commercial/exportReadinessDashboard';
import { generateCommercialRecommendations } from '../../commercial/commercialRecommendation';
import { computeBusinessMetrics, MANUAL_MINUTES_PER_PACKAGE_BASELINE } from '../../commercial/businessMetrics';
import { loadCommercialPackageHistory, recordCommercialPackageBuilt } from '../../commercial/storage/commercialPackageHistoryStore';
import { loadSafetyThresholdConfig, saveSafetyThresholdConfig, canExportPackage } from '../../commercial/safetyThreshold';
import { buildCommercialPackage } from '../../commercial/packageBuilder';
import type { ExportReadinessDashboard, CommercialRecommendation, BusinessMetricsSnapshot, SafetyThresholdConfig, CommercialReadinessReport } from '../../commercial/domain/types';
import './commercialPipeline.css';

// Build 031A — the Commercial Production Pipeline's own tab inside the
// existing Production Center (`components/production/ProductionCenterView.tsx`)
// rather than a new top-level screen, per this build's own audit finding
// that the Production Center already IS a commercial-pipeline shell
// (queue/recommendations/commercial-feedback/backup tabs). Every number
// shown here comes from `loadCommercialPipelineContext` (Phase 1/4's real
// engines) or the real, persisted package-build history (Phase 8) — never
// fabricated. The "Build Commercial Package" flow below is deliberately
// collapsed into as few clicks as the spec's "<=5 clicks" success
// criterion allows: selecting an asset + marketplace, then one "Build
// Commercial Package" action that internally reviews readiness, validates
// against the safety threshold, and produces the downloadable package —
// Phase 3's Review -> Build -> Validate -> Export Ready flow, without
// making the owner click through four separate screens for it.

interface Props {
  assets: PortfolioAsset[];
}

function scoreColor(score: number): string {
  if (score >= 95) return 'commercial-score--ready';
  if (score >= 60) return 'commercial-score--needs-work';
  return 'commercial-score--blocked';
}

export function CommercialPipelineTab({ assets: _assets }: Props) {
  const [context, setContext] = useState<CommercialPipelineContext | null>(null);
  const [dashboard, setDashboard] = useState<ExportReadinessDashboard | null>(null);
  const [recommendations, setRecommendations] = useState<CommercialRecommendation[]>([]);
  const [metrics, setMetrics] = useState<BusinessMetricsSnapshot | null>(null);
  const [threshold, setThreshold] = useState<SafetyThresholdConfig>(() => loadSafetyThresholdConfig());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [selectedMarketplace, setSelectedMarketplace] = useState<MarketplaceId>(MARKETPLACE_LIST[0]?.id ?? 'etsy');
  const [buildStatus, setBuildStatus] = useState<'idle' | 'building' | 'blocked' | 'done'>('idle');
  const [buildMessage, setBuildMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ctx = await loadCommercialPipelineContext();
      const currentThreshold = loadSafetyThresholdConfig();
      const history = await loadCommercialPackageHistory();
      setContext(ctx);
      setThreshold(currentThreshold);
      setDashboard(buildExportReadinessDashboard(ctx.readinessReports, currentThreshold.minReadinessScore));
      setRecommendations(generateCommercialRecommendations({ reports: ctx.readinessReports, assetsById: ctx.assetsById, collectionCompleteness: ctx.collectionCompleteness }));
      setMetrics(computeBusinessMetrics(history, ctx.readinessReports));
      if (!selectedAssetId && ctx.assets.length > 0) setSelectedAssetId(ctx.assets[0].assetId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selectedReport: CommercialReadinessReport | null = useMemo(() => {
    if (!context || !selectedAssetId) return null;
    return context.readinessReports.find((r) => r.assetId === selectedAssetId) ?? null;
  }, [context, selectedAssetId]);

  const handleBuildPackage = useCallback(
    async (overrideThreshold: boolean) => {
      if (!context || !selectedReport) return;
      const asset = context.assetsById.get(selectedAssetId);
      if (!asset) return;

      const permission = canExportPackage(selectedReport, threshold, overrideThreshold);
      if (!permission.allowed) {
        setBuildStatus('blocked');
        setBuildMessage(permission.reason);
        return;
      }

      setBuildStatus('building');
      setBuildMessage(overrideThreshold ? permission.reason : null);
      try {
        await whenSubmissionStoreHydrated();
        const [files, submissions] = await Promise.all([loadFilesForAsset(asset.assetId), Promise.resolve(loadSubmissions())]);
        const submissionForAsset = submissions.filter((s) => s.patternId === asset.assetId && s.marketplaceId === selectedMarketplace)[0] ?? null;
        const collections = context.collections.filter((c) => asset.collectionIds.includes(c.id));

        const result = await buildCommercialPackage({
          asset,
          files,
          marketplaceId: selectedMarketplace,
          readiness: selectedReport,
          submission: submissionForAsset,
          collections,
        });

        downloadBlobFile(result.filename, result.blob);
        await recordCommercialPackageBuilt({ assetId: asset.assetId, marketplaceId: selectedMarketplace, status: result.manifest.status, readinessScore: selectedReport.score });

        setBuildStatus('done');
        setBuildMessage(
          result.manifest.status === 'NEEDS_VERIFICATION'
            ? `ดาวน์โหลดแพ็กเกจแล้ว — ต้องตรวจสอบ: ${result.manifest.verificationNotes.join(' ')}`
            : 'ดาวน์โหลดแพ็กเกจเชิงพาณิชย์แล้ว',
        );
        await reload();
      } catch (err) {
        setBuildStatus('blocked');
        setBuildMessage(err instanceof Error ? err.message : String(err));
      }
    },
    [context, selectedReport, selectedAssetId, selectedMarketplace, threshold, reload],
  );

  const handleThresholdChange = useCallback((value: number) => {
    const config = { minReadinessScore: value };
    saveSafetyThresholdConfig(config);
    setThreshold(config);
  }, []);

  return (
    <div className="production-panel">
      <section className="production-card">
        <h2>🏗 สายการผลิตเชิงพาณิชย์ (Commercial Pipeline)</h2>
        <p>ทุกตัวเลขคำนวณจากข้อมูลจริงในคลัง — ไม่มีการสมมติค่าใด ๆ</p>
        <button type="button" className="btn" disabled={loading} onClick={() => void reload()}>
          {loading ? 'กำลังโหลด…' : 'รีเฟรช'}
        </button>
        {error && <p className="production-error-text">{error}</p>}
      </section>

      {metrics && (
        <section className="production-card">
          <h2>ตัวชี้วัดธุรกิจ (Business Metrics)</h2>
          <div className="commercial-metrics-grid">
            <div className="commercial-metric-tile">
              <span className="commercial-metric-value">{metrics.commercialThroughputToday}</span>
              <span className="commercial-metric-label">แพ็กเกจวันนี้</span>
            </div>
            <div className="commercial-metric-tile">
              <span className="commercial-metric-value">{metrics.packagesPerHour ?? '—'}</span>
              <span className="commercial-metric-label">แพ็กเกจ/ชั่วโมง</span>
            </div>
            <div className="commercial-metric-tile">
              <span className="commercial-metric-value">{metrics.commercialReadinessAverage !== null ? `${metrics.commercialReadinessAverage}%` : '—'}</span>
              <span className="commercial-metric-label">Commercial Readiness เฉลี่ย</span>
            </div>
            <div className="commercial-metric-tile">
              <span className="commercial-metric-value">{metrics.readyToday}</span>
              <span className="commercial-metric-label">พร้อมส่งวันนี้</span>
            </div>
            <div className="commercial-metric-tile">
              <span className="commercial-metric-value">{metrics.readyThisWeek}</span>
              <span className="commercial-metric-label">พร้อมส่งสัปดาห์นี้</span>
            </div>
            <div className="commercial-metric-tile">
              <span className="commercial-metric-value">{metrics.ownerTimeSavedMinutesToday}</span>
              <span className="commercial-metric-label">นาทีที่ประหยัดวันนี้ (ประมาณการ, {MANUAL_MINUTES_PER_PACKAGE_BASELINE} นาที/แพ็กเกจ)</span>
            </div>
            <div className="commercial-metric-tile">
              <span className="commercial-metric-value">{metrics.automationPercent !== null ? `${metrics.automationPercent}%` : '—'}</span>
              <span className="commercial-metric-label">Automation %</span>
            </div>
          </div>
        </section>
      )}

      {dashboard && (
        <section className="production-card">
          <h2>Export Readiness Dashboard</h2>
          <p>ทั้งหมด {dashboard.totalAssets} ชิ้นงาน</p>
          <div className="commercial-bucket-grid">
            {dashboard.buckets.map((bucket) => (
              <div key={bucket.id} className={`commercial-bucket-card commercial-bucket-card--${bucket.id}`}>
                <div className="commercial-bucket-count">{bucket.count}</div>
                <div className="commercial-bucket-label">{bucket.label}</div>
                <p className="commercial-bucket-explanation">{bucket.explanation}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {recommendations.length > 0 && (
        <section className="production-card">
          <h2>AI แนะนำ (คุณค่าเชิงพาณิชย์สูงสุดก่อน)</h2>
          <ol>
            {recommendations.map((rec) => (
              <li key={rec.id}>
                <strong>{rec.title}</strong> — {rec.reason}
                <br />
                <small>{rec.expectedImpact}</small>
                {rec.assetId && (
                  <>
                    {' '}
                    <button type="button" className="btn btn--small" onClick={() => setSelectedAssetId(rec.assetId!)}>
                      เลือกชิ้นงานนี้
                    </button>
                  </>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="production-card">
        <h2>สร้างแพ็กเกจเชิงพาณิชย์ (Commercial Package Builder)</h2>
        <p>ตรวจสอบ (Review) → สร้างแพ็กเกจ (Build) → ตรวจสอบเกณฑ์ความปลอดภัย (Validate) → พร้อมส่งออก (Export Ready) — ในปุ่มเดียว</p>
        <div className="production-form-grid">
          <label>
            ชิ้นงาน
            <select value={selectedAssetId} onChange={(e) => setSelectedAssetId(e.target.value)}>
              {(context?.assets ?? []).map((a) => (
                <option key={a.assetId} value={a.assetId}>
                  {a.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            ตลาด
            <select value={selectedMarketplace} onChange={(e) => setSelectedMarketplace(e.target.value as MarketplaceId)}>
              {MARKETPLACE_LIST.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            เกณฑ์ความปลอดภัยขั้นต่ำ (Safety Threshold)
            <input type="number" min={0} max={100} value={threshold.minReadinessScore} onChange={(e) => handleThresholdChange(Number(e.target.value))} />
          </label>
        </div>

        {selectedReport && (
          <div className="commercial-selected-readiness">
            <span className={`commercial-score-badge ${scoreColor(selectedReport.score)}`}>Commercial Readiness {selectedReport.score}%</span>
            <span> — {selectedReport.band}</span>
            <ul className="commercial-check-list">
              {selectedReport.checks.map((check) => (
                <li key={check.id} className={`commercial-check commercial-check--${check.status.toLowerCase()}`}>
                  <strong>{check.label}:</strong> {check.status} — {check.detail}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button type="button" className="btn btn--primary" disabled={!selectedReport || buildStatus === 'building'} onClick={() => void handleBuildPackage(false)}>
          {buildStatus === 'building' ? 'กำลังสร้าง…' : 'สร้างแพ็กเกจเชิงพาณิชย์ (Build Commercial Package)'}
        </button>
        {buildStatus === 'blocked' && (
          <div>
            <p className="production-error-text">{buildMessage}</p>
            <button type="button" className="btn" onClick={() => void handleBuildPackage(true)}>
              ⚠️ ข้ามเกณฑ์และสร้างแพ็กเกจต่อ (Override)
            </button>
          </div>
        )}
        {buildStatus === 'done' && <p>{buildMessage}</p>}
      </section>
    </div>
  );
}
