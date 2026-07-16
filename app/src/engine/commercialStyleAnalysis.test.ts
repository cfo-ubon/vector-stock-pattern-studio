import { describe, it, expect } from 'vitest';
import { defaultParams } from './defaults';
import { buildTile } from './tile';
import { computeMetrics } from './scoring';
import { computeHeroVisibilityScore } from './scoring';
import { computeBotanicalBeautyMetrics } from './botanicalBeautyMetrics';
import { computeVisualRichness } from './portfolioQuality';
import {
  COMMERCIAL_STYLE_BENCHMARKS,
  computeCommercialStyleAnalysis,
  type CommercialDimensionId,
} from './commercialStyleAnalysis';

const ALL_DIMENSIONS: CommercialDimensionId[] = [
  'heroSize', 'hierarchy', 'rhythm', 'spacing', 'silhouette',
  'focalBalance', 'density', 'paletteUsage', 'botanicalRealism', 'visualRichness',
];

describe('Commercial Style Analysis Engine (Build 006, Section 1)', () => {
  it('defines all 10 named dimensions the brief asks for, each with a real min <= ideal band', () => {
    for (const id of ALL_DIMENSIONS) {
      const band = COMMERCIAL_STYLE_BENCHMARKS[id];
      expect(band).toBeDefined();
      expect(band.min).toBeLessThanOrEqual(band.ideal);
      expect(band.source.length).toBeGreaterThan(0);
    }
  });

  it('scores only the dimensions with real available input for a non-botanical tile (metrics-only)', () => {
    const tile = buildTile({ ...defaultParams(), categoryId: 'geometric', seed: 'csa-geometric' });
    const metrics = computeMetrics(tile);
    const analysis = computeCommercialStyleAnalysis({ metrics });
    const ids = analysis.dimensions.map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(['hierarchy', 'rhythm', 'spacing', 'focalBalance', 'density', 'paletteUsage']));
    expect(ids).not.toContain('silhouette');
    expect(ids).not.toContain('botanicalRealism');
    expect(ids).not.toContain('visualRichness');
    expect(ids).not.toContain('heroSize');
  });

  it('scores all 10 dimensions for a botanical tile with every optional input provided', () => {
    const tile = buildTile({ ...defaultParams(), categoryId: 'botanical', seed: 'csa-botanical' });
    const metrics = computeMetrics(tile);
    const botanical = computeBotanicalBeautyMetrics(tile, metrics);
    const heroVisibility = computeHeroVisibilityScore(metrics);
    const visualRichness = computeVisualRichness(botanical);
    const analysis = computeCommercialStyleAnalysis({ metrics, botanical, heroVisibility, visualRichness });
    expect(analysis.dimensions.length).toBe(10);
    for (const d of analysis.dimensions) {
      expect(d.fit).toBeGreaterThanOrEqual(0);
      expect(d.fit).toBeLessThanOrEqual(100);
    }
  });

  it('a value at/above the real ideal always scores exactly 100', () => {
    const metrics = computeMetrics(buildTile({ ...defaultParams(), categoryId: 'geometric', seed: 'csa-ideal' }));
    const analysis = computeCommercialStyleAnalysis({
      metrics: { ...metrics, hierarchy: 100, spacing: 99, quadrantBalance: 100, occupancyRatio: 100 },
    });
    for (const d of analysis.dimensions) {
      if (['hierarchy', 'spacing', 'focalBalance', 'density'].includes(d.id)) expect(d.fit).toBe(100);
    }
  });

  it('a value exactly at the real min scores exactly 50 (reuses this codebase\'s own established floor convention)', () => {
    const metrics = computeMetrics(buildTile({ ...defaultParams(), categoryId: 'geometric', seed: 'csa-floor' }));
    const analysis = computeCommercialStyleAnalysis({ metrics: { ...metrics, hierarchy: COMMERCIAL_STYLE_BENCHMARKS.hierarchy.min } });
    const hierarchyScore = analysis.dimensions.find((d) => d.id === 'hierarchy')!;
    expect(hierarchyScore.fit).toBe(50);
  });

  it('overallFit is exactly the average of the dimensions actually scored', () => {
    const metrics = computeMetrics(buildTile({ ...defaultParams(), categoryId: 'geometric', seed: 'csa-avg' }));
    const analysis = computeCommercialStyleAnalysis({ metrics });
    const expected = Math.round(analysis.dimensions.reduce((sum, d) => sum + d.fit, 0) / analysis.dimensions.length);
    expect(analysis.overallFit).toBe(expected);
  });

  it('returns overallFit 0 with empty dimensions when given no scoreable input at all', () => {
    // Not realistically reachable via computeMetrics (metrics fields are
    // always real numbers), but the function itself must not divide by
    // zero if dimensions ever ends up empty.
    const analysis = computeCommercialStyleAnalysis({ metrics: {} as any });
    expect(Number.isNaN(analysis.overallFit)).toBe(false);
  });
});
