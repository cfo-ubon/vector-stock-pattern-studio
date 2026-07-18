import { describe, it, expect, beforeEach, vi } from 'vitest';
import { File as NodeFile } from 'node:buffer';
import { generateBatchToPortfolio } from './batchProductionService';
import { clearPortfolioStores, loadPortfolioAssets } from '../catalog/storage/portfolioStore';
import { defaultParams } from '../engine/defaults';
import { STYLE_DNA_PRESETS } from '../engine/styleDna';
import type { GenerateParams } from '../engine/types';

// jsdom's own File (the global this test environment otherwise provides)
// isn't recognized by Node's `structuredClone` (used internally by
// fake-indexeddb) — see testSetup.ts's header comment and
// `catalog/import/importPipeline.test.ts`'s identical workaround. Unlike
// those tests, `batchProductionService.ts` constructs its own `File`
// objects internally (real generated SVG/JSON content, not caller-
// supplied), so the fix here is scoped to swapping the *global* `File`
// for Node's real one only for the duration of this file's tests —
// production code (running in a real browser) is unaffected, since a
// real browser's native File never has this bug.
beforeEach(() => {
  vi.stubGlobal('File', NodeFile);
});

beforeEach(async () => {
  await clearPortfolioStores();
});

function testParams(overrides: Partial<GenerateParams> = {}): GenerateParams {
  return { ...defaultParams(), seed: 'batch-test-seed', ...overrides };
}

// A real, shipped Style DNA preset — using one makes `buildVariantParams`
// take the fully-deterministic `resolveStyleDna(dna, seed)` branch
// instead of `randomizedParams(base)` (which reseeds from `Date.now()` /
// `Math.random()` internally and is therefore not reproducible across
// two separate calls) — needed for the exact/possible-duplicate tests
// below, which rely on two calls producing predictably identical or
// predictably different output.
const dna = Object.values(STYLE_DNA_PRESETS)[0];

