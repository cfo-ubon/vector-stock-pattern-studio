import { describe, it, expect } from 'vitest';
import {
  resolveNegativeSpaceForProduct,
  resolveSpacingStrategyForProduct,
  applyProductSpacingStrategy,
  resolveCompositionZoneForProduct,
} from './negativeSpaceDesigner';
import { PRODUCT_USE_IDS } from '../collection/productTargets';
import { DEFAULT_COMPOSITION_INTELLIGENCE } from './compositionIntelligence';
import { COMPOSITION_ZONES } from './compositionZones';

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

describe('resolveSpacingStrategyForProduct (Build 009, Section 3: Negative Space Designer V2)', () => {
  it('is the identity strategy when productTarget is undefined', () => {
    expect(resolveSpacingStrategyForProduct(undefined)).toEqual({ rhythmMultiplier: 1, clusterLooseness: 0, preferredZones: [] });
  });

  it('every real ProductUseId resolves to a strategy with a positive rhythmMultiplier and clusterLooseness in [-1, 1]', () => {
    for (const id of PRODUCT_USE_IDS) {
      const strategy = resolveSpacingStrategyForProduct(id);
      expect(strategy.rhythmMultiplier).toBeGreaterThan(0);
      expect(strategy.clusterLooseness).toBeGreaterThanOrEqual(-1);
      expect(strategy.clusterLooseness).toBeLessThanOrEqual(1);
    }
  });

  it('repeat-forward products (wallpaper/fabric) get a steadier rhythm and tighter clusters', () => {
    expect(resolveSpacingStrategyForProduct('wallpaper').rhythmMultiplier).toBeGreaterThan(1);
    expect(resolveSpacingStrategyForProduct('wallpaper').clusterLooseness).toBeLessThan(0);
    expect(resolveSpacingStrategyForProduct('fabric').rhythmMultiplier).toBeGreaterThan(1);
  });

  it('focal-object products (giftWrap/stationery) get a looser rhythm and looser clusters', () => {
    expect(resolveSpacingStrategyForProduct('giftWrap').rhythmMultiplier).toBeLessThan(1);
    expect(resolveSpacingStrategyForProduct('giftWrap').clusterLooseness).toBeGreaterThan(0);
    expect(resolveSpacingStrategyForProduct('stationery').clusterLooseness).toBeGreaterThan(0);
  });
});

describe('applyProductSpacingStrategy (Build 009, Section 3)', () => {
  it('is a strict no-op (same reference) when ci is undefined', () => {
    expect(applyProductSpacingStrategy(undefined, 'wallpaper')).toBeUndefined();
  });

  it('is a strict no-op (same reference) when productTarget is undefined', () => {
    expect(applyProductSpacingStrategy(DEFAULT_COMPOSITION_INTELLIGENCE, undefined)).toBe(DEFAULT_COMPOSITION_INTELLIGENCE);
  });

  it('is a strict no-op (same reference) for a product with the identity strategy', () => {
    expect(applyProductSpacingStrategy(DEFAULT_COMPOSITION_INTELLIGENCE, 'homeDecor')).toBe(DEFAULT_COMPOSITION_INTELLIGENCE);
  });

  it('scales rhythmStrength down and attractionStrength down (looser clusters) for a focal-object product', () => {
    const result = applyProductSpacingStrategy(DEFAULT_COMPOSITION_INTELLIGENCE, 'giftWrap')!;
    expect(result.rhythmStrength).toBeLessThan(DEFAULT_COMPOSITION_INTELLIGENCE.rhythmStrength);
    expect(result.attractionStrength!).toBeLessThan(DEFAULT_COMPOSITION_INTELLIGENCE.attractionStrength!);
  });

  it('scales rhythmStrength up and attractionStrength up (tighter clusters) for a repeat-forward product', () => {
    const result = applyProductSpacingStrategy(DEFAULT_COMPOSITION_INTELLIGENCE, 'wallpaper')!;
    expect(result.rhythmStrength).toBeGreaterThan(DEFAULT_COMPOSITION_INTELLIGENCE.rhythmStrength);
    expect(result.attractionStrength!).toBeGreaterThan(DEFAULT_COMPOSITION_INTELLIGENCE.attractionStrength!);
  });

  it('leaves attractionStrength undefined when it was already undefined', () => {
    const ci = { balanceStrength: 0.5, rhythmStrength: 0.35 };
    const result = applyProductSpacingStrategy(ci, 'giftWrap')!;
    expect(result.attractionStrength).toBeUndefined();
  });

  it('clamps rhythmStrength and attractionStrength to [0, 1]', () => {
    const ci = { balanceStrength: 0.5, rhythmStrength: 0.95, attractionStrength: 0.95 };
    const result = applyProductSpacingStrategy(ci, 'wallpaper')!;
    expect(result.rhythmStrength).toBeLessThanOrEqual(1);
    expect(result.attractionStrength!).toBeLessThanOrEqual(1);
  });
});

describe('resolveCompositionZoneForProduct (Build 009, Section 8: Product-aware Composition)', () => {
  it('returns undefined when productTarget is undefined', () => {
    expect(resolveCompositionZoneForProduct(undefined)).toBeUndefined();
  });

  it('every real ProductUseId with a declared preference resolves to a real, known CompositionZone', () => {
    for (const id of PRODUCT_USE_IDS) {
      const zone = resolveCompositionZoneForProduct(id);
      if (zone !== undefined) expect(COMPOSITION_ZONES).toContain(zone);
    }
  });

  it('repeat-forward products (wallpaper/fabric/textile) prefer an all-over zone (offset/wave/diagonal)', () => {
    expect(['offset', 'wave', 'diagonal']).toContain(resolveCompositionZoneForProduct('wallpaper'));
    expect(['offset', 'wave', 'diagonal']).toContain(resolveCompositionZoneForProduct('fabric'));
    expect(['offset', 'wave', 'diagonal']).toContain(resolveCompositionZoneForProduct('textile'));
  });

  it('focal-object products (giftWrap/wrappingPaper/stationery) prefer a single-focal-point zone', () => {
    expect(['centerFocus', 'goldenRatio']).toContain(resolveCompositionZoneForProduct('giftWrap'));
    expect(['centerFocus', 'goldenRatio']).toContain(resolveCompositionZoneForProduct('wrappingPaper'));
    expect(['editorial', 'goldenRatio']).toContain(resolveCompositionZoneForProduct('stationery'));
  });

  it('is deterministic (pure function, no rng)', () => {
    expect(resolveCompositionZoneForProduct('giftWrap')).toBe(resolveCompositionZoneForProduct('giftWrap'));
  });
});
