import { describe, it, expect } from 'vitest';
import { defaultParams } from './defaults';
import { buildTile } from './tile';
import { computeMetrics, computeOverallScore } from './scoring';
import { computeBotanicalBeautyMetrics, BOTANICAL_BEAUTY_DIMENSIONS } from './botanicalBeautyMetrics';
import { resolveStyleDna, STYLE_DNA_PRESETS } from './styleDna';

describe('computeBotanicalBeautyMetrics (Build 004, Section 10)', () => {
  it('produces every named dimension in range [0, 100]', () => {
    const tile = buildTile({ ...defaultParams(), categoryId: 'botanical', seed: 'botanical-beauty-range' });
    const score = computeBotanicalBeautyMetrics(tile, computeMetrics(tile));
    for (const { key } of BOTANICAL_BEAUTY_DIMENSIONS) {
      expect(score[key]).toBeGreaterThanOrEqual(0);
      expect(score[key]).toBeLessThanOrEqual(100);
    }
    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.overall).toBeLessThanOrEqual(100);
  });

  it('is deterministic for the same seed', () => {
    const params = { ...defaultParams(), categoryId: 'botanical', seed: 'botanical-beauty-determinism' };
    const a = computeBotanicalBeautyMetrics(buildTile(params), computeMetrics(buildTile(params)));
    const b = computeBotanicalBeautyMetrics(buildTile(params), computeMetrics(buildTile(params)));
    expect(a).toEqual(b);
  });

  it('overall is the plain average of the 10 named sub-dimensions', () => {
    const tile = buildTile({ ...defaultParams(), categoryId: 'botanical', seed: 'botanical-beauty-overall-formula' });
    const score = computeBotanicalBeautyMetrics(tile, computeMetrics(tile));
    const subScores = BOTANICAL_BEAUTY_DIMENSIONS.map(({ key }) => score[key]);
    const expected = Math.round(subScores.reduce((a, b) => a + b, 0) / subScores.length);
    expect(score.overall).toBe(expected);
  });

  it('flowerHierarchy matches metrics.hierarchy directly', () => {
    const tile = buildTile({ ...defaultParams(), categoryId: 'botanical', seed: 'botanical-beauty-hierarchy' });
    const metrics = computeMetrics(tile);
    const score = computeBotanicalBeautyMetrics(tile, metrics);
    expect(score.flowerHierarchy).toBe(metrics.hierarchy);
  });

  it('naturalGrowth matches metrics.flowCoherence directly', () => {
    const tile = buildTile({ ...defaultParams(), categoryId: 'botanical', seed: 'botanical-beauty-growth' });
    const metrics = computeMetrics(tile);
    const score = computeBotanicalBeautyMetrics(tile, metrics);
    expect(score.naturalGrowth).toBe(metrics.flowCoherence);
  });

  it('clusterHarmony matches metrics.clusterCohesion directly', () => {
    const tile = buildTile({ ...defaultParams(), categoryId: 'botanical', seed: 'botanical-beauty-cluster' });
    const metrics = computeMetrics(tile);
    const score = computeBotanicalBeautyMetrics(tile, metrics);
    expect(score.clusterHarmony).toBe(metrics.clusterCohesion);
  });

  it('assetHarmony matches metrics.colorBalance directly', () => {
    const tile = buildTile({ ...defaultParams(), categoryId: 'botanical', seed: 'botanical-beauty-asset-harmony' });
    const metrics = computeMetrics(tile);
    const score = computeBotanicalBeautyMetrics(tile, metrics);
    expect(score.assetHarmony).toBe(metrics.colorBalance);
  });

  it('commercialAppeal matches the real Absolute Commercial Quality (stockClean) score', () => {
    const tile = buildTile({ ...defaultParams(), categoryId: 'botanical', seed: 'botanical-beauty-commercial' });
    const metrics = computeMetrics(tile);
    const score = computeBotanicalBeautyMetrics(tile, metrics);
    expect(score.commercialAppeal).toBe(computeOverallScore(metrics, 'stockClean').score);
  });

  it('organicFlow matches the average of gridAppearanceScore and rhythmRegularity', () => {
    const tile = buildTile({ ...defaultParams(), categoryId: 'botanical', seed: 'botanical-beauty-organic-flow' });
    const metrics = computeMetrics(tile);
    const score = computeBotanicalBeautyMetrics(tile, metrics);
    expect(score.organicFlow).toBe(Math.round((metrics.gridAppearanceScore + metrics.rhythmRegularity) / 2));
  });

  it('luxuryFeeling matches the average of paletteContrast, colorBalance, and heroDetailRatio', () => {
    const tile = buildTile({ ...defaultParams(), categoryId: 'botanical', seed: 'botanical-beauty-luxury' });
    const metrics = computeMetrics(tile);
    const score = computeBotanicalBeautyMetrics(tile, metrics);
    expect(score.luxuryFeeling).toBe(Math.round((metrics.paletteContrast + metrics.colorBalance + metrics.heroDetailRatio) / 3));
  });

  it('botanicalRealism is higher for a botanical-category tile (real grown structure) than a geometric one', () => {
    const botanicalTile = buildTile({ ...defaultParams(), categoryId: 'botanical', seed: 'botanical-beauty-realism-compare' });
    const geometricTile = buildTile({ ...defaultParams(), categoryId: 'geometric', seed: 'botanical-beauty-realism-compare' });
    const botanicalScore = computeBotanicalBeautyMetrics(botanicalTile, computeMetrics(botanicalTile));
    const geometricScore = computeBotanicalBeautyMetrics(geometricTile, computeMetrics(geometricTile));
    expect(botanicalScore.botanicalRealism).toBeGreaterThan(geometricScore.botanicalRealism);
  });

  it('botanicalComplexity is higher for a premium-hero-enabled tile than the same tile without it', () => {
    const dna = resolveStyleDna(STYLE_DNA_PRESETS.luxuryFloral, 'botanical-beauty-complexity-compare');
    const on = buildTile({ ...defaultParams(), ...dna, premiumHero: true, seed: 'botanical-beauty-complexity-compare' });
    const off = buildTile({ ...defaultParams(), ...dna, premiumHero: false, seed: 'botanical-beauty-complexity-compare' });
    const onScore = computeBotanicalBeautyMetrics(on, computeMetrics(on));
    const offScore = computeBotanicalBeautyMetrics(off, computeMetrics(off));
    expect(onScore.botanicalComplexity).toBeGreaterThan(offScore.botanicalComplexity);
  });

  it('every built-in Style DNA preset produces a valid Botanical Beauty score without throwing', () => {
    for (const dna of Object.values(STYLE_DNA_PRESETS)) {
      const patch = resolveStyleDna(dna, 'botanical-beauty-all-presets');
      const tile = buildTile({ ...defaultParams(), ...patch, seed: 'botanical-beauty-all-presets' });
      expect(() => computeBotanicalBeautyMetrics(tile, computeMetrics(tile))).not.toThrow();
    }
  });
});
