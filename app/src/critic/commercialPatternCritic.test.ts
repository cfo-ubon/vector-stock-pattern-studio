import { describe, it, expect } from 'vitest';
import { defaultParams } from '../engine/defaults';
import { buildTile } from '../engine/tile';
import { computeMetrics } from '../engine/scoring';
import { computeBotanicalBeautyMetrics } from '../engine/botanicalBeautyMetrics';
import { evaluateCommercialPatternCritique } from './commercialPatternCritic';

describe('Commercial Pattern Critic (Build 006, Section 8)', () => {
  it('produces all 8 named dimensions in [0, 100] (or undefined for botanicalRealism) for a non-botanical tile', () => {
    const tile = buildTile({ ...defaultParams(), categoryId: 'geometric', seed: 'cpc-geometric' });
    const metrics = computeMetrics(tile);
    const critique = evaluateCommercialPatternCritique({
      metrics, categoryId: 'geometric', tileSize: defaultParams().tileSize, density: defaultParams().density,
      keywordText: 'geometric pattern', heroVisibility: 80,
    });
    for (const key of ['luxuryFeeling', 'editorialFeeling', 'premiumFeeling', 'fabricFeeling', 'wallpaperFeeling', 'giftWrapFeeling', 'visualStory'] as const) {
      expect(critique[key]).toBeGreaterThanOrEqual(0);
      expect(critique[key]).toBeLessThanOrEqual(100);
    }
    expect(critique.botanicalRealism).toBeUndefined();
  });

  it('includes a real botanicalRealism passthrough for a botanical tile', () => {
    const tile = buildTile({ ...defaultParams(), categoryId: 'botanical', seed: 'cpc-botanical' });
    const metrics = computeMetrics(tile);
    const botanical = computeBotanicalBeautyMetrics(tile, metrics);
    const critique = evaluateCommercialPatternCritique({
      metrics, categoryId: 'botanical', tileSize: defaultParams().tileSize, density: defaultParams().density,
      keywordText: 'botanical floral pattern', heroVisibility: 80, botanical,
    });
    expect(critique.botanicalRealism).toBe(botanical.botanicalRealism);
  });

  it('visualStory is exactly the average of flowCoherence/rhythmRegularity/hierarchy', () => {
    const tile = buildTile({ ...defaultParams(), categoryId: 'geometric', seed: 'cpc-visualstory' });
    const metrics = computeMetrics(tile);
    const critique = evaluateCommercialPatternCritique({
      metrics, categoryId: 'geometric', tileSize: defaultParams().tileSize, density: defaultParams().density,
      keywordText: 'geometric', heroVisibility: 80,
    });
    const expected = Math.round((metrics.flowCoherence + metrics.rhythmRegularity + metrics.hierarchy) / 3);
    expect(critique.visualStory).toBe(expected);
  });

  it('premiumFeeling is exactly the documented weighted blend of svgHealth/cornerContinuity/heroDetailRatio/colorBalance', () => {
    const tile = buildTile({ ...defaultParams(), categoryId: 'geometric', seed: 'cpc-premium' });
    const metrics = computeMetrics(tile);
    const critique = evaluateCommercialPatternCritique({
      metrics, categoryId: 'geometric', tileSize: defaultParams().tileSize, density: defaultParams().density,
      keywordText: 'geometric', heroVisibility: 80,
    });
    const expected = Math.round(metrics.svgHealth * 0.3 + metrics.cornerContinuity * 0.25 + metrics.heroDetailRatio * 0.25 + metrics.colorBalance * 0.2);
    expect(critique.premiumFeeling).toBe(expected);
  });

  it('a giftWrap-friendly keyword genuinely scores higher giftWrapFeeling than an unrelated one', () => {
    const tile = buildTile({ ...defaultParams(), categoryId: 'botanical', seed: 'cpc-giftwrap' });
    const metrics = computeMetrics(tile);
    const withKeyword = evaluateCommercialPatternCritique({
      metrics, categoryId: 'botanical', tileSize: 3000, density: defaultParams().density,
      keywordText: 'gift wrap wrapping paper', heroVisibility: 90,
    });
    const withoutKeyword = evaluateCommercialPatternCritique({
      metrics, categoryId: 'botanical', tileSize: 3000, density: defaultParams().density,
      keywordText: 'zzz unrelated', heroVisibility: 90,
    });
    expect(withKeyword.giftWrapFeeling).toBeGreaterThan(withoutKeyword.giftWrapFeeling);
  });
});
