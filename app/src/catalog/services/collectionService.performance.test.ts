import { describe, it, expect, beforeEach } from 'vitest';
import { createCollection } from '../domain/collection';
import { createPortfolioAsset } from '../domain/asset';
import type { Collection } from '../domain/collection';
import type { PortfolioAsset } from '../domain/types';
import { clearCollectionsStore, loadCollections, putCollectionRecordsBulk } from '../storage/collectionStore';
import { clearPortfolioStores, putPortfolioAssetsBulk } from '../storage/portfolioStore';
import {
  createCollectionService,
  assignAssetsToCollections,
  removeAssetsFromCollections,
  getAssetsForCollection,
  validateCollectionIntegrity,
} from './collectionService';

// Portfolio Manager P2 Stage 1, Section 8 (Performance Targets). Fixtures
// are seeded directly via the bulk storage primitives
// (`putPortfolioAssetsBulk`/`putCollectionRecordsBulk`), not through the
// import pipeline or one-at-a-time service calls — generating 20,000
// assets through `importAssetTransaction` (one IndexedDB transaction
// each) would measure transaction overhead, not the collection-service
// operations this suite targets. This mirrors the same fixture-generation
// convention `catalog/domain/search.performance.test.ts` (P1) already
// established for its own 1,200-record fixture.
//
// Asset/collection IDs are assigned deterministically (not via
// `generateAssetId`/`generateCollectionId`'s `Math.random` suffix) to
// guarantee uniqueness across a 20,000-record fixture — the real ID
// generators' collision odds are negligible for normal import volumes
// but not for a from-scratch 20k-record synthetic batch generated in a
// tight loop.

function makeAsset(i: number, collectionIds: string[] = []): PortfolioAsset {
  const asset = createPortfolioAsset({
    displayName: `Perf Asset ${i}`,
    originalFilename: `perf-${i}.svg`,
    sourceFileReferences: [],
    previewReference: null,
    metadataReference: null,
  });
  return { ...asset, assetId: `VSP-20260101-${i.toString(36).padStart(6, '0').toUpperCase()}`, collectionIds };
}

function makeCollection(i: number): Collection {
  const c = createCollection({ name: `Perf Collection ${i}`, now: 1700000000000 });
  return { ...c, id: `COL-20260101-${i.toString(36).padStart(6, '0').toUpperCase()}`, normalizedName: `perf collection ${i}` };
}

beforeEach(async () => {
  await clearCollectionsStore();
  await clearPortfolioStores();
});

describe('P2 Stage 1 performance — collections (100-collection scale)', () => {
  it('create/read/update stay responsive at 100 collections', async () => {
    const createStart = performance.now();
    for (let i = 0; i < 100; i++) {
      await createCollectionService({ name: `Responsive Collection ${i}` });
    }
    const createElapsed = performance.now() - createStart;
    // eslint-disable-next-line no-console
    console.log(`[perf] create 100 collections (sequential, via service): ${createElapsed.toFixed(1)}ms`);
    expect(createElapsed).toBeLessThan(5000);

    const readStart = performance.now();
    const all = await loadCollections();
    const readElapsed = performance.now() - readStart;
    console.log(`[perf] loadCollections() over 100 records: ${readElapsed.toFixed(1)}ms`);
    expect(all).toHaveLength(100);
    expect(readElapsed).toBeLessThan(500);
  });
});

