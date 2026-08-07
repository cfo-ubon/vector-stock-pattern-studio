import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PortfolioAsset } from '../../catalog/domain/types';
import { searchPortfolioAssets, sortPortfolioAssets, type PortfolioFilterQuery, type PortfolioSortKey } from '../../catalog/domain/search';
import {
  loadPortfolioAssets,
  putPortfolioAsset,
  deletePortfolioAssetRecordOnly,
  deletePortfolioAssetAndFiles,
  portfolioStorageAvailable,
  loadFilesForAsset,
} from '../../catalog/storage/portfolioStore';
import { computeDashboardSummary, type DashboardSummary } from '../../catalog/services/dashboard';
import { runHealthCheck, duplicateAssetIdsFromReport, type HealthCheckReport } from '../../catalog/services/healthCheck';
import type { Collection } from '../../catalog/domain/collection';
import { loadCollections } from '../../catalog/storage/collectionStore';
import {
  createCollectionService,
  renameCollection,
  updateCollectionDescription,
  archiveCollection,
  unarchiveCollection,
  deleteCollectionSafely,
  setCollectionCoverAsset,
  assignAssetsToCollections,
  removeAssetsFromCollections,
  removeAssetFromCollection,
  validateCollectionIntegrity,
  repairOrphanedCollectionIds,
  repairCoverAssetIntegrity,
  type BulkMembershipResult,
  type CollectionIntegrityReport,
} from '../../catalog/services/collectionService';
import { PortfolioSidebar } from './PortfolioSidebar';
import { PortfolioGrid } from './PortfolioGrid';
import { PortfolioDetailPanel } from './PortfolioDetailPanel';
import { PortfolioImportPanel } from './PortfolioImportPanel';
import { DesignEditView } from '../designEdit/DesignEditView';
import { PortfolioHealthCheckPanel } from './PortfolioHealthCheckPanel';
import { CollectionsView } from './CollectionsView';
import { CollectionAssignmentDialog } from './CollectionAssignmentDialog';
import { ProductionCenterView } from '../production/ProductionCenterView';
import { AssetPreviewDialog } from './AssetPreviewDialog';
import { MarketplaceSelectionDialog } from './MarketplaceSelectionDialog';
import { DownloadCenter } from './DownloadCenter';
import { SubmissionHistoryPanel } from './SubmissionHistoryPanel';
import {
  deriveAssetExportStatus,
  buildBulkExportForMarketplace,
  findExportMarketplaceOption,
  type ExportMarketplaceId,
  type BulkExportResult,
  type AssetExportStatus,
} from '../../commercial/exportWorkflow';
import { loadCommercialPipelineContext } from '../../commercial/loadCommercialPipelineContext';
import type { CommercialReadinessReport, CommercialPackageHistoryEntry } from '../../commercial/domain/types';
import { loadSubmissions } from '../../catalog/submission/submissionStore';
import type { SubmissionRecord } from '../../catalog/submission/submissionRecord';
import { detectDuplicateSubmission } from '../../catalog/submission/submissionDuplicateDetection';
import { loadCommercialPackageHistory, recordCommercialPackageBuilt } from '../../commercial/storage/commercialPackageHistoryStore';
import { computeSeoScore, type SeoScoreReport } from '../../catalog/seo/seoScoring';
import { saveSubmissionPackageToWorkspace } from '../../workspace/workspaceExportIntegration';
import { downloadBlobFile } from '../../export/svgExporter';
import './portfolio.css';

interface Props {
  onClose: () => void;
}

type ManagerSection = 'assets' | 'collections' | 'production';

/** Sprint P1 / Portfolio Manager P2 Stage 2 — Top-level container: owns
 * the loaded catalog, the loaded collection list, filters/sort/selection,
 * the import/health-check/collection modals, and every mutation for both
 * assets and collections. Collections P2 Stage 2 (Section 3) adds a
 * lightweight "ชิ้นงาน / คอลเลกชัน" (Assets/Collections) tab inside this
 * same container rather than a new top-level `App.tsx` view — the
 * existing Dashboard summary already lives in `PortfolioSidebar` and stays
 * visible in the Assets tab, so a separate "Dashboard" tab would only
 * duplicate it; see `docs/portfolio/P2_STAGE2_UI_ARCHITECTURE.md` for the
 * full rationale. Every collection mutation goes through
 * `catalog/services/collectionService.ts` (never IndexedDB directly, per
 * the Stage 2 architecture lock) and then refreshes both `assets` and
 * `collections` local state, since membership operations mutate
 * `PortfolioAsset.collectionIds` on the asset side. */
