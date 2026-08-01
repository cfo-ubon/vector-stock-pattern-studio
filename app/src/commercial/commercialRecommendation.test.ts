import { describe, it, expect } from 'vitest';
import { generateCommercialRecommendations } from './commercialRecommendation';
import { computeCommercialReadiness } from './readinessEngine';
import { checkCollectionCompleteness } from './collectionCompleteness';
import { createCollection } from '../catalog/domain/collection';
import { createPortfolioAsset } from '../catalog/domain/asset';
import { createQualitySnapshot } from '../catalog/quality/qualitySnapshotStore';
import { createSubmissionRecord } from '../catalog/submission/submissionRecord';
import type { PortfolioAsset } from '../catalog/domain/types';

function makeAsset(name: string, overrides: Partial<PortfolioAsset> = {}): PortfolioAsset {
  const asset = createPortfolioAsset({
    displayName: name,
    originalFilename: 'a.svg',
    sourceFileReferences: [{ fileId: 'f1', role: 'svg', filename: 'a.svg', mimeType: 'image/svg+xml', fileSize: 10, sha256: 'h' }],
    previewReference: 'f1',
    metadataReference: null,
    generatorVersion: 'v1.0',
    presetId: 'luxuryFloral',
  });
  return { ...asset, ...overrides };
}

describe('generateCommercialRecommendations', () => {
  it('ranks a ready asset above a not-yet-ready one', () => {
    const readyAsset = makeAsset('Ready Pattern', {
      collectionIds: ['c1'],
      metadataReference: 'f3',
      sourceFileReferences: [
        { fileId: 'f1', role: 'svg', filename: 'a.svg', mimeType: 'image/svg+xml', fileSize: 10, sha256: 'h' },
        { fileId: 'f2', role: 'eps', filename: 'a.eps', mimeType: 'application/postscript', fileSize: 10, sha256: 'h2' },
        { fileId: 'f3', role: 'json', filename: 'a.json', mimeType: 'application/json', fileSize: 10, sha256: 'h3' },
      ],
    });
    const readySnapshot = createQualitySnapshot({ assetId: readyAsset.assetId, beautyScore: 92, commercialScore: 92, fragmented: false, deadSpace: false, decision: 'READY', generatorVersion: 'v1.0' });
    const readySubmission = { ...createSubmissionRecord({ patternId: readyAsset.assetId, marketplaceId: 'etsy' }), titleSnapshot: 'T', keywordSnapshot: ['a', 'b'] };
    const readyReport = computeCommercialReadiness({ asset: readyAsset, qualitySnapshot: readySnapshot, submissionsForAsset: [readySubmission], siblingAssets: [] });

    const needsSeoAsset = makeAsset('Needs SEO Pattern', { collectionIds: ['c1'] });
    const needsSeoSnapshot = createQualitySnapshot({ assetId: needsSeoAsset.assetId, beautyScore: 80, commercialScore: 80, fragmented: false, deadSpace: false, decision: 'READY', generatorVersion: 'v1.0' });
    const needsSeoReport = computeCommercialReadiness({ asset: needsSeoAsset, qualitySnapshot: needsSeoSnapshot, submissionsForAsset: [], siblingAssets: [] });

    const assetsById = new Map([
      [readyAsset.assetId, readyAsset],
      [needsSeoAsset.assetId, needsSeoAsset],
    ]);

    const recs = generateCommercialRecommendations({ reports: [needsSeoReport, readyReport], assetsById });
    expect(recs[0].action).toBe('exportReady');
    expect(recs[0].assetId).toBe(readyAsset.assetId);
    expect(recs.some((r) => r.action === 'finishSeo' && r.assetId === needsSeoAsset.assetId)).toBe(true);
  });

  it('never recommends anything for an asset with no artwork at all — no action is possible there', () => {
    const brokenAsset = makeAsset('No Artwork', { collectionIds: ['c1'], sourceFileReferences: [], generatorVersion: null });
    const report = computeCommercialReadiness({ asset: brokenAsset, qualitySnapshot: null, submissionsForAsset: [], siblingAssets: [] });
    const recs = generateCommercialRecommendations({ reports: [report], assetsById: new Map([[brokenAsset.assetId, brokenAsset]]) });
    expect(recs).toEqual([]);
  });

  it('recommends generateColorway when a collection completeness report is missing only that role', () => {
    const collection = createCollection({ name: 'Almost Full', now: 1000 });
    const roles = ['hero', 'secondary', 'blender', 'coordinate', 'stripe', 'texture'];
    const members = roles.map((role) => ({ ...makeAsset(role), tags: [role] }));
    const completeness = checkCollectionCompleteness(collection, members);

    const recs = generateCommercialRecommendations({ reports: [], assetsById: new Map(), collectionCompleteness: [completeness] });
    expect(recs).toHaveLength(1);
    expect(recs[0].action).toBe('generateColorway');
    expect(recs[0].collectionId).toBe(collection.id);
  });

  it('respects the limit parameter', () => {
    const assets = Array.from({ length: 10 }, (_, i) => makeAsset(`Pattern ${i}`, { collectionIds: [] }));
    const reports = assets.map((a) => computeCommercialReadiness({ asset: a, qualitySnapshot: null, submissionsForAsset: [], siblingAssets: [] }));
    const assetsById = new Map(assets.map((a) => [a.assetId, a]));
    const recs = generateCommercialRecommendations({ reports, assetsById, limit: 3 });
    expect(recs.length).toBeLessThanOrEqual(3);
  });
});
