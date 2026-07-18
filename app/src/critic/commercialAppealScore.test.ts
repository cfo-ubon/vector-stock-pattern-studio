import { describe, it, expect } from 'vitest';
import { defaultParams } from '../engine/defaults';
import { buildTile } from '../engine/tile';
import { computeMetrics, computeHeroVisibilityScore } from '../engine/scoring';
import { evaluateCommercialPatternCritique } from './commercialPatternCritic';
import { computeCommercialAppealScoreV2, type CommercialAppealScoreV2Inputs } from './commercialAppealScore';

describe('computeCommercialAppealScoreV2 (Build 011, Section 9)', () => {
  const fixedCritique = {
    luxuryFeeling: 80,
    editorialFeeling: 70,
    premiumFeeling: 60,
    fabricFeeling: 50,
    wallpaperFeeling: 60,
    giftWrapFeeling: 70,
    visualStory: 65,
  };

  it('maps each of the 5 always-real dimensions straight to its already-computed source, with no portfolio context', () => {
    const score = computeCommercialAppealScoreV2({ critique: fixedCritique, heroVisibility: 90 });
    expect(score.luxuryFeel).toBe(80);
    expect(score.editorialQuality).toBe(70);
    expect(score.shelfImpact).toBe(90);
    expect(score.premiumImpression).toBe(60);
    expect(score.productSuitability).toBe(60); // (50+60+70)/3 = 60
    expect(score.collectionConsistency).toBeUndefined();
  });

  it('overall averages exactly the 5 dimensions when collectionConsistency is omitted', () => {
    const score = computeCommercialAppealScoreV2({ critique: fixedCritique, heroVisibility: 90 });
    const expected = Math.round((80 + 70 + 90 + 60 + 60) / 5);
    expect(score.overall).toBe(expected);
  });

  it('folds collectionConsistency into overall as a real 6th dimension when supplied', () => {
    const score = computeCommercialAppealScoreV2({ critique: fixedCritique, heroVisibility: 90, collectionConsistency: 40 });
    expect(score.collectionConsistency).toBe(40);
    const expected = Math.round((80 + 70 + 90 + 60 + 60 + 40) / 6);
    expect(score.overall).toBe(expected);
  });

  it('every dimension stays within [0, 100] for a real, end-to-end built tile', () => {
    const tile = buildTile({ ...defaultParams(), categoryId: 'botanical', seed: 'appeal-v2-real' });
    const metrics = computeMetrics(tile);
    const heroVisibility = computeHeroVisibilityScore(metrics);
    const critique = evaluateCommercialPatternCritique({
      metrics,
      categoryId: 'botanical',
      tileSize: defaultParams().tileSize,
      density: defaultParams().density,
      keywordText: 'botanical floral pattern',
      heroVisibility,
    });
    const score = computeCommercialAppealScoreV2({ critique, heroVisibility });
    for (const key of ['luxuryFeel', 'editorialQuality', 'shelfImpact', 'premiumImpression', 'productSuitability', 'overall'] as const) {
      expect(score[key]).toBeGreaterThanOrEqual(0);
      expect(score[key]).toBeLessThanOrEqual(100);
    }
  });

  it('is deterministic for the same inputs', () => {
    const inputs: CommercialAppealScoreV2Inputs = { critique: fixedCritique, heroVisibility: 55, collectionConsistency: 72 };
    expect(computeCommercialAppealScoreV2(inputs)).toEqual(computeCommercialAppealScoreV2(inputs));
  });
});
