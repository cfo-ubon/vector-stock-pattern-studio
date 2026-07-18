import { describe, expect, it } from 'vitest';
import { computePortfolioClusters } from './clustering';
import { computePortfolioRanking } from './ranking';
import { makePortfolioRecord } from './testFixtures';

const LABELS = { stockClean: 'Stock Clean', premiumTextile: 'Premium Textile' };

describe('computePortfolioClusters', () => {
  it('groups patterns by (styleDnaId, layoutClass) into a single "mid" band when the segment is small', () => {
    const patterns = [
      makePortfolioRecord({ styleDnaId: 'stockClean', layoutClass: 'lattice' }),
      makePortfolioRecord({ styleDnaId: 'stockClean', layoutClass: 'lattice' }),
    ];
    computePortfolioRanking(patterns);
    const summaries = computePortfolioClusters(patterns, LABELS);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].scoreBand).toBe('mid');
    expect(summaries[0].size).toBe(2);
    expect(patterns[0].clusterId).toBe(summaries[0].clusterId);
  });

  it('splits a large segment into top/mid/bottom thirds by measured score', () => {
    const patterns = Array.from({ length: 12 }, (_, i) => makePortfolioRecord({
      styleDnaId: 'stockClean', layoutClass: 'lattice',
      absoluteCommercialQualityV2: i * 8, commercialAppealV2Overall: i * 8, luxuryCompositionOverall: i * 8, surfacePatternSuitability: i * 8, productTargetScore: i * 8,
    }));
    computePortfolioRanking(patterns);
    const summaries = computePortfolioClusters(patterns, LABELS);
    const bands = summaries.map((s) => s.scoreBand).sort();
    expect(bands).toEqual(['bottom', 'mid', 'top']);
    const topCluster = summaries.find((s) => s.scoreBand === 'top')!;
    // top third = 4 highest-scoring of the 12 (indices 8..11).
    expect(topCluster.size).toBe(4);
    expect(topCluster.avgCompositeRankScore).toBeGreaterThan(summaries.find((s) => s.scoreBand === 'bottom')!.avgCompositeRankScore);
  });

  it('keeps separate segments for different styleDnaId/layoutClass combinations', () => {
    const patterns = [
      makePortfolioRecord({ styleDnaId: 'stockClean', layoutClass: 'lattice' }),
      makePortfolioRecord({ styleDnaId: 'premiumTextile', layoutClass: 'organic' }),
    ];
    computePortfolioRanking(patterns);
    const summaries = computePortfolioClusters(patterns, LABELS);
    expect(summaries).toHaveLength(2);
    expect(patterns[0].clusterId).not.toBe(patterns[1].clusterId);
  });

  it('produces a human-readable label including the real style label and layout class', () => {
    const patterns = [makePortfolioRecord({ styleDnaId: 'premiumTextile', layoutClass: 'organic' })];
    computePortfolioRanking(patterns);
    const summaries = computePortfolioClusters(patterns, LABELS);
    expect(summaries[0].label).toContain('Premium Textile');
    expect(summaries[0].label).toContain('organic');
  });

  it('falls back to the raw id when no label is supplied', () => {
    const patterns = [makePortfolioRecord({ styleDnaId: 'unknownPreset' })];
    computePortfolioRanking(patterns);
    const summaries = computePortfolioClusters(patterns, {});
    expect(summaries[0].label).toContain('unknownPreset');
  });

  it('reports dominant failure modes and strength tags per cluster', () => {
    const patterns = [
      makePortfolioRecord({ styleDnaId: 'stockClean', failureModes: ['gridAppearance'] }),
      makePortfolioRecord({ styleDnaId: 'stockClean', failureModes: ['gridAppearance'] }),
      makePortfolioRecord({ styleDnaId: 'stockClean', failureModes: ['weakHierarchy'] }),
    ];
    computePortfolioRanking(patterns);
    const summaries = computePortfolioClusters(patterns, LABELS);
    expect(summaries[0].dominantFailureModes[0]).toEqual({ value: 'gridAppearance', count: 2 });
  });
});
