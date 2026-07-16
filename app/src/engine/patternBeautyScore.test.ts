import { describe, it, expect } from 'vitest';
import { defaultParams } from './defaults';
import { buildTile } from './tile';
import { computeMetrics, computeOverallScore } from './scoring';
import { computePatternBeautyScore, PATTERN_BEAUTY_DIMENSIONS } from './patternBeautyScore';

describe('computePatternBeautyScore (Build 003, Part 12)', () => {
  it('produces every named dimension in range [0, 100]', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'beauty-score-range' });
    const score = computePatternBeautyScore(computeMetrics(tile));
    for (const { key } of PATTERN_BEAUTY_DIMENSIONS) {
      expect(score[key]).toBeGreaterThanOrEqual(0);
      expect(score[key]).toBeLessThanOrEqual(100);
    }
    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.overall).toBeLessThanOrEqual(100);
  });

  it('is deterministic for the same seed', () => {
    const params = { ...defaultParams(), seed: 'beauty-score-determinism' };
    const a = computePatternBeautyScore(computeMetrics(buildTile(params)));
    const b = computePatternBeautyScore(computeMetrics(buildTile(params)));
    expect(a).toEqual(b);
  });

  it('overall is the plain average of the 10 named sub-dimensions', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'beauty-score-overall-formula' });
    const score = computePatternBeautyScore(computeMetrics(tile));
    const subScores = PATTERN_BEAUTY_DIMENSIONS.map(({ key }) => score[key]);
    const expected = Math.round(subScores.reduce((a, b) => a + b, 0) / subScores.length);
    expect(score.overall).toBe(expected);
  });

  it('commercialLook matches the real Absolute Commercial Quality (stockClean) score', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'beauty-score-commercial-look' });
    const metrics = computeMetrics(tile);
    const score = computePatternBeautyScore(metrics);
    expect(score.commercialLook).toBe(computeOverallScore(metrics, 'stockClean').score);
  });

  it('spacing matches metrics.spacing directly', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'beauty-score-spacing' });
    const metrics = computeMetrics(tile);
    const score = computePatternBeautyScore(metrics);
    expect(score.spacing).toBe(metrics.spacing);
  });

  it('clusterQuality matches metrics.clusterCohesion directly', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'beauty-score-cluster' });
    const metrics = computeMetrics(tile);
    const score = computePatternBeautyScore(metrics);
    expect(score.clusterQuality).toBe(metrics.clusterCohesion);
  });

  it('repeatQuality matches the average of seamlessIntegrity and cornerContinuity', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'beauty-score-repeat' });
    const metrics = computeMetrics(tile);
    const score = computePatternBeautyScore(metrics);
    expect(score.repeatQuality).toBe(Math.round((metrics.seamlessIntegrity + metrics.cornerContinuity) / 2));
  });

  it('designerFeel is the average of rotationDiversity/scaleDiversity/gridAppearanceScore/spacingUniformity', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'beauty-score-designer-feel' });
    const metrics = computeMetrics(tile);
    const score = computePatternBeautyScore(metrics);
    const expected = Math.round(
      (metrics.rotationDiversity + metrics.scaleDiversity + metrics.gridAppearanceScore + metrics.spacingUniformity) / 4,
    );
    expect(score.designerFeel).toBe(expected);
  });

  it('computes cleanly across every layout without throwing', () => {
    const layouts = ['scatter', 'bouquet', 'toss', 'sCurve', 'heroFlow', 'heroScatter', 'densePremium', 'radial', 'airy'] as const;
    for (const layoutId of layouts) {
      const tile = buildTile({ ...defaultParams(), layoutId, seed: `beauty-score-layout-${layoutId}` });
      expect(() => computePatternBeautyScore(computeMetrics(tile))).not.toThrow();
    }
  });
});
