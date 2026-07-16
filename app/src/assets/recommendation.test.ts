import { describe, it, expect } from 'vitest';
import { defaultParams } from '../engine/defaults';
import { generateCollection } from '../collection/collectionGenerator';
import { extractAssetsFromCollection } from './extraction';
import { recommendCompatibleAssets } from './recommendation';

function realAssets(categoryId: string, seed: string) {
  return extractAssetsFromCollection(generateCollection({ ...defaultParams(), categoryId, seed }));
}

describe('recommendCompatibleAssets', () => {
  it('never recommends the asset itself', () => {
    const assets = realAssets('botanical', 'rec-1');
    const target = assets[0];
    const recs = recommendCompatibleAssets(target, assets);
    expect(recs.some((r) => r.metadata.id === target.metadata.id)).toBe(false);
  });

  it('prefers assets from the same real source collection', () => {
    const sameCollection = realAssets('botanical', 'rec-2');
    const otherCollection = realAssets('botanical', 'rec-3');
    const target = sameCollection[0];
    const pool = [...sameCollection.slice(1), ...otherCollection];
    const recs = recommendCompatibleAssets(target, pool, pool.length);
    const sameCollectionIds = new Set(sameCollection.map((a) => a.metadata.id));
    const firstFewAreSameCollection = recs.slice(0, sameCollection.length - 1).every((r) => sameCollectionIds.has(r.metadata.id));
    expect(firstFewAreSameCollection).toBe(true);
  });

  it('respects the limit parameter', () => {
    const assets = realAssets('botanical', 'rec-4');
    const recs = recommendCompatibleAssets(assets[0], assets, 3);
    expect(recs.length).toBeLessThanOrEqual(3);
  });

  it('returns no recommendations from an empty pool', () => {
    const assets = realAssets('botanical', 'rec-5');
    expect(recommendCompatibleAssets(assets[0], [])).toEqual([]);
  });

  it('is deterministic for the same target and pool', () => {
    const assets = realAssets('botanical', 'rec-6');
    const a = recommendCompatibleAssets(assets[0], assets);
    const b = recommendCompatibleAssets(assets[0], assets);
    expect(a.map((r) => r.metadata.id)).toEqual(b.map((r) => r.metadata.id));
  });
});
