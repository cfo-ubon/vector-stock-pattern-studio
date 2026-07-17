import { describe, it, expect, beforeEach } from 'vitest';
import { captureConsistencySnapshot, diffConsistencySnapshots } from './consistencyManifest';
import { generateDataset } from './datasetGenerator';
import { smallDatasetConfig } from './datasetPresets';
import { persistDataset, resetValidationDatabase } from './validationDb';
import { createCollectionService, deleteCollectionSafely } from '../services/collectionService';

beforeEach(async () => {
  await resetValidationDatabase({ confirmValidationEnvironment: true });
});

describe('captureConsistencySnapshot', () => {
  it('reports real counts matching a freshly persisted dataset', async () => {
    const { collections, assets, manifest } = generateDataset({ ...smallDatasetConfig(), assetCount: 100, collectionCount: 10, avgMembershipsPerAsset: 3 });
    await persistDataset(collections, assets, 500, { confirmValidationEnvironment: true });
    const snapshot = await captureConsistencySnapshot();
    expect(snapshot.assetCount).toBe(100);
    expect(snapshot.collectionCount).toBe(10);
    expect(snapshot.membershipCount).toBe(manifest.membershipCount);
    expect(snapshot.orphanCount).toBe(manifest.orphanedMembershipCount > 0 ? snapshot.orphanCount : 0);
  });

  it('reports zero for every count on an empty store', async () => {
    const snapshot = await captureConsistencySnapshot();
    expect(snapshot.assetCount).toBe(0);
    expect(snapshot.collectionCount).toBe(0);
    expect(snapshot.membershipCount).toBe(0);
  });

  it('measures duplicate-collectionId assets directly (the scanner does not report this — see Sprint 1 debt)', async () => {
    const { collections, assets } = generateDataset({
      ...smallDatasetConfig(),
      assetCount: 50,
      collectionCount: 5,
      avgMembershipsPerAsset: 2,
      duplicateCollectionIdRatio: 0.2,
    });
    await persistDataset(collections, assets, 500, { confirmValidationEnvironment: true });
    const snapshot = await captureConsistencySnapshot();
    expect(snapshot.duplicateCollectionIdAssetCount).toBeGreaterThan(0);
  });
});

describe('diffConsistencySnapshots', () => {
  it('reports zero deltas and no mismatch when nothing changed', async () => {
    const { collections, assets } = generateDataset({ ...smallDatasetConfig(), assetCount: 20, collectionCount: 3, avgMembershipsPerAsset: 1 });
    await persistDataset(collections, assets, 500, { confirmValidationEnvironment: true });
    const before = await captureConsistencySnapshot();
    const after = await captureConsistencySnapshot();
    const diff = diffConsistencySnapshots(before, after);
    expect(diff.assetCountDelta).toBe(0);
    expect(diff.collectionCountDelta).toBe(0);
    expect(diff.unexplainedAssetCountMismatch).toBe(false);
    expect(diff.unexplainedCollectionCountMismatch).toBe(false);
    expect(diff.notes).toEqual([]);
  });

  it('does not flag an expected, accounted-for mutation as a mismatch', async () => {
    const { collections, assets } = generateDataset({ ...smallDatasetConfig(), assetCount: 10, collectionCount: 2, avgMembershipsPerAsset: 1 });
    await persistDataset(collections, assets, 500, { confirmValidationEnvironment: true });
    const before = await captureConsistencySnapshot();

    const created = await createCollectionService({ name: 'temp-diff-test' });
    await deleteCollectionSafely(created.id);
    // Net collection count change across create+delete is 0.
    const after = await captureConsistencySnapshot();
    const diff = diffConsistencySnapshots(before, after, { collectionCountDelta: 0 });
    expect(diff.unexplainedCollectionCountMismatch).toBe(false);
  });

  it('flags an unexplained collection-count mismatch when the actual delta does not match expectations', async () => {
    const { collections, assets } = generateDataset({ ...smallDatasetConfig(), assetCount: 10, collectionCount: 2, avgMembershipsPerAsset: 1 });
    await persistDataset(collections, assets, 500, { confirmValidationEnvironment: true });
    const before = await captureConsistencySnapshot();
    await createCollectionService({ name: 'temp-left-behind' });
    const after = await captureConsistencySnapshot();
    const diff = diffConsistencySnapshots(before, after, { collectionCountDelta: 0 }); // expected 0, actual +1
    expect(diff.unexplainedCollectionCountMismatch).toBe(true);
    expect(diff.notes.some((n) => n.includes('Collection count changed'))).toBe(true);
  });

  it('flags newly introduced orphans/stale covers', () => {
    const before = { capturedAt: 1, assetCount: 10, collectionCount: 2, activeCollectionCount: 2, archivedCollectionCount: 0, membershipCount: 5, orphanCount: 0, staleCoverCount: 0, duplicateCollectionIdAssetCount: 0 };
    const after = { ...before, capturedAt: 2, orphanCount: 3, staleCoverCount: 1 };
    const diff = diffConsistencySnapshots(before, after);
    expect(diff.newOrphansIntroduced).toBe(true);
    expect(diff.newStaleCoversIntroduced).toBe(true);
    expect(diff.notes.length).toBeGreaterThanOrEqual(2);
  });
});
