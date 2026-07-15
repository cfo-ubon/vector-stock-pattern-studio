import { describe, it, expect } from 'vitest';
import { buildDesignSpecification } from '../trend/designIntelligence';
import type { KeywordBundle } from '../trend/designSpecTypes';
import { buildTileFromDesignSpec } from '../trend/designSpecToParams';
import { computeMetrics, computeHeroVisibilityScore } from '../engine/scoring';
import { runDesignSpecQualityLoop } from '../trend/designSpecQuality';
import { evaluateCommercialValidation } from './commercialValidation';

function makeBundle(overrides: Partial<KeywordBundle> = {}): KeywordBundle {
  return {
    primaryKeyword: 'Luxury Botanical Wallpaper', secondaryKeywords: ['Wallpaper', 'Fabric'], marketplace: 'adobestock',
    season: 'spring', audience: 'editorial', commercialCategory: 'wallpaper', patternType: 'botanical',
    paletteDirection: 'muted green', difficulty: 'moderate', collectionSize: 8, ...overrides,
  };
}

function makeSpec(overrides: Partial<KeywordBundle> = {}) {
  return buildDesignSpecification({ keywordBundle: makeBundle(overrides), trendPackId: '2026-Q1', createdAt: 1000 });
}

function evaluate(seed: string, overrides: Partial<KeywordBundle> = {}) {
  const spec = makeSpec(overrides);
  const tile = buildTileFromDesignSpec(spec, seed);
  const metrics = computeMetrics(tile);
  const loopResult = runDesignSpecQualityLoop(spec, seed, 'fast', 1);
  return evaluateCommercialValidation(spec, metrics, loopResult.check.report);
}

describe('evaluateCommercialValidation', () => {
  it('every score is a real 0-100 number', () => {
    const result = evaluate('commercial-validation-1');
    for (const key of ['commercialScore', 'commercialReadiness', 'premiumFeeling', 'luxuryFeeling', 'editorialFeeling', 'wallpaperScore', 'fabricScore', 'giftWrapScore'] as const) {
      expect(result[key]).toBeGreaterThanOrEqual(0);
      expect(result[key]).toBeLessThanOrEqual(100);
    }
  });

  it('commercialReadiness is read directly from the real quality report, not recomputed', () => {
    const spec = makeSpec();
    const tile = buildTileFromDesignSpec(spec, 'commercial-validation-2');
    const metrics = computeMetrics(tile);
    const loopResult = runDesignSpecQualityLoop(spec, 'commercial-validation-2', 'fast', 1);
    const result = evaluateCommercialValidation(spec, metrics, loopResult.check.report);
    expect(result.commercialReadiness).toBe(loopResult.check.report.commercialReadiness);
  });

  it('wallpaperScore/fabricScore/giftWrapScore match evaluateProductTargets for the same real inputs', async () => {
    const { evaluateProductTargets } = await import('../collection/productTargets');
    const spec = makeSpec();
    const tile = buildTileFromDesignSpec(spec, 'commercial-validation-3');
    const metrics = computeMetrics(tile);
    const loopResult = runDesignSpecQualityLoop(spec, 'commercial-validation-3', 'fast', 1);
    const result = evaluateCommercialValidation(spec, metrics, loopResult.check.report);

    const productEvaluations = evaluateProductTargets({
      categoryId: spec.keywordBundle.patternType,
      tileSize: spec.exportHints.tileSize,
      density: spec.density,
      keywordText: [spec.keywordBundle.commercialCategory, spec.keywordBundle.primaryKeyword, ...spec.keywordBundle.secondaryKeywords].join(' '),
      heroVisibility: computeHeroVisibilityScore(metrics),
    });
    expect(result.wallpaperScore).toBe(productEvaluations.find((e) => e.id === 'wallpaper')!.score);
    expect(result.fabricScore).toBe(productEvaluations.find((e) => e.id === 'fabric')!.score);
    expect(result.giftWrapScore).toBe(productEvaluations.find((e) => e.id === 'giftWrap')!.score);
  });

  it('a spec built on a real luxury Style DNA preset scores a higher luxuryFeeling than one built on a kids preset', () => {
    const luxury = evaluate('commercial-validation-4a', { patternType: 'botanical', primaryKeyword: 'Luxury Floral', commercialCategory: 'wallpaper' });
    const kids = evaluate('commercial-validation-4b', { patternType: 'cute', primaryKeyword: 'Kids Playful Pattern', commercialCategory: 'stationery', audience: 'kids' });
    expect(luxury.luxuryFeeling).toBeGreaterThan(kids.luxuryFeeling);
  });

  it('is deterministic for the same real inputs', () => {
    const a = evaluate('commercial-validation-5');
    const b = evaluate('commercial-validation-5');
    expect(a).toEqual(b);
  });

  describe('heroVisibility wiring (Build 002, Section 7)', () => {
    it('feeds the already-computed real Hero Visibility Score into giftWrapScore via evaluateProductTargets', async () => {
      const { evaluateProductTargets } = await import('../collection/productTargets');
      const spec = makeSpec({ patternType: 'cute', primaryKeyword: 'Gift Wrap', commercialCategory: 'giftWrap' });
      const tile = buildTileFromDesignSpec(spec, 'commercial-validation-6');
      const metrics = computeMetrics(tile);
      const loopResult = runDesignSpecQualityLoop(spec, 'commercial-validation-6', 'fast', 1);
      const heroVisibility = computeHeroVisibilityScore(metrics);

      const result = evaluateCommercialValidation(spec, metrics, loopResult.check.report);
      const withHeroVisibility = evaluateProductTargets({
        categoryId: spec.keywordBundle.patternType,
        tileSize: spec.exportHints.tileSize,
        density: spec.density,
        keywordText: [spec.keywordBundle.commercialCategory, spec.keywordBundle.primaryKeyword, ...spec.keywordBundle.secondaryKeywords].join(' '),
        heroVisibility,
      });
      const withoutHeroVisibility = evaluateProductTargets({
        categoryId: spec.keywordBundle.patternType,
        tileSize: spec.exportHints.tileSize,
        density: spec.density,
        keywordText: [spec.keywordBundle.commercialCategory, spec.keywordBundle.primaryKeyword, ...spec.keywordBundle.secondaryKeywords].join(' '),
      });

      expect(result.giftWrapScore).toBe(withHeroVisibility.find((e) => e.id === 'giftWrap')!.score);
      // wallpaperScore/fabricScore have no heroVisibility rule, so wiring
      // it in must never move them.
      const wallpaperWith = withHeroVisibility.find((e) => e.id === 'wallpaper')!.score;
      const wallpaperWithout = withoutHeroVisibility.find((e) => e.id === 'wallpaper')!.score;
      expect(wallpaperWith).toBe(wallpaperWithout);
    });
  });
});
