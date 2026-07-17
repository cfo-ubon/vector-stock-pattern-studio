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
import { PortfolioHealthCheckPanel } from './PortfolioHealthCheckPanel';
import { CollectionsView } from './CollectionsView';
import { CollectionAssignmentDialog } from './CollectionAssignmentDialog';
import './portfolio.css';

interface Props {
  onClose: () => void;
}

type ManagerSection = 'assets' | 'collections';

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
            onSelect={(id) => {
              setSelectedAssetId(id);
              setAssetDetailModal(false);
            }}
            multiSelectedIds={multiSelectedIds}
            onToggleMultiSelect={toggleMultiSelect}
            onSelectVisible={(ids) => setMultiSelectedIds(new Set(ids))}
            onClearSelection={() => setMultiSelectedIds(new Set())}
            onBulkAssign={() => setBulkDialogMode('assign')}
            onBulkRemove={() => setBulkDialogMode('remove')}
          />
          {selectedAsset && !assetDetailModal && (
            <PortfolioDetailPanel
              asset={selectedAsset}
              isDuplicate={duplicateAssetIds.has(selectedAsset.assetId)}
              onUpdate={handleUpdateAsset}
              onDeleteRecordOnly={handleDeleteRecordOnly}
              onDeleteRecordAndFiles={handleDeleteRecordAndFiles}
              onClose={() => setSelectedAssetId(null)}
              collections={collections}
              onAssignToCollections={handleAssignSingle}
              onRemoveFromCollection={handleRemoveSingle}
            />
          )}
        </div>
      ) : (
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
    </div>
  );
}
