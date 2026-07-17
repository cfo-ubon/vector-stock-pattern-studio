import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PortfolioAsset } from '../../catalog/domain/types';
import { searchPortfolioAssets, sortPortfolioAssets, type PortfolioFilterQuery, type PortfolioSortKey } from '../../catalog/domain/search';
import {
  loadPortfolioAssets,
  putPortfolioAsset,
  deletePortfolioAssetRecordOnly,
  deletePortfolioAssetAndFiles,
  portfolioStorageAvailable,
} from '../../catalog/storage/portfolioStore';
import { computeDashboardSummary, type DashboardSummary } from '../../catalog/services/dashboard';
import { runHealthCheck, duplicateAssetIdsFromReport, type HealthCheckReport } from '../../catalog/services/healthCheck';
import { PortfolioSidebar } from './PortfolioSidebar';
import { PortfolioGrid } from './PortfolioGrid';
import { PortfolioDetailPanel } from './PortfolioDetailPanel';
import { PortfolioImportPanel } from './PortfolioImportPanel';
import { PortfolioHealthCheckPanel } from './PortfolioHealthCheckPanel';
import './portfolio.css';

interface Props {
  onClose: () => void;
}

/** Sprint P1 — Portfolio Manager. Top-level container: owns the loaded
 * catalog, filters/sort, selection, and the import/health-check modals.
 * A dedicated top-level view (like `ProjectDashboard`/`DesignWorkbench`)
 * rather than a Design Workbench sidebar panel — the brief describes a
 * full application surface (dashboard + three-pane library + import +
 * health check), which doesn't fit the workbench's small-panel model. */
export function PortfolioManagerView({ onClose }: Props) {
  const [assets, setAssets] = useState<PortfolioAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [healthReport, setHealthReport] = useState<HealthCheckReport | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [query, setQuery] = useState<PortfolioFilterQuery>({});
  const [sortKey, setSortKey] = useState<PortfolioSortKey>('importedDesc');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showHealthCheck, setShowHealthCheck] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [loadedAssets, report] = await Promise.all([loadPortfolioAssets(), runHealthCheck()]);
      setAssets(loadedAssets);
      setHealthReport(report);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'โหลดคลังไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const refreshHealthCheck = useCallback(async () => {
    setHealthLoading(true);
    try {
      setHealthReport(await runHealthCheck());
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const duplicateAssetIds = useMemo(() => (healthReport ? duplicateAssetIdsFromReport(healthReport) : new Set<string>()), [healthReport]);

  const dashboardSummary: DashboardSummary | null = useMemo(
    () => (healthReport ? computeDashboardSummary(assets, healthReport) : null),
    [assets, healthReport],
  );

  const filteredSorted = useMemo(() => {
    const filtered = searchPortfolioAssets(assets, { ...query, duplicateAssetIds });
    return sortPortfolioAssets(filtered, sortKey);
  }, [assets, query, duplicateAssetIds, sortKey]);

  const selectedAsset = assets.find((a) => a.assetId === selectedAssetId) ?? null;

  const handleUpdateAsset = useCallback(async (updated: PortfolioAsset) => {
    await putPortfolioAsset(updated);
    setAssets((prev) => prev.map((a) => (a.assetId === updated.assetId ? updated : a)));
  }, []);

  const handleDeleteRecordOnly = useCallback(async (assetId: string) => {
    await deletePortfolioAssetRecordOnly(assetId);
    setAssets((prev) => prev.filter((a) => a.assetId !== assetId));
    setSelectedAssetId((cur) => (cur === assetId ? null : cur));
  }, []);

  const handleDeleteRecordAndFiles = useCallback(async (assetId: string) => {
    await deletePortfolioAssetAndFiles(assetId);
    setAssets((prev) => prev.filter((a) => a.assetId !== assetId));
    setSelectedAssetId((cur) => (cur === assetId ? null : cur));
  }, []);

  const handleImported = useCallback(() => {
    void reload();
  }, [reload]);

  if (!portfolioStorageAvailable()) {
    return (
      <div className="portfolio-manager portfolio-manager--unavailable">
        <p>เบราว์เซอร์นี้ไม่รองรับ IndexedDB — Portfolio Manager ต้องใช้ IndexedDB ในการเก็บข้อมูล</p>
        <button type="button" className="btn" onClick={onClose}>
          ← กลับหน้าสร้างลาย
        </button>
      </div>
    );
  }

  return (
    <div className="portfolio-manager">
      <div className="portfolio-manager-header">
        <h1>🗂 Portfolio Manager</h1>
        <button type="button" className="btn" onClick={onClose}>
          ← กลับหน้าสร้างลาย
        </button>
      </div>

      {loadError && <p className="portfolio-error-text">{loadError}</p>}
      {loading ? (
        <p className="portfolio-loading">กำลังโหลดคลัง…</p>
      ) : (
        <div className="portfolio-manager-body">
          <PortfolioSidebar
            summary={dashboardSummary}
            query={query}
            onChange={setQuery}
            onOpenImport={() => setShowImport(true)}
            onOpenHealthCheck={() => setShowHealthCheck(true)}
          />
          <PortfolioGrid
            assets={filteredSorted}
            query={query}
            onQueryChange={setQuery}
            sortKey={sortKey}
            onSortChange={setSortKey}
            duplicateAssetIds={duplicateAssetIds}
            selectedAssetId={selectedAssetId}
            onSelect={setSelectedAssetId}
          />
          {selectedAsset && (
            <PortfolioDetailPanel
              asset={selectedAsset}
              isDuplicate={duplicateAssetIds.has(selectedAsset.assetId)}
              onUpdate={handleUpdateAsset}
              onDeleteRecordOnly={handleDeleteRecordOnly}
              onDeleteRecordAndFiles={handleDeleteRecordAndFiles}
              onClose={() => setSelectedAssetId(null)}
            />
          )}
        </div>
      )}

      {showImport && <PortfolioImportPanel existingAssets={assets} onImported={handleImported} onClose={() => setShowImport(false)} />}
      {showHealthCheck && (
        <PortfolioHealthCheckPanel report={healthReport} loading={healthLoading} onRefresh={refreshHealthCheck} onClose={() => setShowHealthCheck(false)} />
      )}
    </div>
  );
}
