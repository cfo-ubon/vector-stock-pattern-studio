import { describe, it, expect } from 'vitest';
import { computeCollectionAnalytics } from './collectionAnalytics';
import { createCollection } from '../domain/collection';
import { createPortfolioAsset } from '../domain/asset';
import type { PortfolioAsset } from '../domain/types';

function asset(collectionIds: string[]): PortfolioAsset {
  const base = createPortfolioAsset({ displayName: 'A', originalFilename: 'a.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
  return { ...base, collectionIds };
}

describe('computeCollectionAnalytics — empty portfolio', () => {
  it('returns all-zero/empty stats for no collections and no assets', () => {
    const report = computeCollectionAnalytics([], []);
    expect(report).toEqual({
      collectionCount: 0,
      patternCount: 0,
      averagePatternsPerCollection: 0,
      largestCollection: null,
      emptyCollections: [],
      duplicatePatternUsage: [],
    });
  });
});

describe('computeCollectionAnalytics — counts', () => {
  it('counts collections and organized (in-collection) patterns', () => {
    const c1 = createCollection({ name: 'Spring' });
    const c2 = createCollection({ name: 'Summer' });
    const assets = [asset([c1.id]), asset([c1.id]), asset([c2.id]), asset([])]; // last one unorganized
    const report = computeCollectionAnalytics([c1, c2], assets);
    expect(report.collectionCount).toBe(2);
    expect(report.patternCount).toBe(3); // the unorganized asset is excluded
  });

  it('computes average patterns per collection using each collection\'s own size (double-counts shared patterns)', () => {
    const c1 = createCollection({ name: 'Spring' });
    const c2 = createCollection({ name: 'Summer' });
    const shared = asset([c1.id, c2.id]); // in both
    const assets = [shared, asset([c1.id])];
    const report = computeCollectionAnalytics([c1, c2], assets);
    // c1 has 2 patterns (shared + the solo one), c2 has 1 (shared) -> total memberships 3 / 2 collections = 1.5
    expect(report.averagePatternsPerCollection).toBe(1.5);
    expect(report.patternCount).toBe(2); // only 2 distinct patterns overall
  });
});

describe('computeCollectionAnalytics — largest collection', () => {
  it('identifies the largest collection by pattern count', () => {
    const small = createCollection({ name: 'Small' });
    const big = createCollection({ name: 'Big' });
    const assets = [asset([small.id]), asset([big.id]), asset([big.id]), asset([big.id])];
    const report = computeCollectionAnalytics([small, big], assets);
    expect(report.largestCollection).toEqual({ collectionId: big.id, name: 'Big', patternCount: 3 });
  });

  it('is null when there are no collections', () => {
    expect(computeCollectionAnalytics([], []).largestCollection).toBeNull();
  });
});

describe('computeCollectionAnalytics — empty collections', () => {
  it('lists collections with zero patterns', () => {
    const empty = createCollection({ name: 'Empty' });
    const full = createCollection({ name: 'Full' });
    const report = computeCollectionAnalytics([empty, full], [asset([full.id])]);
    expect(report.emptyCollections).toEqual([{ collectionId: empty.id, name: 'Empty', patternCount: 0 }]);
  });
});

describe('computeCollectionAnalytics — duplicate pattern usage', () => {
  it('lists patterns belonging to more than one collection', () => {
    const c1 = createCollection({ name: 'A' });
    const c2 = createCollection({ name: 'B' });
    const shared = asset([c1.id, c2.id]);
    const solo = asset([c1.id]);
    const report = computeCollectionAnalytics([c1, c2], [shared, solo]);
    expect(report.duplicatePatternUsage).toEqual([{ assetId: shared.assetId, collectionCount: 2 }]);
  });

  it('is empty when no pattern belongs to more than one collection', () => {
    const c1 = createCollection({ name: 'A' });
    const report = computeCollectionAnalytics([c1], [asset([c1.id])]);
    expect(report.duplicatePatternUsage).toEqual([]);
  });
});
