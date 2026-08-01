import { describe, it, expect } from 'vitest';
import { buildExportReadinessDashboard } from './exportReadinessDashboard';
import { computeCommercialReadiness } from './readinessEngine';
import { createPortfolioAsset } from '../catalog/domain/asset';
import { createQualitySnapshot } from '../catalog/quality/qualitySnapshotStore';
import { createSubmissionRecord } from '../catalog/submission/submissionRecord';
import type { PortfolioAsset } from '../catalog/domain/types';

function makeAsset(overrides: Partial<PortfolioAsset> = {}): PortfolioAsset {
  const asset = createPortfolioAsset({
    displayName: 'Asset',
    originalFilename: 'a.svg',
    sourceFileReferences: [
      { fileId: 'f1', role: 'svg', filename: 'a.svg', mimeType: 'image/svg+xml', fileSize: 10, sha256: 'h' },
      { fileId: 'f2', role: 'eps', filename: 'a.eps', mimeType: 'application/postscript', fileSize: 10, sha256: 'h2' },
      { fileId: 'f3', role: 'json', filename: 'a.json', mimeType: 'application/json', fileSize: 10, sha256: 'h3' },
    ],
    previewReference: 'f1',
    metadataReference: 'f3',
    generatorVersion: 'v1.0',
    presetId: 'luxuryFloral',
  });
  return { ...asset, ...overrides };
}

describe('buildExportReadinessDashboard', () => {
  it('buckets every report into exactly one of the 7 named buckets, with every card explaining why', () => {
    const readyAsset = makeAsset({ collectionIds: ['c1'] });
    const readySnapshot = createQualitySnapshot({ assetId: readyAsset.assetId, beautyScore: 90, commercialScore: 90, fragmented: false, deadSpace: false, decision: 'READY', generatorVersion: 'v1.0' });
    const readySubmission = { ...createSubmissionRecord({ patternId: readyAsset.assetId, marketplaceId: 'etsy' }), titleSnapshot: 'Title', keywordSnapshot: ['a', 'b'] };
    const readyReport = computeCommercialReadiness({ asset: readyAsset, qualitySnapshot: readySnapshot, submissionsForAsset: [readySubmission], siblingAssets: [] });

    const noCollectionAsset = makeAsset({ collectionIds: [] });
    const noCollectionReport = computeCommercialReadiness({ asset: noCollectionAsset, qualitySnapshot: null, submissionsForAsset: [], siblingAssets: [] });

    const noArtworkAsset = makeAsset({ collectionIds: ['c1'], sourceFileReferences: [], generatorVersion: null });
    const noArtworkReport = computeCommercialReadiness({ asset: noArtworkAsset, qualitySnapshot: null, submissionsForAsset: [], siblingAssets: [] });

    const dashboard = buildExportReadinessDashboard([readyReport, noCollectionReport, noArtworkReport]);

    expect(dashboard.totalAssets).toBe(3);
    const ready = dashboard.buckets.find((b) => b.id === 'ready')!;
    expect(ready.assetIds).toEqual([readyAsset.assetId]);

    const needsCollection = dashboard.buckets.find((b) => b.id === 'needsCollection')!;
    expect(needsCollection.assetIds).toEqual([noCollectionAsset.assetId]);
    expect(needsCollection.explanation.length).toBeGreaterThan(0);

    const blocked = dashboard.buckets.find((b) => b.id === 'blocked')!;
    expect(blocked.assetIds).toEqual([noArtworkAsset.assetId]);

    for (const bucket of dashboard.buckets) {
      expect(bucket.explanation.length).toBeGreaterThan(0);
    }
  });

  it('reports an honest empty-state explanation for buckets with zero assets', () => {
    const dashboard = buildExportReadinessDashboard([]);
    expect(dashboard.totalAssets).toBe(0);
    for (const bucket of dashboard.buckets) {
      expect(bucket.count).toBe(0);
      expect(bucket.explanation).toContain('No assets');
    }
  });
});
