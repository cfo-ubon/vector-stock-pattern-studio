import { describe, it, expect, beforeEach } from 'vitest';
import { installFailureInjector, runRecoveryScenario, ALL_FAILURE_INJECTION_POINTS } from './recoveryEngine';
import type { FailureInjectionConfig } from './recoveryEngine';
import { captureConsistencySnapshot } from './consistencyManifest';
import { generateDataset } from './datasetGenerator';
import { smallDatasetConfig } from './datasetPresets';
import { persistDataset, resetValidationDatabase } from './validationDb';
import {
  createCollectionService,
  renameCollection,
  archiveCollection,
  assignAssetsToCollections,
  removeAssetsFromCollections,
  validateCollectionIntegrity,
  getAssetsForCollection,
} from '../services/collectionService';
import { loadCollections } from '../storage/collectionStore';
import { loadPortfolioAssets } from '../storage/portfolioStore';

beforeEach(async () => {
  await resetValidationDatabase({ confirmValidationEnvironment: true });
});

async function seed(assetCount: number, collectionCount: number) {
  const { collections, assets } = generateDataset({
    ...smallDatasetConfig(),
    assetCount,
    collectionCount,
    // Zero pre-existing memberships — every test below assigns/removes
    // membership explicitly and asserts on the real resulting put/skip
    // counts, which only works if assets don't already happen to belong
    // to the target collection from the generator's own random seeding.
    avgMembershipsPerAsset: 0,
    emptyCollectionRatio: 0,
    archivedCollectionRatio: 0,
    collectionCoverRatio: 0,
    staleCoverRatio: 0,
    orphanedCollectionIdRatio: 0,
    duplicateCollectionIdRatio: 0,
    // Off by default in `DEFAULT_DATASET_CONFIG` — pre-assigns asset 0
    // (and up to 500 assets) into `collections[0]`, which would silently
    // turn every assign-to-`collections[0]` scenario below into a no-op
    // "skip" instead of a real write.
    includeHighMembershipFixtures: false,
  });
  await persistDataset(collections, assets, 500, { confirmValidationEnvironment: true });
  return { collections, assets };
}

const deps = { captureSnapshot: captureConsistencySnapshot, scanIntegrity: validateCollectionIntegrity };

describe('ALL_FAILURE_INJECTION_POINTS', () => {
  it('lists exactly the 9 required points', () => {
    expect(ALL_FAILURE_INJECTION_POINTS).toHaveLength(9);
    expect(new Set(ALL_FAILURE_INJECTION_POINTS).size).toBe(9);
  });
});

describe('installFailureInjector', () => {
  it('before-transaction: prevents any write from reaching the store', async () => {
    const injector = installFailureInjector({ point: 'before-transaction', store: 'collections', triggerOnCall: 1 });
    try {
      await expect(createCollectionService({ name: 'never-created' })).rejects.toThrow();
    } finally {
      injector.uninstall();
    }
    expect(injector.triggered).toBe(true);
    const all = await loadCollections();
    expect(all.find((c) => c.name === 'never-created')).toBeUndefined();
  });

  it('during-transaction: aborts a bulk write after N puts, leaving zero partial writes', async () => {
    const { assets, collections } = await seed(5, 2);
    const targetCollectionId = collections[0].id;
    const injector = installFailureInjector({ point: 'during-transaction', store: 'portfolioAssets', triggerOnCall: 2 });
    try {
      await expect(assignAssetsToCollections(assets.slice(0, 4).map((a) => a.assetId), [targetCollectionId])).rejects.toThrow();
    } finally {
      injector.uninstall();
    }
    expect(injector.triggered).toBe(true);
    // IndexedDB transaction atomicity: either all 4 puts landed or none did.
    const members = await getAssetsForCollection(targetCollectionId);
    expect(members.length === 0 || members.length === 4).toBe(true);
  });

  it('aborted-transaction: explicit abort also leaves zero partial writes', async () => {
    const { assets, collections } = await seed(5, 2);
    const targetCollectionId = collections[0].id;
    const injector = installFailureInjector({ point: 'aborted-transaction', store: 'portfolioAssets', triggerOnCall: 2 });
    try {
      await expect(assignAssetsToCollections(assets.slice(0, 4).map((a) => a.assetId), [targetCollectionId])).rejects.toThrow();
    } finally {
      injector.uninstall();
    }
    expect(injector.triggered).toBe(true);
    const members = await getAssetsForCollection(targetCollectionId);
    expect(members.length === 0 || members.length === 4).toBe(true);
  });

  it('before-ui-refresh: fails one getAll call, a subsequent un-injected read succeeds', async () => {
    await seed(3, 1);
    const injector = installFailureInjector({ point: 'before-ui-refresh', store: 'collections', triggerOnCall: 1 });
    try {
      await expect(loadCollections()).rejects.toThrow();
    } finally {
      injector.uninstall();
    }
    expect(injector.triggered).toBe(true);
    const retried = await loadCollections();
    expect(retried.length).toBe(1);
  });

  it('reports injected: false when triggerOnCall is never reached', async () => {
    await seed(1, 1);
    const injector = installFailureInjector({ point: 'during-transaction', store: 'portfolioAssets', triggerOnCall: 9999 });
    try {
      await assignAssetsToCollections([], []);
    } finally {
      injector.uninstall();
    }
    expect(injector.triggered).toBe(false);
  });

  it('uninstall always restores the original prototype method', async () => {
    const origPut = IDBObjectStore.prototype.put;
    const injector = installFailureInjector({ point: 'during-transaction', store: 'collections', triggerOnCall: 1 });
    expect(IDBObjectStore.prototype.put).not.toBe(origPut);
    injector.uninstall();
    expect(IDBObjectStore.prototype.put).toBe(origPut);
  });
});