export function PortfolioManagerView({ onClose }: Props) {
  const [section, setSection] = useState<ManagerSection>('assets');
  const [assets, setAssets] = useState<PortfolioAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [healthReport, setHealthReport] = useState<HealthCheckReport | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [query, setQuery] = useState<PortfolioFilterQuery>({});
  const [sortKey, setSortKey] = useState<PortfolioSortKey>('importedDesc');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [assetDetailModal, setAssetDetailModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showHealthCheck, setShowHealthCheck] = useState(false);

  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [collectionsError, setCollectionsError] = useState<string | null>(null);
  const [integrityReport, setIntegrityReport] = useState<CollectionIntegrityReport | null>(null);
  const [integrityLoading, setIntegrityLoading] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialogMode, setBulkDialogMode] = useState<'assign' | 'remove' | null>(null);

  // --- Hotfix v1.0.1: Commercial Export UX ---------------------------
  const [previewAssetId, setPreviewAssetId] = useState<string | null>(null);
  const [editDesignAssetId, setEditDesignAssetId] = useState<string | null>(null);
  const [previewSeoScore, setPreviewSeoScore] = useState<SeoScoreReport | null>(null);
  const [marketplaceSelectionAssetIds, setMarketplaceSelectionAssetIds] = useState<string[] | null>(null);
  const [duplicateWarnings, setDuplicateWarnings] = useState<string[] | null>(null);
  const [pendingMarketplaceIds, setPendingMarketplaceIds] = useState<ExportMarketplaceId[] | null>(null);
  const [downloadPackages, setDownloadPackages] = useState<BulkExportResult[]>([]);
  const [showDownloadCenter, setShowDownloadCenter] = useState(false);
  const [bulkExportBusy, setBulkExportBusy] = useState(false);
  const [bulkExportError, setBulkExportError] = useState<string | null>(null);
  const [submissionHistoryAssetId, setSubmissionHistoryAssetId] = useState<string | null>(null);

  const [readinessByAsset, setReadinessByAsset] = useState<Map<string, CommercialReadinessReport>>(new Map());
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [packageHistory, setPackageHistory] = useState<CommercialPackageHistoryEntry[]>([]);

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

  /** Silent refresh — same fetch as `reload()` but never toggles `loading`.
   * `reload()`'s full-screen "กำลังโหลดคลัง…" state replaces the entire
   * Assets pane (see the render below), which would unmount any open
   * detail panel or dialog on every collection mutation (assign/remove/
   * delete/repair all call this after writing to IndexedDB, several times
   * per user action) — a real usability bug, not just a test artifact.
   * Collection mutations use this instead; `reload()` stays for the
   * initial mount and explicit user-triggered reloads (e.g. after import). */
  const refreshAssetsQuietly = useCallback(async () => {
    const [loadedAssets, report] = await Promise.all([loadPortfolioAssets(), runHealthCheck()]);
    setAssets(loadedAssets);
    setHealthReport(report);
  }, []);

  const reloadCollections = useCallback(async () => {
    setCollectionsLoading(true);
    setCollectionsError(null);
    try {
      setCollections(await loadCollections());
    } catch (e) {
      setCollectionsError(e instanceof Error ? e.message : 'โหลดคอลเลกชันไม่สำเร็จ');
    } finally {
      setCollectionsLoading(false);
    }
  }, []);

  /** Silent counterpart to `reloadCollections()` — same rationale as
   * `refreshAssetsQuietly` above. */
  const refreshCollectionsQuietly = useCallback(async () => {
    setCollectionsError(null);
    try {
      setCollections(await loadCollections());
    } catch (e) {
      setCollectionsError(e instanceof Error ? e.message : 'โหลดคอลเลกชันไม่สำเร็จ');
    }
  }, []);

  useEffect(() => {
    void reload();
    void reloadCollections();
  }, [reload, reloadCollections]);

  /** Hotfix v1.0.1 — loads the same real, already-computed Commercial
   * Readiness reports (`loadCommercialPipelineContext`, Build 031A) and
   * package-build history (`commercialPackageHistoryStore`, Build 031A
   * Phase 8) every other Commercial Pipeline surface already reads, once
   * per Portfolio Manager session/refresh rather than per-card — Part 11's
   * "Preview must open instantly" requirement, satisfied by batch-loading
   * once instead of computing readiness on every click. */
  const loadCommercialData = useCallback(async () => {
    const [ctx, history] = await Promise.all([loadCommercialPipelineContext(), loadCommercialPackageHistory()]);
    setReadinessByAsset(new Map(ctx.readinessReports.map((r) => [r.assetId, r])));
    setSubmissions(loadSubmissions());
    setPackageHistory(history);
  }, []);

  useEffect(() => {
    void loadCommercialData();
  }, [loadCommercialData]);

  /** Portfolio Manager P2 Stage 2, Section 11 — multi-selection is cleared
   * whenever the active filter/search query changes, so a selection can
   * never silently carry over to a different, unrelated result set. */
  useEffect(() => {
    setMultiSelectedIds(new Set());
  }, [query]);

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

  // --- Hotfix v1.0.1: Commercial Export UX derived data ----------------

  const submissionsByAsset = useMemo(() => {
    const map = new Map<string, SubmissionRecord[]>();
    for (const submission of submissions) {
      const list = map.get(submission.patternId) ?? [];
      list.push(submission);
      map.set(submission.patternId, list);
    }
    return map;
  }, [submissions]);

  const packageHistoryByAsset = useMemo(() => {
    const map = new Map<string, CommercialPackageHistoryEntry[]>();
    for (const entry of packageHistory) {
      const list = map.get(entry.assetId) ?? [];
      list.push(entry);
      map.set(entry.assetId, list);
    }
    return map;
  }, [packageHistory]);

  /** Part 7 — Export Status per asset, batch-derived once (not per card)
   * from real readiness/submission/package-history data via
   * `exportWorkflow.ts`'s `deriveAssetExportStatus`. */
  const exportStatusByAsset = useMemo(() => {
    const map = new Map<string, AssetExportStatus>();
    for (const asset of assets) {
      map.set(
        asset.assetId,
        deriveAssetExportStatus({
          readiness: readinessByAsset.get(asset.assetId) ?? null,
          submissionsForAsset: submissionsByAsset.get(asset.assetId) ?? [],
          packageHistoryForAsset: packageHistoryByAsset.get(asset.assetId) ?? [],
        }),
      );
    }
    return map;
  }, [assets, readinessByAsset, submissionsByAsset, packageHistoryByAsset]);

  const previewAsset = assets.find((a) => a.assetId === previewAssetId) ?? null;

  useEffect(() => {
    if (!previewAssetId) {
      setPreviewSeoScore(null);
      return;
    }
    const relevant = submissionsByAsset.get(previewAssetId) ?? [];
    const best = relevant.find((s) => s.titleSnapshot.trim().length > 0 && s.keywordSnapshot.length > 0);
    if (!best) {
      setPreviewSeoScore(null);
      return;
    }
    setPreviewSeoScore(computeSeoScore({ title: best.titleSnapshot, description: best.descriptionSnapshot, keywords: best.keywordSnapshot }, best.marketplaceId));
  }, [previewAssetId, submissionsByAsset]);

  /** Part 8 — soft duplicate-submission gate: an already-`SUBMITTED`/
   * `APPROVED` submission to the same marketplace produces a warning the
   * owner must acknowledge before the export proceeds, reusing
   * `submissionDuplicateDetection.ts`'s existing, unmodified rules rather
   * than a new check. This never blocks silently and never uploads
   * anything — it only guards the local export action. */
  const computeDuplicateWarnings = useCallback(
    (assetIds: string[], marketplaceIds: ExportMarketplaceId[]): string[] => {
      const warnings: string[] = [];
      for (const assetId of assetIds) {
        const asset = assets.find((a) => a.assetId === assetId);
        if (!asset) continue;
        for (const marketplaceId of marketplaceIds) {
          const relevant = submissionsByAsset.get(assetId) ?? [];
          const nextVersion = (relevant.filter((s) => s.marketplaceId === marketplaceId).sort((a, b) => b.version - a.version)[0]?.version ?? 0) + 1;
          const result = detectDuplicateSubmission({ patternId: assetId, marketplaceId, version: nextVersion, productionAssetId: asset.productionAssetId }, submissions);
          if (result.conflicts.some((c) => c.reason === 'already-approved' || c.reason === 'already-submitted')) {
            warnings.push(`${asset.displayName} — ${findExportMarketplaceOption(marketplaceId)?.label ?? marketplaceId}: มีการส่งที่อนุมัติ/รอตรวจอยู่แล้ว`);
          }
        }
      }
      return warnings;
    },
    [assets, submissions, submissionsByAsset],
  );

  const executeBulkExport = useCallback(
    async (assetIds: string[], marketplaceIds: ExportMarketplaceId[]) => {
      const targetAssets = assets.filter((a) => assetIds.includes(a.assetId));
      setBulkExportBusy(true);
      setBulkExportError(null);
      try {
        const results: BulkExportResult[] = [];
        for (const marketplaceId of marketplaceIds) {
          const option = findExportMarketplaceOption(marketplaceId);
          if (!option) continue;
          const inputs = await Promise.all(
            targetAssets.map(async (asset) => {
              const files = await loadFilesForAsset(asset.assetId);
              const assetSubmissions = submissionsByAsset.get(asset.assetId) ?? [];
              const submission = assetSubmissions.find((s) => s.marketplaceId === marketplaceId) ?? null;
              return {
                asset,
                files,
                readiness: readinessByAsset.get(asset.assetId) ?? null,
                submission,
                collections: collections.filter((c) => asset.collectionIds.includes(c.id)),
              };
            }),
          );
          const result = await buildBulkExportForMarketplace(option, inputs);
          results.push(result);
          downloadBlobFile(result.filename, result.blob);
          void saveSubmissionPackageToWorkspace(option.id, result);
          for (const assetId of result.builtAssetIds) {
            await recordCommercialPackageBuilt({
              assetId,
              marketplaceId: option.id,
              status: 'BUILT',
              readinessScore: readinessByAsset.get(assetId)?.score ?? 0,
            });
          }
        }
        setDownloadPackages((prev) => [...results, ...prev]);
        setMarketplaceSelectionAssetIds(null);
        setDuplicateWarnings(null);
        setPendingMarketplaceIds(null);
        setShowDownloadCenter(true);
        await loadCommercialData();
      } catch (err) {
        setBulkExportError(err instanceof Error ? err.message : String(err));
      } finally {
        setBulkExportBusy(false);
      }
    },
    [assets, submissionsByAsset, readinessByAsset, collections, loadCommercialData],
  );

  const handleExportRequested = useCallback(
    (marketplaceIds: ExportMarketplaceId[]) => {
      const assetIds = marketplaceSelectionAssetIds ?? [];
      const warnings = computeDuplicateWarnings(assetIds, marketplaceIds);
      if (warnings.length > 0) {
        setDuplicateWarnings(warnings);
        setPendingMarketplaceIds(marketplaceIds);
        return;
      }
      void executeBulkExport(assetIds, marketplaceIds);
    },
    [marketplaceSelectionAssetIds, computeDuplicateWarnings, executeBulkExport],
  );

  const handleConfirmDespiteDuplicates = useCallback(() => {
    if (!pendingMarketplaceIds) return;
    const assetIds = marketplaceSelectionAssetIds ?? [];
    void executeBulkExport(assetIds, pendingMarketplaceIds);
  }, [pendingMarketplaceIds, marketplaceSelectionAssetIds, executeBulkExport]);

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

  // -----------------------------------------------------------------
  // Collection mutations — every one calls collectionService.ts, then
  // refreshes both assets and collections local state.
  // -----------------------------------------------------------------

  const handleCreateCollection = useCallback(
    async (name: string, description: string) => {
      const created = await createCollectionService({ name, description });
      await refreshCollectionsQuietly();
      return created;
    },
    [refreshCollectionsQuietly],
  );

  const handleRenameCollection = useCallback(
    async (id: string, name: string) => {
      await renameCollection(id, name);
      await refreshCollectionsQuietly();
    },
    [refreshCollectionsQuietly],
  );

  const handleUpdateDescription = useCallback(
    async (id: string, description: string) => {
      await updateCollectionDescription(id, description);
      await refreshCollectionsQuietly();
    },
    [refreshCollectionsQuietly],
  );

  const handleArchiveCollection = useCallback(
    async (id: string) => {
      await archiveCollection(id);
      await refreshCollectionsQuietly();
    },
    [refreshCollectionsQuietly],
  );

  const handleUnarchiveCollection = useCallback(
    async (id: string) => {
      await unarchiveCollection(id);
      await refreshCollectionsQuietly();
    },
    [refreshCollectionsQuietly],
  );

  const handleDeleteCollection = useCallback(
    async (id: string) => {
      await deleteCollectionSafely(id);
      await Promise.all([refreshAssetsQuietly(), refreshCollectionsQuietly()]);
    },
    [refreshAssetsQuietly, refreshCollectionsQuietly],
  );

  const handleSetCover = useCallback(
    async (id: string, assetId: string | null) => {
      await setCollectionCoverAsset(id, assetId);
      await refreshCollectionsQuietly();
    },
    [refreshCollectionsQuietly],
  );

  const handleBulkAssign = useCallback(
    async (assetIds: string[], collectionIds: string[]): Promise<BulkMembershipResult> => {
      const result = await assignAssetsToCollections(assetIds, collectionIds);
      await Promise.all([refreshAssetsQuietly(), refreshCollectionsQuietly()]);
      return result;
    },
    [refreshAssetsQuietly, refreshCollectionsQuietly],
  );

  const handleBulkRemove = useCallback(
    async (assetIds: string[], collectionIds: string[]): Promise<BulkMembershipResult> => {
      const result = await removeAssetsFromCollections(assetIds, collectionIds);
      await Promise.all([refreshAssetsQuietly(), refreshCollectionsQuietly()]);
      return result;
    },
    [refreshAssetsQuietly, refreshCollectionsQuietly],
  );

  const handleAssignSingle = useCallback(
    async (assetId: string, collectionIds: string[]): Promise<BulkMembershipResult> => {
      const result = await assignAssetsToCollections([assetId], collectionIds);
      await Promise.all([refreshAssetsQuietly(), refreshCollectionsQuietly()]);
      return result;
    },
    [refreshAssetsQuietly, refreshCollectionsQuietly],
  );

  const handleRemoveSingle = useCallback(
    async (assetId: string, collectionId: string) => {
      await removeAssetFromCollection(assetId, collectionId);
      await Promise.all([refreshAssetsQuietly(), refreshCollectionsQuietly()]);
    },
    [refreshAssetsQuietly, refreshCollectionsQuietly],
  );

  const handleRemoveFromCollectionView = useCallback(
    async (assetIds: string[], collectionId: string): Promise<BulkMembershipResult> => {
      const result = await removeAssetsFromCollections(assetIds, [collectionId]);
      await Promise.all([refreshAssetsQuietly(), refreshCollectionsQuietly()]);
      return result;
    },
    [refreshAssetsQuietly, refreshCollectionsQuietly],
  );

  const handleScanIntegrity = useCallback(async () => {
    setIntegrityLoading(true);
    try {
      setIntegrityReport(await validateCollectionIntegrity());
    } finally {
      setIntegrityLoading(false);
    }
  }, []);

  const handleRepairOrphans = useCallback(async () => {
    const result = await repairOrphanedCollectionIds();
    await Promise.all([refreshAssetsQuietly(), refreshCollectionsQuietly()]);
    setIntegrityReport(await validateCollectionIntegrity());
    return result;
  }, [refreshAssetsQuietly, refreshCollectionsQuietly]);

  const handleRepairCovers = useCallback(async () => {
    const result = await repairCoverAssetIntegrity();
    await Promise.all([refreshAssetsQuietly(), refreshCollectionsQuietly()]);
    setIntegrityReport(await validateCollectionIntegrity());
    return result;
  }, [refreshAssetsQuietly, refreshCollectionsQuietly]);

  const handleOpenAssetFromCollection = useCallback((assetId: string) => {
    setSelectedAssetId(assetId);
    setAssetDetailModal(true);
  }, []);

  const toggleMultiSelect = useCallback((assetId: string) => {
    setMultiSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }, []);

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
        <button type="button" className="btn" onClick={() => setShowDownloadCenter(true)}>
          📦 Download Center{downloadPackages.length > 0 ? ` (${downloadPackages.length})` : ''}
        </button>
        <button type="button" className="btn" onClick={onClose}>
          ← กลับหน้าสร้างลาย
        </button>
      </div>

      <nav className="portfolio-section-nav" aria-label="ส่วนของ Portfolio Manager">
        <button type="button" className={`btn${section === 'assets' ? ' btn--primary' : ''}`} aria-pressed={section === 'assets'} onClick={() => setSection('assets')}>
          ชิ้นงาน
        </button>
        <button
          type="button"
          className={`btn${section === 'collections' ? ' btn--primary' : ''}`}
          aria-pressed={section === 'collections'}
          onClick={() => setSection('collections')}
        >
          คอลเลกชัน
        </button>
        <button
          type="button"
          className={`btn${section === 'production' ? ' btn--primary' : ''}`}
          aria-pressed={section === 'production'}
          onClick={() => setSection('production')}
        >
          ศูนย์การผลิต
        </button>
      </nav>

      {loadError && <p className="portfolio-error-text">{loadError}</p>}
      {loading ? (
        <p className="portfolio-loading">กำลังโหลดคลัง…</p>
      ) : section === 'assets' ? (
        <div className="portfolio-manager-body">
          <PortfolioSidebar
            summary={dashboardSummary}
            query={query}
            onChange={setQuery}
            onOpenImport={() => setShowImport(true)}
            onOpenHealthCheck={() => setShowHealthCheck(true)}
            collections={collections}
          />
          <PortfolioGrid
            assets={filteredSorted}
            query={query}
            onQueryChange={setQuery}
            sortKey={sortKey}
            onSortChange={setSortKey}
            duplicateAssetIds={duplicateAssetIds}
            selectedAssetId={selectedAssetId}
            onSelect={(id) => setPreviewAssetId(id)}
            multiSelectedIds={multiSelectedIds}
            onToggleMultiSelect={toggleMultiSelect}
            onSelectVisible={(ids) => setMultiSelectedIds(new Set(ids))}
            onClearSelection={() => setMultiSelectedIds(new Set())}
            onBulkAssign={() => setBulkDialogMode('assign')}
            onBulkRemove={() => setBulkDialogMode('remove')}
            onBulkExport={() => setMarketplaceSelectionAssetIds([...multiSelectedIds])}
            exportStatusByAsset={exportStatusByAsset}
          />
        </div>
      ) : section === 'collections' ? (
        <CollectionsView
          collections={collections}
          collectionsLoading={collectionsLoading}
          collectionsError={collectionsError}
          assets={assets}
          duplicateAssetIds={duplicateAssetIds}
          onCreateCollection={handleCreateCollection}
          onRenameCollection={handleRenameCollection}
          onUpdateDescription={handleUpdateDescription}
          onArchiveCollection={handleArchiveCollection}
          onUnarchiveCollection={handleUnarchiveCollection}
          onDeleteCollection={handleDeleteCollection}
          onSetCover={handleSetCover}
          onRemoveAssetsFromCollection={handleRemoveFromCollectionView}
          onOpenAsset={handleOpenAssetFromCollection}
          integrityReport={integrityReport}
          integrityLoading={integrityLoading}
          onScanIntegrity={handleScanIntegrity}
          onRepairOrphans={handleRepairOrphans}
          onRepairCovers={handleRepairCovers}
          selectedCollectionId={selectedCollectionId}
          onSelectCollection={setSelectedCollectionId}
        />
      ) : (
        <ProductionCenterView assets={assets} onClose={() => setSection('assets')} />
      )}

      {assetDetailModal && selectedAsset && (
        <div className="portfolio-modal-backdrop" role="dialog" aria-modal="true" aria-label={selectedAsset.displayName}>
          <div className="portfolio-modal collection-asset-detail-modal">
            <PortfolioDetailPanel
              asset={selectedAsset}
              isDuplicate={duplicateAssetIds.has(selectedAsset.assetId)}
              onUpdate={handleUpdateAsset}
              onDeleteRecordOnly={handleDeleteRecordOnly}
              onDeleteRecordAndFiles={handleDeleteRecordAndFiles}
              onClose={() => {
                setSelectedAssetId(null);
                setAssetDetailModal(false);
              }}
              collections={collections}
              onAssignToCollections={handleAssignSingle}
              onRemoveFromCollection={handleRemoveSingle}
            />
          </div>
        </div>
      )}

      {bulkDialogMode && (
        <CollectionAssignmentDialog
          mode={bulkDialogMode}
          assetIds={[...multiSelectedIds]}
          collections={collections}
          onConfirm={(collectionIds) =>
            bulkDialogMode === 'assign'
              ? handleBulkAssign([...multiSelectedIds], collectionIds)
              : handleBulkRemove([...multiSelectedIds], collectionIds)
          }
          onClose={() => setBulkDialogMode(null)}
        />
      )}

      {showImport && <PortfolioImportPanel existingAssets={assets} onImported={handleImported} onClose={() => setShowImport(false)} />}
      {showHealthCheck && (
        <PortfolioHealthCheckPanel report={healthReport} loading={healthLoading} onRefresh={refreshHealthCheck} onClose={() => setShowHealthCheck(false)} />
      )}

      {previewAsset && (
        <AssetPreviewDialog
          asset={previewAsset}
          readiness={readinessByAsset.get(previewAsset.assetId) ?? null}
          seoScore={previewSeoScore}
          collections={collections}
          exportStatus={exportStatusByAsset.get(previewAsset.assetId) ?? { id: 'never-exported', label: 'ยังไม่เคย Export', at: null }}
          onClose={() => setPreviewAssetId(null)}
          onOpenEditDetails={() => {
            setSelectedAssetId(previewAsset.assetId);
            setAssetDetailModal(true);
            setPreviewAssetId(null);
          }}
          onExport={() => {
            setMarketplaceSelectionAssetIds([previewAsset.assetId]);
            setPreviewAssetId(null);
          }}
          onOpenSubmissionHistory={() => {
            setSubmissionHistoryAssetId(previewAsset.assetId);
            setPreviewAssetId(null);
          }}
          onOpenEditDesign={() => {
            setEditDesignAssetId(previewAsset.assetId);
            setPreviewAssetId(null);
          }}
        />
      )}

      {editDesignAssetId &&
        (() => {
          const editAsset = assets.find((a) => a.assetId === editDesignAssetId);
          if (!editAsset) return null;
          return (
            <DesignEditView
              asset={editAsset}
              existingAssets={assets}
              originalReadiness={readinessByAsset.get(editAsset.assetId) ?? null}
              onClose={() => setEditDesignAssetId(null)}
              onSaved={() => {
                void refreshAssetsQuietly().then(() => loadCommercialData());
              }}
            />
          );
        })()}

      {marketplaceSelectionAssetIds && !duplicateWarnings && (
        <MarketplaceSelectionDialog
          assetCount={marketplaceSelectionAssetIds.length}
          busy={bulkExportBusy}
          onConfirm={handleExportRequested}
          onClose={() => setMarketplaceSelectionAssetIds(null)}
        />
      )}

      {duplicateWarnings && (
        <div className="portfolio-modal-backdrop" role="dialog" aria-modal="true" aria-label="คำเตือนการส่งซ้ำ">
          <div className="portfolio-modal">
            <div className="portfolio-detail-header">
              <h2>⚠️ พบการส่งซ้ำ</h2>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setDuplicateWarnings(null);
                  setPendingMarketplaceIds(null);
                }}
              >
                ยกเลิก
              </button>
            </div>
            <ul>
              {duplicateWarnings.map((warning, i) => (
                <li key={i} className="portfolio-error-text">
                  {warning}
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn--primary" disabled={bulkExportBusy} onClick={handleConfirmDespiteDuplicates}>
              {bulkExportBusy ? 'กำลัง Export…' : 'ยืนยัน Export ต่อไป'}
            </button>
          </div>
        </div>
      )}

      {bulkExportError && (
        <p className="portfolio-error-text" role="alert">
          Export ไม่สำเร็จ: {bulkExportError}
        </p>
      )}

      {submissionHistoryAssetId && (
        <SubmissionHistoryPanel
          displayName={assets.find((a) => a.assetId === submissionHistoryAssetId)?.displayName ?? submissionHistoryAssetId}
          submissions={submissionsByAsset.get(submissionHistoryAssetId) ?? []}
          onClose={() => setSubmissionHistoryAssetId(null)}
        />
      )}

      {showDownloadCenter && <DownloadCenter packages={downloadPackages} onClose={() => setShowDownloadCenter(false)} />}
    </div>
  );
}
