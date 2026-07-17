import { useMemo, useState } from 'react';
import type { Collection } from '../../catalog/domain/collection';
import type { PortfolioAsset } from '../../catalog/domain/types';
import type { BulkMembershipResult, CollectionIntegrityReport } from '../../catalog/services/collectionService';
import { CollectionList } from './CollectionList';
import { CollectionDetailPanel } from './CollectionDetailPanel';
import { CreateCollectionDialog } from './CreateCollectionDialog';
import { CollectionIntegrityPanel } from './CollectionIntegrityPanel';

type CollectionsTab = 'all' | 'active' | 'archived' | 'integrity';

const TAB_LABEL_TH: Record<CollectionsTab, string> = {
  all: 'ทั้งหมด',
  active: 'ใช้งานอยู่',
  archived: 'เก็บถาวร',
  integrity: 'ตรวจสอบข้อมูล',
};

interface Props {
  collections: Collection[];
  collectionsLoading: boolean;
  collectionsError: string | null;
  assets: PortfolioAsset[];
  duplicateAssetIds: ReadonlySet<string>;
  onCreateCollection: (name: string, description: string) => Promise<Collection>;
  onRenameCollection: (id: string, name: string) => Promise<void>;
  onUpdateDescription: (id: string, description: string) => Promise<void>;
  onArchiveCollection: (id: string) => Promise<void>;
  onUnarchiveCollection: (id: string) => Promise<void>;
  onDeleteCollection: (id: string) => Promise<void>;
  onSetCover: (id: string, assetId: string | null) => Promise<void>;
  onRemoveAssetsFromCollection: (assetIds: string[], collectionId: string) => Promise<BulkMembershipResult>;
  onOpenAsset: (assetId: string) => void;
  integrityReport: CollectionIntegrityReport | null;
  integrityLoading: boolean;
  onScanIntegrity: () => Promise<void>;
  onRepairOrphans: () => Promise<BulkMembershipResult>;
  onRepairCovers: () => Promise<BulkMembershipResult>;
  /** Lifted to `PortfolioManagerView` (not local state here) so the
   * selected collection survives switching to the Assets tab and back —
   * this component fully unmounts on tab switch (a different JSX branch
   * in the parent), so any state kept here would be lost, unlike the
   * Assets tab's own `selectedAssetId`, which already lives in the
   * parent for the same reason. */
  selectedCollectionId: string | null;
  onSelectCollection: (id: string | null) => void;
}

/** Portfolio Manager P2 Stage 2, Section 3 — Collections area top-level
 * container: owns the All/Active/Archived/Integrity sub-navigation and
 * the selected-collection detail view. Lives *inside* `PortfolioManagerView`
 * (a new tab alongside "Assets"), not a new top-level `App.tsx` view —
 * per the brief's "may follow the current Portfolio Manager navigation
 * pattern... do not redesign the whole application shell." All data and
 * every mutation is owned by the parent (`PortfolioManagerView`) and
 * passed down as props, the same "container owns state, presentational
 * children call back up" shape as the existing Assets tab. */
export function CollectionsView({
  collections,
  collectionsLoading,
  collectionsError,
  assets,
  duplicateAssetIds,
  onCreateCollection,
  onRenameCollection,
  onUpdateDescription,
  onArchiveCollection,
  onUnarchiveCollection,
  onDeleteCollection,
  onSetCover,
  onRemoveAssetsFromCollection,
  onOpenAsset,
  integrityReport,
  integrityLoading,
  onScanIntegrity,
  onRepairOrphans,
  onRepairCovers,
  selectedCollectionId,
  onSelectCollection,
}: Props) {
  const [tab, setTab] = useState<CollectionsTab>('all');
  const [showCreate, setShowCreate] = useState(false);

  const assetCountByCollectionId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const asset of assets) {
      for (const id of asset.collectionIds) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, [assets]);

  const integrityFlaggedIds = useMemo(
    () => new Set(integrityReport?.invalidCoverAssetReferences.map((r) => r.collectionId) ?? []),
    [integrityReport],
  );

  const visibleCollections = useMemo(() => {
    if (tab === 'active') return collections.filter((c) => !c.isArchived);
    if (tab === 'archived') return collections.filter((c) => c.isArchived);
    return collections;
  }, [collections, tab]);

  const selectedCollection = collections.find((c) => c.id === selectedCollectionId) ?? null;
  const memberAssets = useMemo(
    () => (selectedCollection ? assets.filter((a) => a.collectionIds.includes(selectedCollection.id)) : []),
    [assets, selectedCollection],
  );

  const handleDelete = async (id: string) => {
    await onDeleteCollection(id);
    if (selectedCollectionId === id) onSelectCollection(null);
  };

  return (
    <div className="portfolio-manager-body collections-body">
      <div className="collections-nav-and-list">
        <nav className="collections-tab-nav" aria-label="มุมมองคอลเลกชัน">
          {(Object.keys(TAB_LABEL_TH) as CollectionsTab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`btn btn--small${tab === t ? ' btn--primary' : ''}`}
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
            >
              {TAB_LABEL_TH[t]}
            </button>
          ))}
        </nav>

        {tab === 'integrity' ? (
          <CollectionIntegrityPanel
            report={integrityReport}
            loading={integrityLoading}
            onScan={onScanIntegrity}
            onRepairOrphans={onRepairOrphans}
            onRepairCovers={onRepairCovers}
          />
        ) : (
          <CollectionList
            collections={visibleCollections}
            assetCountByCollectionId={assetCountByCollectionId}
            integrityFlaggedIds={integrityFlaggedIds}
            selectedCollectionId={selectedCollectionId}
            onSelect={onSelectCollection}
            onCreateNew={() => setShowCreate(true)}
            loading={collectionsLoading}
            error={collectionsError}
          />
        )}
      </div>

      {selectedCollection && (
        <CollectionDetailPanel
          collection={selectedCollection}
          memberAssets={memberAssets}
          duplicateAssetIds={duplicateAssetIds}
          onRename={onRenameCollection}
          onUpdateDescription={onUpdateDescription}
          onArchive={onArchiveCollection}
          onUnarchive={onUnarchiveCollection}
          onDelete={handleDelete}
          onSetCover={onSetCover}
          onRemoveAssets={onRemoveAssetsFromCollection}
          onOpenAsset={onOpenAsset}
          onClose={() => onSelectCollection(null)}
        />
      )}

      {showCreate && (
        <CreateCollectionDialog
          onCreate={onCreateCollection}
          onCreated={(collection) => {
            setShowCreate(false);
            onSelectCollection(collection.id);
          }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
