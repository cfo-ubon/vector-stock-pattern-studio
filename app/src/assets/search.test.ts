import { describe, it, expect } from 'vitest';
import { defaultParams } from '../engine/defaults';
import { generateCollection } from '../collection/collectionGenerator';
import { extractAssetsFromCollection } from './extraction';
import { searchAssets } from './search';

function realAssets(categoryId: string, seed: string) {
  return extractAssetsFromCollection(generateCollection({ ...defaultParams(), categoryId, seed }));
}

describe('searchAssets', () => {
  const assets = realAssets('botanical', 'search-1');

  it('returns everything when the query is empty', () => {
    expect(searchAssets(assets, {})).toEqual(assets);
  });

  it('filters by kind', () => {
    const found = searchAssets(assets, { kind: 'border' });
    expect(found.length).toBe(4);
    expect(found.every((a) => a.metadata.kind === 'border')).toBe(true);
  });

  it('filters by family', () => {
    const found = searchAssets(assets, { family: 'flower' });
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((a) => a.metadata.family === 'flower')).toBe(true);
  });

  it('filters by real keyword match against name/category', () => {
    const found = searchAssets(assets, { keyword: 'botanical' });
    expect(found.length).toBeGreaterThan(0);
    expect(searchAssets(assets, { keyword: 'zzz-nonexistent-keyword' }).length).toBe(0);
  });

  it('filters by real patternType membership', () => {
    const [sample] = assets;
    const patternType = sample.metadata.patternTypes[0];
    const found = searchAssets(assets, { patternType });
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((a) => a.metadata.patternTypes.includes(patternType))).toBe(true);
  });

  it('filters by complexity range', () => {
    const found = searchAssets(assets, { complexityMin: 0, complexityMax: 100 });
    expect(found.length).toBe(assets.length);
    const noneAbove = searchAssets(assets, { complexityMin: 101 });
    expect(noneAbove.length).toBe(0);
  });

  it('filters by real color membership', () => {
    const withColor = assets.find((a) => a.metadata.colorRoles.length > 0);
    if (withColor) {
      const found = searchAssets(assets, { color: withColor.metadata.colorRoles[0] });
      expect(found.length).toBeGreaterThan(0);
      expect(found.every((a) => a.metadata.colorRoles.some((c) => c.toLowerCase() === withColor.metadata.colorRoles[0].toLowerCase()))).toBe(true);
    }
  });

  it('combines multiple filters with AND semantics', () => {
    const found = searchAssets(assets, { kind: 'heroMotif', family: 'flower' });
    expect(found.every((a) => a.metadata.kind === 'heroMotif' && a.metadata.family === 'flower')).toBe(true);
  });
});