describe('P2 Stage 1 performance — bulk assign/remove at 1,000 assets (target: under 2s each)', () => {
  beforeEach(async () => {
    const assets = Array.from({ length: 1000 }, (_, i) => makeAsset(i));
    await putPortfolioAssetsBulk(assets);
    await putCollectionRecordsBulk([makeCollection(0)]);
  });

  it('assigns 1,000 assets to one collection in under 2 seconds', async () => {
    const assetIds = Array.from({ length: 1000 }, (_, i) => `VSP-20260101-${i.toString(36).padStart(6, '0').toUpperCase()}`);
    const collectionId = 'COL-20260101-000000';

    const start = performance.now();
    const result = await assignAssetsToCollections(assetIds, [collectionId]);
    const elapsed = performance.now() - start;
    console.log(`[perf] assign 1,000 assets to 1 collection: ${elapsed.toFixed(1)}ms`);

    expect(result.changedCount).toBe(1000);
    expect(result.failedCount).toBe(0);
    expect(elapsed).toBeLessThan(2000);

    const members = await getAssetsForCollection(collectionId);
    expect(members).toHaveLength(1000);
  });

  it('removes 1,000 assets from one collection in under 2 seconds', async () => {
    const assetIds = Array.from({ length: 1000 }, (_, i) => `VSP-20260101-${i.toString(36).padStart(6, '0').toUpperCase()}`);
    const collectionId = 'COL-20260101-000000';
    await assignAssetsToCollections(assetIds, [collectionId]);

    const start = performance.now();
    const result = await removeAssetsFromCollections(assetIds, [collectionId]);
    const elapsed = performance.now() - start;
    console.log(`[perf] remove 1,000 assets from 1 collection: ${elapsed.toFixed(1)}ms`);

    expect(result.changedCount).toBe(1000);
    expect(elapsed).toBeLessThan(2000);
    expect(await getAssetsForCollection(collectionId)).toHaveLength(0);
  });
});

describe('P2 Stage 1 performance — 20,000-asset relationship stress test', () => {
  it(
    'validateCollectionIntegrity stays fast at 20,000 assets x 100 collections (single-pass, not O(collections x assets x reads))',
    async () => {
      const collections = Array.from({ length: 100 }, (_, i) => makeCollection(i));
      await putCollectionRecordsBulk(collections);

      // Every 10th asset carries 3 valid memberships + 1 deliberately
      // orphaned id, so the integrity scan has real work to do, not just
      // an empty pass.
      const assets: PortfolioAsset[] = [];
      for (let i = 0; i < 20000; i++) {
        const ids =
          i % 10 === 0
            ? [collections[i % 100].id, collections[(i + 1) % 100].id, collections[(i + 2) % 100].id, 'COL-orphaned-ghost']
            : [collections[i % 100].id];
        assets.push(makeAsset(i, ids));
      }
      // Bulk-write in chunks — a single 20,000-row transaction is still
      // one atomic write, chunking here is purely to keep any one
      // `IDBTransaction` from holding an excessive number of pending
      // `put()` calls queued at once in the fake-indexeddb test polyfill.
      const seedStart = performance.now();
      const CHUNK = 2000;
      for (let offset = 0; offset < assets.length; offset += CHUNK) {
        await putPortfolioAssetsBulk(assets.slice(offset, offset + CHUNK));
      }
      console.log(`[perf] seed 20,000 assets (fixture setup, not a target metric): ${(performance.now() - seedStart).toFixed(1)}ms`);

      const start = performance.now();
      const report = await validateCollectionIntegrity();
      const elapsed = performance.now() - start;
      console.log(`[perf] validateCollectionIntegrity over 20,000 assets x 100 collections: ${elapsed.toFixed(1)}ms`);

      expect(report.totalAssets).toBe(20000);
      expect(report.totalCollections).toBe(100);
      expect(report.orphanedMemberships).toHaveLength(2000); // every 10th asset (20000/10)
      // Generous bound for CI/shared runners — guards against an
      // accidental O(collections x assets) or repeated-read regression,
      // not micro-timing. A linear single-pass scan of 20,000 assets
      // completes in well under a second on real hardware.
      expect(elapsed).toBeLessThan(5000);
    },
    30000,
  );

  it(
    'getAssetsForCollection stays fast at 20,000 assets',
    async () => {
      const collection = makeCollection(0);
      await putCollectionRecordsBulk([collection]);
      const assets = Array.from({ length: 20000 }, (_, i) => makeAsset(i, i % 5 === 0 ? [collection.id] : []));
      const CHUNK = 2000;
      for (let offset = 0; offset < assets.length; offset += CHUNK) {
        await putPortfolioAssetsBulk(assets.slice(offset, offset + CHUNK));
      }

      const start = performance.now();
      const members = await getAssetsForCollection(collection.id);
      const elapsed = performance.now() - start;
      console.log(`[perf] getAssetsForCollection over 20,000 assets (4,000 members): ${elapsed.toFixed(1)}ms`);

      expect(members).toHaveLength(4000);
      expect(elapsed).toBeLessThan(2000);
    },
    30000,
  );
});
