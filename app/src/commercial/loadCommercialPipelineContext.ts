import { loadPortfolioAssets } from '../catalog/storage/portfolioStore';
import { loadCollections } from '../catalog/storage/collectionStore';
import { loadQualitySnapshots } from '../catalog/quality/qualitySnapshotStore';
import { loadSubmissions, whenSubmissionStoreHydrated } from '../catalog/submission/submissionStore';
import type { PortfolioAsset } from '../catalog/domain/types';
import type { Collection } from '../catalog/domain/collection';
import type { QualitySnapshot } from '../catalog/quality/qualitySnapshotStore';
import type { SubmissionRecord } from '../catalog/submission/submissionRecord';
import { computeCommercialReadiness } from './readinessEngine';
import { checkCollectionCompleteness } from './collectionCompleteness';
import type { CommercialReadinessReport, CollectionCompletenessReport } from './domain/types';

// Build 031A — the one shared loader every Commercial Pipeline UI surface
// reads from, mirroring `aiCeo/loadDecisionContext.ts`'s own "one real
// loader, every consumer reuses it" convention. Pulls the same
// already-persisted stores every other catalog module reads (no new
// domain data of its own) and computes a `CommercialReadinessReport` per
// active (non-archived) asset plus a `CollectionCompletenessReport` per
// active collection.

export interface CommercialPipelineContext {
  assets: PortfolioAsset[];
  collections: Collection[];
  readinessReports: CommercialReadinessReport[];
  collectionCompleteness: CollectionCompletenessReport[];
  assetsById: Map<string, PortfolioAsset>;
  collectionsById: Map<string, Collection>;
}

export async function loadCommercialPipelineContext(now: number = Date.now()): Promise<CommercialPipelineContext> {
  await whenSubmissionStoreHydrated();
  const [allAssets, collections, snapshots] = await Promise.all([loadPortfolioAssets(), loadCollections(), loadQualitySnapshots()]);
  const submissions: SubmissionRecord[] = loadSubmissions();

  const assets = allAssets.filter((a) => !a.isArchived);
  const assetsById = new Map(assets.map((a) => [a.assetId, a]));
  const collectionsById = new Map(collections.map((c) => [c.id, c]));

  const latestSnapshotByAsset = new Map<string, QualitySnapshot>();
  for (const snapshot of snapshots) {
    const existing = latestSnapshotByAsset.get(snapshot.assetId);
    if (!existing || snapshot.createdAt > existing.createdAt) latestSnapshotByAsset.set(snapshot.assetId, snapshot);
  }

  const submissionsByAsset = new Map<string, SubmissionRecord[]>();
  for (const submission of submissions) {
    const list = submissionsByAsset.get(submission.patternId) ?? [];
    list.push(submission);
    submissionsByAsset.set(submission.patternId, list);
  }

  const readinessReports: CommercialReadinessReport[] = assets.map((asset) =>
    computeCommercialReadiness({
      asset,
      qualitySnapshot: latestSnapshotByAsset.get(asset.assetId) ?? null,
      submissionsForAsset: submissionsByAsset.get(asset.assetId) ?? [],
      siblingAssets: assets.filter((a) => a.assetId !== asset.assetId),
      now,
    }),
  );

  const collectionCompleteness: CollectionCompletenessReport[] = collections
    .filter((c) => !c.isArchived)
    .map((collection) => checkCollectionCompleteness(collection, assets.filter((a) => a.collectionIds.includes(collection.id))));

  return { assets, collections, readinessReports, collectionCompleteness, assetsById, collectionsById };
}
