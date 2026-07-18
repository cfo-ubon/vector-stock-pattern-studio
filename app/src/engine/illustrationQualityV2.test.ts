import { describe, it, expect } from 'vitest';
import { defaultParams } from './defaults';
import { buildTile } from './tile';
import { computeMetrics } from './scoring';
import { resolveStyleDna } from './styleDna';
import { STYLE_DNA_PRESETS } from './styleDna';
import { computeIllustrationQualityV2, ILLUSTRATION_QUALITY_V2_DIMENSIONS } from './illustrationQualityV2';

describe('computeIllustrationQualityV2 (Build 007, Section 8)', () => {
  it('produces every sub-score and overall in [0, 100] for a plain botanical tile', () => {
    const tile = buildTile({ ...defaultParams(), categoryId: 'botanical', seed: 'iqv2-range' });
    const result = computeIllustrationQualityV2(tile, computeMetrics(tile));
    for (const { key } of ILLUSTRATION_QUALITY_V2_DIMENSIONS) {
      expect(result[key]).toBeGreaterThanOrEqual(0);
      expect(result[key]).toBeLessThanOrEqual(100);
    }
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(100);
  });

  it('overall is exactly the average of the 8 sub-scores', () => {
    const tile = buildTile({ ...defaultParams(), categoryId: 'botanical', seed: 'iqv2-formula' });
    const result = computeIllustrationQualityV2(tile, computeMetrics(tile));
    const subScores = ILLUSTRATION_QUALITY_V2_DIMENSIONS.map(({ key }) => result[key]);
    const expected = Math.round(subScores.reduce((a, b) => a + b, 0) / subScores.length);
    expect(result.overall).toBe(expected);
  });

  it('bouquetQuality/gestureQuality/flowerRealism are 0 for a non-botanical tile', () => {
    const tile = buildTile({ ...defaultParams(), categoryId: 'geometric', seed: 'iqv2-non-botanical' });
    const result = computeIllustrationQualityV2(tile, computeMetrics(tile));
    expect(result.bouquetQuality).toBe(0);
    expect(result.gestureQuality).toBe(0);
    expect(result.flowerRealism).toBe(0);
  });

  it('gestureQuality/flowerRealism/bouquetQuality are higher for a premium-hero-enabled tile than the same tile without it', () => {
    const dna = resolveStyleDna(STYLE_DNA_PRESETS.luxuryFloral, 'iqv2-premium-compare');
    const on = buildTile({ ...defaultParams(), ...dna, premiumHero: true, seed: 'iqv2-premium-compare' });
    const off = buildTile({ ...defaultParams(), ...dna, premiumHero: false, seed: 'iqv2-premium-compare' });
    const onScore = computeIllustrationQualityV2(on, computeMetrics(on));
    const offScore = computeIllustrationQualityV2(off, computeMetrics(off));
    expect(onScore.gestureQuality).toBeGreaterThan(offScore.gestureQuality);
    expect(onScore.flowerRealism).toBeGreaterThanOrEqual(offScore.flowerRealism);
  });

  it('leafRealism is positive for a real leaf-bearing botanical tile (real pinnate veins, not a flat shape)', () => {
    // Both premium-hero and ordinary botanical leaves already carry real
    // pinnate venation (Build 004/005 gave `leafNode()` veins; Build 007,
    // Section 2 closed the one remaining gap -- the hero's OWN leaves,
    // which previously used a flat, vein-less `simpleLeafPath`). So this
    // checks the metric reads a real, non-zero vein signal rather than
    // asserting one config beats another when both now carry real veins.
    const tile = buildTile({ ...defaultParams(), categoryId: 'botanical', seed: 'iqv2-leaf-positive' });
    const result = computeIllustrationQualityV2(tile, computeMetrics(tile));
    expect(result.leafRealism).toBeGreaterThan(0);
  });

  it('every built-in Style DNA preset produces a valid score without throwing', () => {
    for (const dna of Object.values(STYLE_DNA_PRESETS)) {
      const patch = resolveStyleDna(dna, 'iqv2-all-presets');
      const tile = buildTile({ ...defaultParams(), ...patch, seed: 'iqv2-all-presets' });
      expect(() => computeIllustrationQualityV2(tile, computeMetrics(tile))).not.toThrow();
    }
  });
});
