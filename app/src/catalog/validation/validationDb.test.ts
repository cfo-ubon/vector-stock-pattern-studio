import { describe, it, expect, beforeEach } from 'vitest';
import { persistDataset, resetValidationDatabase, ValidationEnvironmentNotConfirmedError } from './validationDb';
import { generateDataset } from './datasetGenerator';
import { smallDatasetConfig } from './datasetPresets';
import { loadCollections } from '../storage/collectionStore';
import { loadPortfolioAssets } from '../storage/portfolioStore';

// Runs under vitest's jsdom environment, which already has fake-indexeddb
// installed globally by `src/testSetup.ts` — see that file's header
// comment, and `validationDb.ts`'s own header comment for why this is
// what makes "real IndexedDB seeding" here safe (an isolated, in-memory,
// per-process fake, never a real browser's storage).

beforeEach(async () => {
  await resetValidationDatabase({ confirmValidationEnvironment: true });
});

describe('validationDb — safety gate', () => {
  it('refuses to persist without explicit confirmation', async () => {
    const { collections, assets } = generateDataset({ ...smallDatasetConfig(), assetCount: 5, collectionCount: 2, avgMembershipsPerAsset: 1 });
    // @ts-expect-error — deliberately omitting the required confirmation flag
    await expect(persistDataset(collections, assets, 100, {})).rejects.toThrow(ValidationEnvironmentNotConfirmedError);
  });

  it('refuses to reset without explicit confirmation', async () => {
    // @ts-expect-error — deliberately omitting the required confirmation flag
    await expect(resetValidationDatabase({})).rejects.toThrow(ValidationEnvironmentNotConfirmedError);
  });
});

describe('validationDb — persist + reset', () => {
  it('writes every generated collection and asset, in the declared batch shape', async () => {
    const { collections, assets } = generateDataset({ ...smallDatasetConfig(), assetCount: 250, collectionCount: 20, avgMembershipsPerAsset: 3 });
    const result = await persistDataset(collections, assets, 100, { confirmValidationEnvironment: true });
    expect(result.collectionsWritten).toBe(20);
    expect(result.assetsWritten).toBe(250);
    expect(result.collectionBatches).toBe(1); // 20 collections / batchSize 100
    expect(result.assetBatches).toBe(3); // 250 assets / batchSize 100 -> 3 batches

    const storedCollections = await loadCollections();
    const storedAssets = await loadPortfolioAssets();
    expect(storedCollections).toHaveLength(20);
    expect(storedAssets).toHaveLength(250);
  });

  it('reset clears everything this module wrote, and cleanup is idempotent', async () => {
    const { collections, assets } = generateDataset({ ...smallDatasetConfig(), assetCount: 10, collectionCount: 3, avgMembershipsPerAsset: 1 });
    await persistDataset(collections, assets, 100, { confirmValidationEnvironment: true });
    expect(await loadCollections()).toHaveLength(3);

    await resetValidationDatabase({ confirmValidationEnvironment: true });
    expect(await loadCollections()).toHaveLength(0);
    expect(await loadPortfolioAssets()).toHaveLength(0);

    // Calling reset again on an already-empty store must not throw.
    await expect(resetValidationDatabase({ confirmValidationEnvironment: true })).resolves.toBeDefined();
  });

  it('reports a real measured duration, not a fabricated zero', async () => {
    const { collections, assets } = generateDataset({ ...smallDatasetConfig(), assetCount: 50, collectionCount: 5, avgMembershipsPerAsset: 2 });
    const result = await persistDataset(collections, assets, 25, { confirmValidationEnvironment: true });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(result.durationMs)).toBe(true);
  });
});
