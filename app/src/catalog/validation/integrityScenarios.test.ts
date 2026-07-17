import { describe, it, expect, beforeEach } from 'vitest';
import { buildIntegrityScenario, allIntegrityScenarioNames, scanIntegrity, repairAll } from './integrityScenarios';
import { persistDataset, resetValidationDatabase } from './validationDb';
import { loadCollections } from '../storage/collectionStore';
import { loadPortfolioAssets } from '../storage/portfolioStore';

beforeEach(async () => {
  await resetValidationDatabase({ confirmValidationEnvironment: true });
});

async function seed(name: Parameters<typeof buildIntegrityScenario>[0]) {
  const scenario = buildIntegrityScenario(name);
  await persistDataset(scenario.collections, scenario.assets, 500, { confirmValidationEnvironment: true });
  return scenario;
}

describe('integrityScenarios — every named scenario builds and persists cleanly', () => {
  it.each(allIntegrityScenarioNames())('scenario "%s" generates and persists without error', async (name) => {
    const scenario = await seed(name);
    expect(scenario.collections.length).toBeGreaterThan(0);
    expect(scenario.assets.length).toBeGreaterThan(0);
    const stored = await loadCollections();
    expect(stored.length).toBe(scenario.collections.length);
  });

  it('same scenario name + seed is deterministic', () => {
    const a = buildIntegrityScenario('orphanedMembership', 'fixed-seed');
    const b = buildIntegrityScenario('orphanedMembership', 'fixed-seed');
    expect(a.assets.map((x) => x.collectionIds)).toEqual(b.assets.map((x) => x.collectionIds));
  });
});

describe('integrityScenarios — valid dataset', () => {
  it('scanner reports zero orphaned memberships and zero stale covers', async () => {
    await seed('valid');
    const report = await scanIntegrity();
    expect(report.orphanedMemberships).toHaveLength(0);
    expect(report.invalidCoverAssetReferences).toHaveLength(0);
  });

  it('a repair pass over valid data changes nothing', async () => {
    await seed('valid');
    const before = await loadPortfolioAssets();
    const { orphans, covers } = await repairAll();
    expect(orphans.changedCount).toBe(0);
    expect(covers.changedCount).toBe(0);
    const after = await loadPortfolioAssets();
    expect(after).toEqual(before);
  });
});

describe('integrityScenarios — orphaned membership', () => {
  it('scanner detects the injected orphaned memberships', async () => {
    await seed('orphanedMembership');
    const report = await scanIntegrity();
    expect(report.orphanedMemberships.length).toBeGreaterThan(0);
  });

  it('scanning is read-only — running it twice never changes stored data', async () => {
    await seed('orphanedMembership');
    await scanIntegrity();
    const afterFirstScan = await loadPortfolioAssets();
    await scanIntegrity();
    const afterSecondScan = await loadPortfolioAssets();
    expect(afterSecondScan).toEqual(afterFirstScan);
  });

  it('explicit repair removes every orphaned collection id', async () => {
    await seed('orphanedMembership');
    const before = await scanIntegrity();
    expect(before.orphanedMemberships.length).toBeGreaterThan(0);
    const result = await repairAll();
    expect(result.orphans.changedCount).toBe(before.orphanedMemberships.length);
    const after = await scanIntegrity();
    expect(after.orphanedMemberships).toHaveLength(0);
  });

  it('repair is idempotent — running it again is a no-op', async () => {
    await seed('orphanedMembership');
    await repairAll();
    const secondPass = await repairAll();
    expect(secondPass.orphans.changedCount).toBe(0);
    expect(secondPass.orphans.failedCount).toBe(0);
  });

  it('no asset or collection record is deleted by the repair', async () => {
    await seed('orphanedMembership');
    const assetsBefore = await loadPortfolioAssets();
    const collectionsBefore = await loadCollections();
    await repairAll();
    const assetsAfter = await loadPortfolioAssets();
    const collectionsAfter = await loadCollections();
    expect(assetsAfter).toHaveLength(assetsBefore.length);
    expect(collectionsAfter).toHaveLength(collectionsBefore.length);
  });
});

