import { describe, expect, it } from 'vitest';
import { computeCompositeRankScore, computePortfolioRanking } from './ranking';
import { makePortfolioRecord } from './testFixtures';

describe('computeCompositeRankScore', () => {
  it('averages the five real 0-100 signals', () => {
    const p = makePortfolioRecord({
      absoluteCommercialQualityV2: 80, commercialAppealV2Overall: 90, luxuryCompositionOverall: 70,
      surfacePatternSuitability: 60, productTargetScore: 100,
    });
    expect(computeCompositeRankScore(p)).toBeCloseTo(80, 6);
  });
});

describe('computePortfolioRanking', () => {
  it('ranks highest composite score as rank 1 with percentile 100', () => {
    const patterns = [
      makePortfolioRecord({ absoluteCommercialQualityV2: 90, commercialAppealV2Overall: 90, luxuryCompositionOverall: 90, surfacePatternSuitability: 90, productTargetScore: 90 }),
      makePortfolioRecord({ absoluteCommercialQualityV2: 50, commercialAppealV2Overall: 50, luxuryCompositionOverall: 50, surfacePatternSuitability: 50, productTargetScore: 50 }),
      makePortfolioRecord({ absoluteCommercialQualityV2: 70, commercialAppealV2Overall: 70, luxuryCompositionOverall: 70, surfacePatternSuitability: 70, productTargetScore: 70 }),
    ];
    computePortfolioRanking(patterns);
    expect(patterns[0].rankOverall).toBe(1);
    expect(patterns[0].percentileOverall).toBe(100);
    expect(patterns[1].rankOverall).toBe(3);
    expect(patterns[1].percentileOverall).toBe(0);
    expect(patterns[2].rankOverall).toBe(2);
  });

  it('assigns tied scores the same rank (competition ranking)', () => {
    const patterns = [
      makePortfolioRecord({ absoluteCommercialQualityV2: 80, commercialAppealV2Overall: 80, luxuryCompositionOverall: 80, surfacePatternSuitability: 80, productTargetScore: 80 }),
      makePortfolioRecord({ absoluteCommercialQualityV2: 80, commercialAppealV2Overall: 80, luxuryCompositionOverall: 80, surfacePatternSuitability: 80, productTargetScore: 80 }),
      makePortfolioRecord({ absoluteCommercialQualityV2: 40, commercialAppealV2Overall: 40, luxuryCompositionOverall: 40, surfacePatternSuitability: 40, productTargetScore: 40 }),
    ];
    computePortfolioRanking(patterns);
    expect(patterns[0].rankOverall).toBe(1);
    expect(patterns[1].rankOverall).toBe(1);
    expect(patterns[2].rankOverall).toBe(3);
  });

  it('computes scoped ranks within preset independently of the overall ranking', () => {
    const patterns = [
      makePortfolioRecord({ styleDnaId: 'presetA', absoluteCommercialQualityV2: 95, commercialAppealV2Overall: 95, luxuryCompositionOverall: 95, surfacePatternSuitability: 95, productTargetScore: 95 }),
      makePortfolioRecord({ styleDnaId: 'presetA', absoluteCommercialQualityV2: 60, commercialAppealV2Overall: 60, luxuryCompositionOverall: 60, surfacePatternSuitability: 60, productTargetScore: 60 }),
      makePortfolioRecord({ styleDnaId: 'presetB', absoluteCommercialQualityV2: 80, commercialAppealV2Overall: 80, luxuryCompositionOverall: 80, surfacePatternSuitability: 80, productTargetScore: 80 }),
    ];
    computePortfolioRanking(patterns);
    // presetB's single member ranks 1st within its own preset even though
    // its overall composite (80) is lower than presetA's top member (95).
    expect(patterns[2].rankWithinPreset).toBe(1);
    expect(patterns[2].rankOverall).toBe(2);
  });

  it('assigns percentile buckets consistent with a 100-record top/bottom decile', () => {
    const patterns = Array.from({ length: 100 }, (_, i) => makePortfolioRecord({
      absoluteCommercialQualityV2: i, commercialAppealV2Overall: i, luxuryCompositionOverall: i, surfacePatternSuitability: i, productTargetScore: i,
    }));
    computePortfolioRanking(patterns);
    const sortedByScore = [...patterns].sort((a, b) => (b.compositeRankScore ?? 0) - (a.compositeRankScore ?? 0));
    expect(sortedByScore[0].percentileBucket).toBe('top1');
    expect(sortedByScore[99].percentileBucket).toBe('bottom1');
  });

  it('handles a single-pattern group without dividing by zero', () => {
    const patterns = [makePortfolioRecord()];
    computePortfolioRanking(patterns);
    expect(patterns[0].rankOverall).toBe(1);
    expect(patterns[0].percentileOverall).toBe(100);
  });
});
