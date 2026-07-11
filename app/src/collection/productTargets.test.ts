import { describe, it, expect } from 'vitest';
import { evaluateProductTargets, recommendedProductUses, PRODUCT_USE_IDS } from './productTargets';

describe('evaluateProductTargets', () => {
  it('always returns all 10 product uses', () => {
    const results = evaluateProductTargets({ categoryId: 'botanical', tileSize: 1400, density: 0.5, keywordText: 'luxury botanical' });
    expect(results.map((r) => r.id).sort()).toEqual([...PRODUCT_USE_IDS].sort());
  });

  it('is sorted by score descending', () => {
    const results = evaluateProductTargets({ categoryId: 'botanical', tileSize: 1400, density: 0.5, keywordText: 'wallpaper' });
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('an explicit keyword match strongly boosts the matching product to the top', () => {
    const results = evaluateProductTargets({ categoryId: 'geometric', tileSize: 900, density: 0.5, keywordText: 'gift wrap for the holidays' });
    expect(results[0].id).toBe('giftWrap');
    expect(results[0].reasons.some((r) => r.includes('keyword intent'))).toBe(true);
  });

  it('is deterministic for the same input', () => {
    const a = evaluateProductTargets({ categoryId: 'damask', tileSize: 1600, density: 0.6, keywordText: 'home decor' });
    const b = evaluateProductTargets({ categoryId: 'damask', tileSize: 1600, density: 0.6, keywordText: 'home decor' });
    expect(a).toEqual(b);
  });

  it('matching category and a fitting tile size scores higher than a mismatched category with no keyword hit', () => {
    const good = evaluateProductTargets({ categoryId: 'botanical', tileSize: 1600, density: 0.5, keywordText: '' });
    const bad = evaluateProductTargets({ categoryId: 'geometric', tileSize: 1600, density: 0.5, keywordText: '' });
    const goodWallpaper = good.find((r) => r.id === 'wallpaper')!;
    const badWallpaper = bad.find((r) => r.id === 'wallpaper')!;
    expect(goodWallpaper.score).toBeGreaterThan(badWallpaper.score);
  });

  it('every score is clamped to 0-100', () => {
    const results = evaluateProductTargets({ categoryId: 'botanical', tileSize: 50000, density: 5, keywordText: 'wallpaper wallpaper wallpaper' });
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });

  it('keyword matching is case-insensitive', () => {
    const lower = evaluateProductTargets({ categoryId: 'geometric', tileSize: 900, density: 0.5, keywordText: 'stationery set' });
    const upper = evaluateProductTargets({ categoryId: 'geometric', tileSize: 900, density: 0.5, keywordText: 'STATIONERY SET' });
    expect(lower).toEqual(upper);
  });
});

describe('recommendedProductUses', () => {
  it('returns only suitable entries, capped at max', () => {
    const results = evaluateProductTargets({ categoryId: 'botanical', tileSize: 1400, density: 0.5, keywordText: 'wallpaper fabric textile' });
    const recommended = recommendedProductUses(results, 4);
    expect(recommended.length).toBeLessThanOrEqual(4);
    expect(recommended.length).toBeGreaterThan(0);
    for (const id of recommended) {
      expect(results.find((r) => r.id === id)!.suitable).toBe(true);
    }
  });

  it('never returns an empty list even when nothing clears the suitability bar', () => {
    // A neutral input (no keyword hits, mid-range everything) still
    // produces a fallback top-N recommendation rather than nothing.
    const results = evaluateProductTargets({ categoryId: 'unknown-category', tileSize: 1300, density: 0.5, keywordText: '' });
    const recommended = recommendedProductUses(results, 4);
    expect(recommended.length).toBeGreaterThan(0);
  });

  it('respects a custom max', () => {
    const results = evaluateProductTargets({ categoryId: 'botanical', tileSize: 1400, density: 0.5, keywordText: 'wallpaper fabric textile home decor' });
    expect(recommendedProductUses(results, 2).length).toBeLessThanOrEqual(2);
  });
});