describe('integrityScenarios — stale cover', () => {
  it('scanner detects the injected stale cover references', async () => {
    await seed('staleCover');
    const report = await scanIntegrity();
    expect(report.invalidCoverAssetReferences.length).toBeGreaterThan(0);
  });

  it('explicit repair clears every stale cover to null', async () => {
    await seed('staleCover');
    const before = await scanIntegrity();
    expect(before.invalidCoverAssetReferences.length).toBeGreaterThan(0);
    const result = await repairAll();
    expect(result.covers.changedCount).toBe(before.invalidCoverAssetReferences.length);
    const after = await scanIntegrity();
    expect(after.invalidCoverAssetReferences).toHaveLength(0);
    const collections = await loadCollections();
    for (const id of before.invalidCoverAssetReferences.map((r) => r.collectionId)) {
      expect(collections.find((c) => c.id === id)?.coverAssetId).toBeNull();
    }
  });

  it('repair is idempotent', async () => {
    await seed('staleCover');
    await repairAll();
    const secondPass = await repairAll();
    expect(secondPass.covers.changedCount).toBe(0);
  });
});

describe('integrityScenarios — duplicate collectionId (documented non-detection)', () => {
  it('the condition is really present in the raw record (bypasses addCollectionMembership)', async () => {
    const scenario = buildIntegrityScenario('duplicateCollectionId');
    const hasDuplicate = scenario.assets.some((a) => new Set(a.collectionIds).size < a.collectionIds.length);
    expect(hasDuplicate).toBe(true);
  });

  it('scanning this dataset does not throw (current scanner has no duplicate-detection field to assert on — see Technical Debt Register)', async () => {
    await seed('duplicateCollectionId');
    await expect(scanIntegrity()).resolves.toBeDefined();
  });
});

describe('integrityScenarios — shape-only scenarios (not integrity violations)', () => {
  it('emptyCollection scenario really produces a collection with zero members', async () => {
    const scenario = await seed('emptyCollection');
    const memberCounts = new Map(scenario.collections.map((c) => [c.id, 0]));
    for (const asset of scenario.assets) {
      for (const id of asset.collectionIds) memberCounts.set(id, (memberCounts.get(id) ?? 0) + 1);
    }
    expect([...memberCounts.values()].some((n) => n === 0)).toBe(true);
  });

  it('archivedCollection scenario really produces an archived collection that keeps its members', async () => {
    const scenario = await seed('archivedCollection');
    const archived = scenario.collections.find((c) => c.isArchived);
    expect(archived).toBeDefined();
    const memberCount = scenario.assets.filter((a) => a.collectionIds.includes(archived!.id)).length;
    expect(memberCount).toBeGreaterThan(0);
  });

  it('highMembershipAsset scenario produces one asset with unusually many memberships', async () => {
    const scenario = await seed('highMembershipAsset');
    // Base scenario config targets an avg of 2 memberships/asset; the
    // high-membership fixture boosts asset 0 to join every assignable
    // collection in the pool instead.
    expect(scenario.assets[0].collectionIds.length).toBeGreaterThan(2);
    expect(scenario.assets[0].collectionIds.length).toBe(scenario.collections.length);
  });

  it('highMemberCollection scenario produces one collection with unusually many members', async () => {
    const scenario = await seed('highMemberCollection');
    const bigCollectionId = scenario.collections[0].id;
    const memberCount = scenario.assets.filter((a) => a.collectionIds.includes(bigCollectionId)).length;
    expect(memberCount).toBeGreaterThan(SCENARIO_BASE_ASSET_COUNT_FOR_TEST() / 2);
  });
});

function SCENARIO_BASE_ASSET_COUNT_FOR_TEST(): number {
  return 30; // mirrors integrityScenarios.ts's SCENARIO_BASE_ASSET_COUNT (not exported — kept local to this test)
}
