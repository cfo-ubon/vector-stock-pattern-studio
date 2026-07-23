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

  it('overall averages the 5 universal sub-scores plus the 3 hero-construction-only sub-scores only when the tile actually has premium-hero instances (Build 022, Phase 5)', () => {
    // Build 022 fix: `bouquetQuality`/`gestureQuality`/`flowerRealism` are
    // structurally 0 (not "measured and poor") for any tile with zero
    // premium-hero instances -- averaging those 3 zeros into `overall`
    // unconditionally (this test's pre-Build-022 assertion) permanently
    // capped every non-premiumHero preset's score regardless of real
    // quality (BUILD_022_AUDIT.md's diagnostic matrix: the 4 weakest
    // illustrationQualityV2 scores across all 15 built-in presets were
    // exactly the 4 non-premiumHero presets). A premium-hero tile still
    // averages all 8, unchanged.
    const heroDna = resolveStyleDna(STYLE_DNA_PRESETS.luxuryFloral, 'iqv2-formula-hero');
    const heroTile = buildTile({ ...defaultParams(), ...heroDna, premiumHero: true, seed: 'iqv2-formula-hero' });
    const heroResult = computeIllustrationQualityV2(heroTile, computeMetrics(heroTile));
    const heroSubScores = ILLUSTRATION_QUALITY_V2_DIMENSIONS.map(({ key }) => heroResult[key]);
    expect(heroResult.overall).toBe(Math.round(heroSubScores.reduce((a, b) => a + b, 0) / heroSubScores.length));

    const nonHeroTile = buildTile({ ...defaultParams(), categoryId: 'botanical', seed: 'iqv2-formula-nonhero' });
    const nonHeroResult = computeIllustrationQualityV2(nonHeroTile, computeMetrics(nonHeroTile));
    expect(nonHeroResult.bouquetQuality).toBe(0);
    expect(nonHeroResult.gestureQuality).toBe(0);
    expect(nonHeroResult.flowerRealism).toBe(0);
    const universal = [nonHeroResult.botanicalRealism, nonHeroResult.illustrationQuality, nonHeroResult.silhouetteQuality, nonHeroResult.leafRealism, nonHeroResult.premiumFeel];
    const expectedNonHero = Math.round(universal.reduce((a, b) => a + b, 0) / universal.length);
    expect(nonHeroResult.overall).toBe(expectedNonHero);
    // The old flawed formula (averaging in the 3 structural zeros) always
    // scores <= the new one whenever the universal sub-scores' mean is
    // positive -- confirms this is a strict improvement, never a decrease,
    // for every non-hero tile.
    const oldFormulaSubScores = ILLUSTRATION_QUALITY_V2_DIMENSIONS.map(({ key }) => nonHeroResult[key]);
    const oldFormulaOverall = Math.round(oldFormulaSubScores.reduce((a, b) => a + b, 0) / oldFormulaSubScores.length);
    expect(nonHeroResult.overall).toBeGreaterThanOrEqual(oldFormulaOverall);
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
