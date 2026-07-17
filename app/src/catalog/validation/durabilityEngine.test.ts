import { describe, it, expect, beforeEach } from 'vitest';
import { runDurabilityCycles, verifyIdempotentRecovery } from './durabilityEngine';
import type { FailureInjectionConfig } from './recoveryEngine';
import { captureConsistencySnapshot } from './consistencyManifest';
import type { ConsistencySnapshot } from './consistencyManifest';
import { generateDataset } from './datasetGenerator';
import { smallDatasetConfig } from './datasetPresets';
import { persistDataset, resetValidationDatabase } from './validationDb';
import {
  archiveCollection,
  assignAssetsToCollections,
  validateCollectionIntegrity,
  getAssetsForCollection,
} from '../services/collectionService';
import type { CollectionIntegrityReport } from '../services/collectionService';
import { loadCollections } from '../storage/collectionStore';

beforeEach(async () => {
  await resetValidationDatabase({ confirmValidationEnvironment: true });
});

async function seed(assetCount: number, collectionCount: number) {
  const { collections, assets } = generateDataset({
    ...smallDatasetConfig(),
    assetCount,
    collectionCount,
    avgMembershipsPerAsset: 0,
    emptyCollectionRatio: 0,
    archivedCollectionRatio: 0,
    collectionCoverRatio: 0,
    staleCoverRatio: 0,
    orphanedCollectionIdRatio: 0,
    duplicateCollectionIdRatio: 0,
    includeHighMembershipFixtures: false,
  });
  await persistDataset(collections, assets, 500, { confirmValidationEnvironment: true });
  return { collections, assets };
}

const isClean = (report: CollectionIntegrityReport) =>
  report.orphanedMemberships.length === 0 && report.invalidCoverAssetReferences.length === 0;

const deps = { captureSnapshot: captureConsistencySnapshot, scanIntegrity: validateCollectionIntegrity, isClean };

const snapshotsEqual = (a: ConsistencySnapshot, b: ConsistencySnapshot) =>
  JSON.stringify({ ...a, capturedAt: 0 }) === JSON.stringify({ ...b, capturedAt: 0 });

describe('runDurabilityCycles', () => {
  it('runs the requested number of cycles and reports durable+clean for a fully-recoverable operation', async () => {
    const { collections } = await seed(1, 1);
    const targetId = collections[0].id;
    const report = await runDurabilityCycles(
      () => {
        const config: FailureInjectionConfig = { point: 'during-transaction', store: 'collections', triggerOnCall: 1 };
        return {
          operationName: 'archiveCollection',
          config,
          // archive/un-injected-retry is naturally idempotent — re-archiving
          // an already-archived collection is a clean no-op via
          // `archiveCollection`'s own guard.
          run: () => archiveCollection(targetId),
          retry: () => archiveCollection(targetId),
        };
      },
      deps,
      10,
    );
    expect(report.cyclesRequested).toBe(10);
    expect(report.cycles).toHaveLength(10);
    expect(report.allDurable).toBe(true);
    expect(report.allClean).toBe(true);
    expect(report.firstFailureCycle).toBeNull();
    const all = await loadCollections();
    expect(all.find((c) => c.id === targetId)?.isArchived).toBe(true);
  });

  it('does not accumulate corruption across 100 repeated bulk-assign recovery cycles', async () => {
    const { assets, collections } = await seed(6, 2);
    const targetId = collections[0].id;
    const targets = assets.slice(0, 4).map((a) => a.assetId);
    const report = await runDurabilityCycles(
      () => {
        const config: FailureInjectionConfig = { point: 'during-transaction', store: 'portfolioAssets', triggerOnCall: 2 };
        return {
          operationName: 'bulkAssign',
          config,
          run: () => assignAssetsToCollections(targets, [targetId]),
          retry: () => assignAssetsToCollections(targets, [targetId]),
        };
      },
      deps,
      100,
    );
    expect(report.cyclesRequested).toBe(100);
    expect(report.allDurable).toBe(true);
    expect(report.allClean).toBe(true);
    expect(report.firstFailureCycle).toBeNull();
    // Idempotent membership: 100 repeated inject-then-retry cycles never
    // grow the membership count beyond the 4 real targets.
    const members = await getAssetsForCollection(targetId);
    expect(members.length).toBe(4);
    expect(report.finalIntegrity.orphanedMemberships).toHaveLength(0);
  });

  it('rejects a cycles count below 1', async () => {
    await seed(1, 1);
    await expect(
      runDurabilityCycles(
        () => ({
          operationName: 'noop',
          config: { point: 'thrown-exception', store: 'collections', triggerOnCall: 1 },
          run: () => Promise.resolve(),
          retry: () => Promise.resolve(),
        }),
        deps,
        0,
      ),
    ).rejects.toThrow();
  });
});

describe('verifyIdempotentRecovery', () => {
  it('reports stable when repeated recovery produces no further state change', async () => {
    const { assets, collections } = await seed(3, 1);
    const targetId = collections[0].id;
    const targets = assets.map((a) => a.assetId);
    await assignAssetsToCollections(targets, [targetId]);
    const result = await verifyIdempotentRecovery(
      async () => { await assignAssetsToCollections(targets, [targetId]); },
      captureConsistencySnapshot,
      snapshotsEqual,
      5,
    );
    expect(result.repeats).toBe(5);
    expect(result.stable).toBe(true);
    expect(result.firstDivergenceIndex).toBeNull();
    expect(result.snapshots).toHaveLength(5);
    const members = await getAssetsForCollection(targetId);
    expect(members.length).toBe(3);
  });

  it('reports the first divergence index when state genuinely keeps changing', async () => {
    let n = 0;
    const fakeSnapshot = async () => ({ n: n++ }) as unknown as ConsistencySnapshot;
    const result = await verifyIdempotentRecovery(
      () => Promise.resolve(),
      fakeSnapshot,
      (a, b) => JSON.stringify(a) === JSON.stringify(b),
      4,
    );
    expect(result.stable).toBe(false);
    expect(result.firstDivergenceIndex).toBe(1);
  });

  it('rejects a repeats count below 1', async () => {
    await expect(
      verifyIdempotentRecovery(() => Promise.resolve(), captureConsistencySnapshot, snapshotsEqual, 0),
    ).rejects.toThrow();
  });
});