describe('runRecoveryScenario', () => {
  it('createCollection: before-transaction failure recovers cleanly via retry', async () => {
    await seed(2, 1);
    const config: FailureInjectionConfig = { point: 'before-transaction', store: 'collections', triggerOnCall: 1 };
    const result = await runRecoveryScenario(
      {
        operationName: 'createCollection',
        config,
        run: () => createCollectionService({ name: 'recovery-target' }),
        retry: () => createCollectionService({ name: 'recovery-target' }),
      },
      deps,
    );
    expect(result.injected).toBe(true);
    expect(result.operationOutcome).toBe('failed-as-expected');
    expect(result.retryOutcome).toBe('succeeded');
    expect(result.afterRecovery.collectionCount).toBe(result.before.collectionCount + 1);
    expect(result.afterFailure.collectionCount).toBe(result.before.collectionCount);
  });

  it('bulkAssign: during-transaction failure recovers with correct final membership count', async () => {
    const { assets, collections } = await seed(6, 2);
    const targetId = collections[0].id;
    const targets = assets.slice(0, 4).map((a) => a.assetId);
    const config: FailureInjectionConfig = { point: 'during-transaction', store: 'portfolioAssets', triggerOnCall: 3 };
    const result = await runRecoveryScenario(
      {
        operationName: 'bulkAssign',
        config,
        run: () => assignAssetsToCollections(targets, [targetId]),
        retry: () => assignAssetsToCollections(targets, [targetId]),
      },
      deps,
    );
    expect(result.injected).toBe(true);
    expect(result.retryOutcome).toBe('succeeded');
    const members = await getAssetsForCollection(targetId);
    expect(members.length).toBe(4);
    expect(result.integrityAfterRecovery.orphanedMemberships).toHaveLength(0);
  });

  it('renameCollection: after-commit failure — data already correct, no rollback expected', async () => {
    const { collections } = await seed(2, 2);
    const target = collections[0];
    const config: FailureInjectionConfig = { point: 'after-commit', store: 'collections', triggerOnCall: 1 };
    const result = await runRecoveryScenario(
      {
        operationName: 'renameCollection',
        config,
        run: () => renameCollection(target.id, 'renamed-after-commit'),
        retry: async () => {
          const all = await loadCollections();
          return all.find((c) => c.id === target.id);
        },
      },
      deps,
    );
    expect(result.injected).toBe(true);
    expect(result.operationOutcome).toBe('failed-as-expected');
    const all = await loadCollections();
    expect(all.find((c) => c.id === target.id)?.name).toBe('renamed-after-commit');
  });

  it('archiveCollection: thrown-exception before invocation — nothing happens, retry succeeds', async () => {
    const { collections } = await seed(1, 1);
    const target = collections[0];
    const config: FailureInjectionConfig = { point: 'thrown-exception', store: 'collections', triggerOnCall: 1 };
    const result = await runRecoveryScenario(
      {
        operationName: 'archiveCollection',
        config,
        run: () => archiveCollection(target.id),
        retry: () => archiveCollection(target.id),
      },
      deps,
    );
    expect(result.operationOutcome).toBe('failed-as-expected');
    expect(result.afterFailure.collectionCount).toBe(result.before.collectionCount);
    expect(result.retryOutcome).toBe('succeeded');
    const all = await loadCollections();
    expect(all.find((c) => c.id === target.id)?.isArchived).toBe(true);
  });

  it('bulkRemove: rejected-promise races a caller-side rejection without corrupting the real write', async () => {
    const { assets, collections } = await seed(4, 1);
    const targetId = collections[0].id;
    const targets = assets.slice(0, 3).map((a) => a.assetId);
    await assignAssetsToCollections(targets, [targetId]);
    const config: FailureInjectionConfig = { point: 'rejected-promise', store: 'portfolioAssets', triggerOnCall: 1 };
    const result = await runRecoveryScenario(
      {
        operationName: 'bulkRemove',
        config,
        run: () => removeAssetsFromCollections(targets, [targetId]),
        retry: () => removeAssetsFromCollections(targets, [targetId]),
      },
      deps,
    );
    expect(result.injected).toBe(true);
    // Whichever way the race resolved, a final clean state has 0 members
    // (retry is idempotent — removing an already-removed membership is a no-op).
    const members = await getAssetsForCollection(targetId);
    expect(members.length).toBe(0);
    expect(result.integrityAfterRecovery.orphanedMemberships).toHaveLength(0);
  });

  it('validation-interruption: an interrupted scan has no side effects; a clean re-scan is correct', async () => {
    await seed(5, 3);
    const config: FailureInjectionConfig = { point: 'validation-interruption', store: 'collections', triggerOnCall: 1 };
    const injector = installFailureInjector(config);
    let interruptedFailed = false;
    try {
      await validateCollectionIntegrity();
    } catch {
      interruptedFailed = true;
    } finally {
      injector.uninstall();
    }
    expect(interruptedFailed).toBe(true);
    const cleanReport = await validateCollectionIntegrity();
    expect(cleanReport.totalCollections).toBe(3);
    expect(cleanReport.totalAssets).toBe(5);
  });

  it('never leaves a monkey-patched IndexedDB prototype installed after a scenario completes', async () => {
    const origPut = IDBObjectStore.prototype.put;
    const origGetAll = IDBObjectStore.prototype.getAll;
    const origTransaction = IDBDatabase.prototype.transaction;
    await seed(1, 1);
    await runRecoveryScenario(
      {
        operationName: 'createCollection',
        config: { point: 'during-transaction', store: 'collections', triggerOnCall: 1 },
        run: () => createCollectionService({ name: 'cleanup-check' }),
        retry: () => createCollectionService({ name: 'cleanup-check-2' }),
      },
      deps,
    );
    expect(IDBObjectStore.prototype.put).toBe(origPut);
    expect(IDBObjectStore.prototype.getAll).toBe(origGetAll);
    expect(IDBDatabase.prototype.transaction).toBe(origTransaction);
  });
});

describe('idempotent retry semantics', () => {
  it('repeating the same recovery action twice more produces no further state change', async () => {
    const { assets, collections } = await seed(3, 1);
    const targetId = collections[0].id;
    const targets = assets.map((a) => a.assetId);
    await assignAssetsToCollections(targets, [targetId]);
    const before = await captureConsistencySnapshot();
    await assignAssetsToCollections(targets, [targetId]);
    await assignAssetsToCollections(targets, [targetId]);
    const after = await captureConsistencySnapshot();
    // `capturedAt` legitimately differs between two real snapshot calls —
    // compare every other field instead of the whole object.
    expect({ ...after, capturedAt: 0 }).toEqual({ ...before, capturedAt: 0 });
    const members = await getAssetsForCollection(targetId);
    expect(members.length).toBe(3);
    const allAssets = await loadPortfolioAssets();
    for (const a of allAssets) {
      if (a.collectionIds.includes(targetId)) {
        expect(a.collectionIds.filter((id) => id === targetId)).toHaveLength(1);
      }
    }
  });
});
