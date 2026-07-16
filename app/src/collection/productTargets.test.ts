import { describe, it, expect } from 'vitest';
import { evaluateProductTargets, recommendedProductUses, isRepeatProduct, PRODUCT_USE_IDS } from './productTargets';

describe('evaluateProductTargets', () => {
  it('always returns all product uses (13, including Build 012 Section 4 additions)', () => {
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

  describe('heroVisibility (Build 002, Section 7)', () => {
    it('a real high Hero Visibility Score raises giftWrap over the same input without it', () => {
      const withoutHeroVisibility = evaluateProductTargets({ categoryId: 'cute', tileSize: 1000, density: 0.5, keywordText: '' });
      const withHeroVisibility = evaluateProductTargets({ categoryId: 'cute', tileSize: 1000, density: 0.5, keywordText: '', heroVisibility: 90 });
      const before = withoutHeroVisibility.find((r) => r.id === 'giftWrap')!.score;
      const after = withHeroVisibility.find((r) => r.id === 'giftWrap')!.score;
      expect(after).toBeGreaterThan(before);
    });

    it('a real low Hero Visibility Score lowers giftWrap versus the same input without it', () => {
      const withoutHeroVisibility = evaluateProductTargets({ categoryId: 'cute', tileSize: 1000, density: 0.5, keywordText: '' });
      const withHeroVisibility = evaluateProductTargets({ categoryId: 'cute', tileSize: 1000, density: 0.5, keywordText: '', heroVisibility: 20 });
      const before = withoutHeroVisibility.find((r) => r.id === 'giftWrap')!.score;
      const after = withHeroVisibility.find((r) => r.id === 'giftWrap')!.score;
      expect(after).toBeLessThan(before);
    });

    it('never moves wallpaperScore, which has no heroVisibility rule', () => {
      const withoutHeroVisibility = evaluateProductTargets({ categoryId: 'botanical', tileSize: 1600, density: 0.5, keywordText: 'wallpaper' });
      const withHighHeroVisibility = evaluateProductTargets({ categoryId: 'botanical', tileSize: 1600, density: 0.5, keywordText: 'wallpaper', heroVisibility: 95 });
      const withLowHeroVisibility = evaluateProductTargets({ categoryId: 'botanical', tileSize: 1600, density: 0.5, keywordText: 'wallpaper', heroVisibility: 5 });
      const scoreOf = (results: ReturnType<typeof evaluateProductTargets>) => results.find((r) => r.id === 'wallpaper')!.score;
      expect(scoreOf(withHighHeroVisibility)).toBe(scoreOf(withoutHeroVisibility));
      expect(scoreOf(withLowHeroVisibility)).toBe(scoreOf(withoutHeroVisibility));
    });
  });
});

describe('Build 012, Section 4: greetingCard/poster/canvas', () => {
  it('includes all 3 new products in every evaluation, same convention as the original 10', () => {
    const results = evaluateProductTargets({ categoryId: 'botanical', tileSize: 1400, density: 0.5, keywordText: '' });
    for (const id of ['greetingCard', 'poster', 'canvas']) {
      expect(results.some((r) => r.id === id)).toBe(true);
    }
  });

  it('an explicit poster keyword match strongly boosts poster to the top', () => {
    const results = evaluateProductTargets({ categoryId: 'mandala', tileSize: 2000, density: 0.5, keywordText: 'wall art poster' });
    expect(results[0].id).toBe('poster');
  });

  it('an explicit canvas keyword match strongly boosts canvas to the top', () => {
    const results = evaluateProductTargets({ categoryId: 'botanical', tileSize: 2000, density: 0.5, keywordText: 'canvas print for wall decor' });
    expect(results[0].id).toBe('canvas');
  });

  it('an explicit greeting card keyword match strongly boosts greetingCard to the top', () => {
    const results = evaluateProductTargets({ categoryId: 'cute', tileSize: 1200, density: 0.5, keywordText: 'greeting card', heroVisibility: 90 });
    expect(results[0].id).toBe('greetingCard');
  });
});

describe('isRepeatProduct', () => {
  it('marks poster and canvas as non-repeat products', () => {
    expect(isRepeatProduct('poster')).toBe(false);
    expect(isRepeatProduct('canvas')).toBe(false);
  });

  it('marks every other product (including greetingCard) as a repeat product, preserving prior behavior', () => {
    for (const id of ['wallpaper', 'fabric', 'wrappingPaper', 'giftWrap', 'packaging', 'notebookCovers', 'stationery', 'homeDecor', 'textile', 'digitalPaper', 'greetingCard']) {
      expect(isRepeatProduct(id as (typeof PRODUCT_USE_IDS)[number])).toBe(true);
    }
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
