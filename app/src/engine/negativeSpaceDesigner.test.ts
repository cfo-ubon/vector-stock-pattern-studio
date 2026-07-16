import { describe, it, expect } from 'vitest';
import { resolveNegativeSpaceForProduct } from './negativeSpaceDesigner';
import { PRODUCT_USE_IDS } from '../collection/productTargets';

describe('resolveNegativeSpaceForProduct (Build 006, Section 5: Negative Space Designer)', () => {
  it('is a pure identity when productTarget is undefined (zero behavior change)', () => {
    expect(resolveNegativeSpaceForProduct(0.2, undefined)).toBe(0.2);
    expect(resolveNegativeSpaceForProduct(0, undefined)).toBe(0);
    expect(resolveNegativeSpaceForProduct(1, undefined)).toBe(1);
  });

  it('every real ProductUseId resolves to a valid [0, 1] value', () => {
    for (const id of PRODUCT_USE_IDS) {
      const result = resolveNegativeSpaceForProduct(0.2, id);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    }
  });

  it('repeat-forward products (wallpaper/fabric) nudge negative space DOWN (fuller repeat)', () => {
    expect(resolveNegativeSpaceForProduct(0.3, 'wallpaper')).toBeLessThan(0.3);
    expect(resolveNegativeSpaceForProduct(0.3, 'fabric')).toBeLessThan(0.3);
  });

  it('focal-object products (giftWrap/wrappingPaper/stationery) nudge negative space UP (more breathing room)', () => {
    expect(resolveNegativeSpaceForProduct(0.2, 'giftWrap')).toBeGreaterThan(0.2);
    expect(resolveNegativeSpaceForProduct(0.2, 'wrappingPaper')).toBeGreaterThan(0.2);
    expect(resolveNegativeSpaceForProduct(0.2, 'stationery')).toBeGreaterThan(0.2);
  });

  it('giftWrap is nudged up more than wallpaper is nudged down (the brief\'s own strongest contrast case)', () => {
    const giftWrap = resolveNegativeSpaceForProduct(0.2, 'giftWrap') - 0.2;
    const wallpaper = 0.2 - resolveNegativeSpaceForProduct(0.2, 'wallpaper');
    expect(giftWrap).toBeGreaterThan(wallpaper);
  });

  it('clamps to [0, 1] at the extremes', () => {
    expect(resolveNegativeSpaceForProduct(0, 'wallpaper')).toBe(0);
    expect(resolveNegativeSpaceForProduct(1, 'giftWrap')).toBe(1);
  });
});
