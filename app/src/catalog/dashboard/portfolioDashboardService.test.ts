import { describe, it, expect, beforeEach } from 'vitest';
import { loadDashboardSnapshot } from './portfolioDashboardService';
import { clearCollectionsStore } from '../storage/collectionStore';
import { clearPortfolioStores, importAssetTransaction } from '../storage/portfolioStore';
import { createCollectionService, assignAssetsToCollections } from '../services/collectionService';
import { createPortfolioAsset } from '../domain/asset';
import { clearSubmissionStore } from '../submission/submissionStore';
import { createSubmission } from '../submission/submissionService';

beforeEach(async () => {
  await clearCollectionsStore();
  await clearPortfolioStores();
  clearSubmissionStore();
});

describe('loadDashboardSnapshot — real storage integration', () => {
  it('returns an empty-baseline snapshot for a fresh, empty portfolio', async () => {
    const snapshot = await loadDashboardSnapshot();
    expect(snapshot.portfolioHealth.overall).toBe(0);
    expect(snapshot.collectionAnalytics.collectionCount).toBe(0);
    expect(snapshot.submissionAnalytics.total).toBe(0);
    expect(snapshot.recommendations).toEqual([]);
  });

  it('reflects real Collections, real Portfolio assets, and real Submissions together', async () => {
    const collection = await createCollectionService({ name: 'Spring 2026' });
    const asset = createPortfolioAsset({ displayName: 'Floral', originalFilename: 'floral.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
    await importAssetTransaction(asset, []);
    await assignAssetsToCollections([asset.assetId], [collection.id]);
    createSubmission({ patternId: asset.assetId, marketplaceId: 'etsy', titleSnapshot: 'Floral Pattern' });

    const snapshot = await loadDashboardSnapshot();
    expect(snapshot.collectionAnalytics.collectionCount).toBe(1);
    expect(snapshot.collectionAnalytics.patternCount).toBe(1);
    expect(snapshot.readinessAnalytics.totalPatterns).toBe(1);
    expect(snapshot.submissionAnalytics.total).toBe(1);
    expect(snapshot.submissionAnalytics.draft).toBe(1);
    expect(snapshot.marketplaceAnalytics).toHaveLength(1);
  });

  it('never writes anything back to storage (read-only integration)', async () => {
    const collection = await createCollectionService({ name: 'Untouched' });
    const asset = createPortfolioAsset({ displayName: 'A', originalFilename: 'a.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
    await importAssetTransaction(asset, []);

    await loadDashboardSnapshot();
    await loadDashboardSnapshot(); // call it twice — if it mutated anything, a second call would see different state

    const { loadCollections } = await import('../storage/collectionStore');
    const { loadPortfolioAssets } = await import('../storage/portfolioStore');
    const { loadSubmissions } = await import('../submission/submissionStore');
    const collections = await loadCollections();
    const assets = await loadPortfolioAssets();
    expect(collections).toEqual([collection]);
    expect(assets.map((a) => a.assetId)).toEqual([asset.assetId]);
    expect(loadSubmissions()).toEqual([]);
  });
});
