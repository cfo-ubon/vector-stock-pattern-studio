import { describe, it, expect } from 'vitest';
import { buildReviewWorkspaceItems, countReviewWaiting, latestQualitySnapshotsByAsset } from './reviewWorkspace';
import { createPortfolioAsset } from '../catalog/domain/asset';
import { createQualitySnapshot } from '../catalog/quality/qualitySnapshotStore';
import type { PortfolioAsset } from '../catalog/domain/types';

function makeAsset(overrides: Partial<Parameters<typeof createPortfolioAsset>[0]> = {}): PortfolioAsset {
  return createPortfolioAsset({
    displayName: 'Test Asset',
    originalFilename: 'test.svg',
    sourceFileReferences: [],
    previewReference: null,
    metadataReference: null,
    ...overrides,
  });
}

describe('latestQualitySnapshotsByAsset', () => {
  it('keeps the real latest snapshot per asset by createdAt, never an earlier one', () => {
    const older = createQualitySnapshot({ assetId: 'A-1', beautyScore: 50, commercialScore: 50, fragmented: false, deadSpace: false, decision: 'REVIEW', generatorVersion: 'v1', now: 1000 });
    const newer = createQualitySnapshot({ assetId: 'A-1', beautyScore: 90, commercialScore: 90, fragmented: false, deadSpace: false, decision: 'READY', generatorVersion: 'v1', now: 2000 });
    const map = latestQualitySnapshotsByAsset([older, newer]);
    expect(map.get('A-1')).toBe(newer);
  });
});

describe('buildReviewWorkspaceItems / countReviewWaiting', () => {
  it('includes only assets whose latest real snapshot decision is REVIEW', () => {
    const readyAsset = makeAsset({ displayName: 'Ready one' });
    const reviewAsset = makeAsset({ displayName: 'Review one' });
    const noSnapshotAsset = makeAsset({ displayName: 'No snapshot' });
    const readySnapshot = createQualitySnapshot({ assetId: readyAsset.assetId, beautyScore: 90, commercialScore: 90, fragmented: false, deadSpace: false, decision: 'READY', generatorVersion: 'v1', now: 1000 });
    const reviewSnapshot = createQualitySnapshot({ assetId: reviewAsset.assetId, beautyScore: 60, commercialScore: 60, fragmented: false, deadSpace: false, decision: 'REVIEW', generatorVersion: 'v1', now: 1000 });

    const items = buildReviewWorkspaceItems([readyAsset, reviewAsset, noSnapshotAsset], [readySnapshot, reviewSnapshot]);
    expect(items).toHaveLength(1);
    expect(items[0].asset.assetId).toBe(reviewAsset.assetId);
    expect(items[0].snapshot).toBe(reviewSnapshot);
    expect(countReviewWaiting([readyAsset, reviewAsset, noSnapshotAsset], [readySnapshot, reviewSnapshot])).toBe(1);
  });

  it('reclassifies honestly — an asset that moved from REVIEW to READY via a newer snapshot is excluded', () => {
    const asset = makeAsset();
    const oldReview = createQualitySnapshot({ assetId: asset.assetId, beautyScore: 60, commercialScore: 60, fragmented: false, deadSpace: false, decision: 'REVIEW', generatorVersion: 'v1', now: 1000 });
    const newReady = createQualitySnapshot({ assetId: asset.assetId, beautyScore: 90, commercialScore: 90, fragmented: false, deadSpace: false, decision: 'READY', generatorVersion: 'v2', now: 2000 });
    expect(countReviewWaiting([asset], [oldReview, newReady])).toBe(0);
  });

  it('never includes an archived asset even if its latest snapshot is REVIEW', () => {
    const asset = { ...makeAsset(), isArchived: true };
    const snapshot = createQualitySnapshot({ assetId: asset.assetId, beautyScore: 60, commercialScore: 60, fragmented: false, deadSpace: false, decision: 'REVIEW', generatorVersion: 'v1', now: 1000 });
    expect(countReviewWaiting([asset], [snapshot])).toBe(0);
  });
});