describe('generateBatchToPortfolio', () => {
  it('returns an all-zero result for count 0 without touching storage', async () => {
    const result = await generateBatchToPortfolio({ count: 0, params: testParams(), existingAssets: [] });
    expect(result).toEqual({ items: [], generatedCount: 0, importedCount: 0, possibleDuplicateCount: 0, blockedDuplicateCount: 0, errorCount: 0, retryRate: 0, meanAttempts: 0 });
    expect(await loadPortfolioAssets()).toHaveLength(0);
  });

  it('generates and imports the requested count of distinct patterns into the Portfolio catalog', async () => {
    const result = await generateBatchToPortfolio({
      count: 5,
      params: testParams(),
      existingAssets: [],
      seedForItem: (i) => `seed-${i}`,
    });

    expect(result.generatedCount).toBe(5);
    expect(result.importedCount).toBe(5);
    expect(result.possibleDuplicateCount).toBe(0);
    expect(result.blockedDuplicateCount).toBe(0);
    expect(result.errorCount).toBe(0);

    const assets = await loadPortfolioAssets();
    expect(assets).toHaveLength(5);
    // Every imported asset carries the generator seed it was actually
    // built with — proves the JSON sidecar's `generateParams` shape was
    // correctly auto-detected by the existing, unmodified
    // `catalog/import/jsonCompat.ts` (no new metadata-extraction logic
    // was written for this build).
    const seeds = assets.map((a) => a.generatorSeed).sort();
    expect(seeds).toEqual(['seed-0', 'seed-1', 'seed-2', 'seed-3', 'seed-4']);
  });

  it('scales to a larger batch size (10) without any hardcoded-9 assumption', async () => {
    const result = await generateBatchToPortfolio({
      count: 10,
      params: testParams(),
      existingAssets: [],
      seedForItem: (i) => `scale-seed-${i}`,
    });
    expect(result.generatedCount).toBe(10);
    expect(result.importedCount).toBe(10);
    expect(await loadPortfolioAssets()).toHaveLength(10);
  });

  it('every item goes through the same quality-retry routing as the single-Generate button (buildTileForGenerate)', async () => {
    // Botanical items get `buildTileWithCommercialRetry`, everything
    // else gets `buildTileWithHeroRetry` — both already exist and are
    // exercised elsewhere; this just proves the batch service reaches
    // real, valid TileData for a botanical request (an empty/failed
    // generation would produce no SVG content at all).
    const result = await generateBatchToPortfolio({
      count: 2,
      params: testParams({ categoryId: 'botanical' }),
      existingAssets: [],
      seedForItem: (i) => `botanical-seed-${i}`,
    });
    expect(result.importedCount).toBe(2);
    for (const item of result.items) {
      expect(item.tileData.svg).toBeTruthy();
    }
  });

  it('Build 019: exposes real per-item attempts/regenerated and aggregate retryRate/meanAttempts from the retry gate', async () => {
    const result = await generateBatchToPortfolio({
      count: 8,
      params: testParams({ categoryId: 'botanical' }),
      existingAssets: [],
      seedForItem: (i) => `retry-visibility-${i}`,
    });
    expect(result.items).toHaveLength(8);
    for (const item of result.items) {
      expect(item.attempts).toBeGreaterThanOrEqual(1);
      expect(item.attempts).toBeLessThanOrEqual(3);
      expect(item.regenerated).toBe(item.attempts > 1);
    }
    const expectedRetryRate = Math.round((result.items.filter((it) => it.regenerated).length / result.items.length) * 10000) / 100;
    const expectedMeanAttempts = Math.round((result.items.reduce((a, it) => a + it.attempts, 0) / result.items.length) * 100) / 100;
    expect(result.retryRate).toBe(expectedRetryRate);
    expect(result.meanAttempts).toBe(expectedMeanAttempts);
  });

  it('detects an exact duplicate against the existing catalog and blocks it from being re-imported', async () => {
    const params = testParams();
    const first = await generateBatchToPortfolio({
      count: 1,
      params,
      activeDna: dna,
      existingAssets: [],
      seedForItem: () => 'duplicate-seed',
      diversityRngSeed: 'diversity-fixed',
    });
    expect(first.importedCount).toBe(1);
    const existingAssets = await loadPortfolioAssets();

    // Second call regenerates with the identical params/seed/Style DNA/
    // diversity RNG seed — every input `buildVariantParams` and the
    // diversity assignment depend on is reproduced exactly, so the
    // resulting SVG+JSON bytes are identical and the existing,
    // unmodified `catalog/import/duplicates.ts` exact-hash check fires.
    const second = await generateBatchToPortfolio({
      count: 1,
      params,
      activeDna: dna,
      existingAssets,
      seedForItem: () => 'duplicate-seed',
      diversityRngSeed: 'diversity-fixed',
    });
    expect(second.importedCount).toBe(0);
    expect(second.blockedDuplicateCount).toBe(1);
    expect(second.items[0].outcome.status).toBe('blockedDuplicate');

    // The blocked duplicate never landed a second copy in the catalog.
    expect(await loadPortfolioAssets()).toHaveLength(1);
  });

  it('flags a possible duplicate when the same generator seed produces structurally different output', async () => {
    const params = testParams();
    const first = await generateBatchToPortfolio({
      count: 1,
      params,
      activeDna: dna,
      existingAssets: [],
      seedForItem: () => 'shared-seed',
      diversityRngSeed: 'diversity-A',
    });
    expect(first.importedCount).toBe(1);
    const existingAssets = await loadPortfolioAssets();

    // Same generator seed, but a different diversity RNG seed drives a
    // different composition zone/botanical family/cluster/hierarchy/hero
    // silhouette draw — real, different SVG bytes (no exact hash match),
    // but the same `generatorSeed` metadata field, which is exactly the
    // "possible duplicate" signal `catalog/import/duplicates.ts` already
    // implements (unmodified here).
    const second = await generateBatchToPortfolio({
      count: 1,
      params,
      activeDna: dna,
      existingAssets,
      seedForItem: () => 'shared-seed',
      diversityRngSeed: 'diversity-B',
    });
    expect(second.importedCount).toBe(0);
    expect(second.possibleDuplicateCount).toBe(1);
    if (second.items[0].outcome.status === 'possibleDuplicate') {
      expect(second.items[0].outcome.matchedOn).toContain('generatorSeed');
    } else {
      throw new Error(`expected possibleDuplicate, got ${second.items[0].outcome.status}`);
    }
    expect(await loadPortfolioAssets()).toHaveLength(1);
  });
});
