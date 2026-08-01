import { describe, it, expect, beforeEach } from 'vitest';
import { loadCommercialPipelineContext } from './loadCommercialPipelineContext';
import { clearPortfolioStores, putPortfolioAsset } from '../catalog/storage/portfolioStore';
import { clearCollectionsStore, putCollectionRecord } from '../catalog/storage/collectionStore';
import { putQualitySnapshot, createQualitySnapshot } from '../catalog/quality/qualitySnapshotStore';
import { resetSubmissionStoreForTest, putSubmission } from '../catalog/submission/submissionStore';
import { createSubmissionRecord } from '../catalog/submission/submissionRecord';
import { createPortfolioAsset } from '../catalog/domain/asset';
import { createCollection } from '../catalog/domain/collection';

describe('loadCommercialPipelineContext', () => {
  beforeEach(async () => {
    await clearPortfolioStores();
    await clearCollectionsStore();
    await resetSubmissionStoreForTest();
  });

  it('loads real assets/collections and computes one readiness report per active asset', async () => {
    const collection = createCollection({ name: 'My Collection', now: 1000 });
    await putCollectionRecord(collection);

    const asset = { ...createPortfolioAsset({ displayName: 'A', originalFilename: 'a.svg', sourceFileReferences: [], previewReference: null, metadataReference: null }), collectionIds: [collection.id] };
    await putPortfolioAsset(asset);

    const archived = { ...createPortfolioAsset({ displayName: 'Archived', originalFilename: 'b.svg', sourceFileReferences: [], previewReference: null, metadataReference: null }), isArchived: true };
    await putPortfolioAsset(archived);

    const snapshot = createQualitySnapshot({ assetId: asset.assetId, beautyScore: 80, commercialScore: 80, fragmented: false, deadSpace: false, decision: 'READY', generatorVersion: 'v1.0' });
    await putQualitySnapshot(snapshot);

    const submission = createSubmissionRecord({ patternId: asset.assetId, marketplaceId: 'etsy' });
    putSubmission(submission);

    const context = await loadCommercialPipelineContext(5000);

    expect(context.assets).toHaveLength(1); // archived asset excluded
    expect(context.assets[0].assetId).toBe(asset.assetId);
    expect(context.readinessReports).toHaveLength(1);
    expect(context.readinessReports[0].assetId).toBe(asset.assetId);
    expect(context.collectionCompleteness).toHaveLength(1);
    expect(context.collectionCompleteness[0].collectionId).toBe(collection.id);
    expect(context.assetsById.get(asset.assetId)).toBeDefined();
  });

  it('returns empty results honestly when nothing is stored', async () => {
    const context = await loadCommercialPipelineContext(5000);
    expect(context.assets).toEqual([]);
    expect(context.readinessReports).toEqual([]);
    expect(context.collectionCompleteness).toEqual([]);
  });
});
