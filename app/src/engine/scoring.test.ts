import { describe, it, expect } from 'vitest';
import { buildTile } from './tile';
import { defaultParams } from './defaults';
import { computeMetrics, computeOverallScore, applySoftPenalties, SOFT_PENALTY_RULES, QUALITY_PRESET_WEIGHTS, type QualityPresetId, type CompositionMetrics } from './scoring';

const PRESETS = Object.keys(QUALITY_PRESET_WEIGHTS) as QualityPresetId[];

describe('computeMetrics', () => {
  it('is deterministic for the same tile', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'metrics-det' });
    expect(computeMetrics(tile)).toEqual(computeMetrics(tile));
  });

  it('every metric is within [0, 100]', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'metrics-bounds' });
    const metrics = computeMetrics(tile);
    for (const v of Object.values(metrics)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('seamlessIntegrity is always 100 (structural guarantee)', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'metrics-seamless' });
    expect(computeMetrics(tile).seamlessIntegrity).toBe(100);
  });

  it('svgHealth is 100 for a normally generated tile (no NaN/raster/duplicate ids)', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'metrics-health' });
    expect(computeMetrics(tile).svgHealth).toBe(100);
  });

  it('paletteContrast responds to the actual palette colors used', () => {
    const base = { ...defaultParams(), seed: 'contrast-check' };
    const monochrome = computeMetrics(buildTile({ ...base, customColors: ['#808080', '#808080', '#808080'] }));
    const highContrast = computeMetrics(buildTile({ ...base, customColors: ['#000000', '#ffffff', '#ff0000'] }));
    expect(highContrast.paletteContrast).toBeGreaterThan(monochrome.paletteContrast);
  });

  it('produces different composition scores for visually different densities', () => {
    const base = { ...defaultParams(), categoryId: 'botanical', layoutId: 'grid' as const, seed: 'metrics-density', hierarchy: undefined };
    const sparse = computeMetrics(buildTile({ ...base, density: 0.1 }));
    const dense = computeMetrics(buildTile({ ...base, density: 0.9 }));
    expect(sparse.composition).not.toBe(dense.composition);
  });

  it('largestEmptyRegion detects a genuinely large hole (sparse large-motif scatter)', () => {
    // Grid layout saturates the coarse occupancy grid at almost any
    // density (motifs are distributed across the whole tile by
    // construction), so it never shows a real hole regardless of density —
    // scatter with a large motif size and very low density is what
    // actually produces a big contiguous empty region to detect.
    const base = { ...defaultParams(), categoryId: 'geometric', layoutId: 'scatter' as const, motifSize: 200, hierarchy: undefined };
    const sparse = computeMetrics(buildTile({ ...base, density: 0.02, seed: 'empty-region-sparse' }));
    const dense = computeMetrics(buildTile({ ...base, density: 0.9, seed: 'empty-region-dense' }));
    expect(sparse.largestEmptyRegion).toBeLessThan(dense.largestEmptyRegion);
  });

  it('heroSeparation is neutral (100) when there are 0 or 1 hero-role instances', () => {
    // Default hierarchy on a grid layout assigns hero/secondary/filler/accent
    // roles, but with hierarchy disabled entirely there is no hero role at
    // all, so separation has nothing to measure.
    const tile = buildTile({ ...defaultParams(), hierarchy: undefined, seed: 'hero-sep-none' });
    expect(computeMetrics(tile).heroSeparation).toBe(100);
  });
});

describe('applySoftPenalties', () => {
  const base = computeMetrics(buildTile({ ...defaultParams(), seed: 'soft-penalty-base' }));

  it('deducts nothing when no rule is triggered', () => {
    const healthy: CompositionMetrics = { ...base, quadrantBalance: 90, largestEmptyRegion: 90, heroSeparation: 90, adjacencyRepetition: 90, edgeDensity: 90, paletteContrast: 90 };
    const { score, penalties } = applySoftPenalties(healthy, 80);
    expect(penalties.length).toBe(0);
    expect(score).toBe(80);
  });

  it('deducts real points for each triggered rule, stacking multiple', () => {
    const bad: CompositionMetrics = { ...base, quadrantBalance: 10, largestEmptyRegion: 10, heroSeparation: 90, adjacencyRepetition: 90, edgeDensity: 90, paletteContrast: 90 };
    const { score, penalties } = applySoftPenalties(bad, 80);
    expect(penalties.length).toBe(2);
    const expectedDeduction = penalties.reduce((a, p) => a + p.points, 0);
    expect(score).toBe(80 - expectedDeduction);
  });

  it('never drops the score below 0', () => {
    const worst: CompositionMetrics = { ...base, quadrantBalance: 0, largestEmptyRegion: 0, heroSeparation: 0, adjacencyRepetition: 0, edgeDensity: 0, paletteContrast: 0 };
    const { score } = applySoftPenalties(worst, 5);
    expect(score).toBe(0);
  });

  it('every rule is deterministic and checks a real metric field', () => {
    for (const rule of SOFT_PENALTY_RULES) {
      expect(rule.check(base)).toBe(rule.check(base));
      expect(typeof rule.points).toBe('number');
      expect(rule.points).toBeGreaterThan(0);
    }
  });
});

describe('computeOverallScore', () => {
  const tile = buildTile({ ...defaultParams(), seed: 'overall-score' });
  const metrics = computeMetrics(tile);

  it('is deterministic and within [0, 100] for every preset', () => {
    for (const preset of PRESETS) {
      const a = computeOverallScore(metrics, preset);
      const b = computeOverallScore(metrics, preset);
      expect(a.score).toBe(b.score);
      expect(a.score).toBeGreaterThanOrEqual(0);
      expect(a.score).toBeLessThanOrEqual(100);
    }
  });

  it('flags low-scoring weighted metrics as penalty reasons', () => {
    const badMetrics = { ...metrics, svgHealth: 10, composition: 5 };
    const { penaltyReasons } = computeOverallScore(badMetrics, 'stockClean');
    expect(penaltyReasons.length).toBeGreaterThan(0);
    expect(penaltyReasons.some((r) => r.includes('SVG technical health'))).toBe(true);
  });

  it('every preset weight set only references keys that exist on CompositionMetrics', () => {
    for (const preset of PRESETS) {
      const weights = QUALITY_PRESET_WEIGHTS[preset];
      for (const key of Object.keys(weights)) {
        expect(Object.prototype.hasOwnProperty.call(metrics, key)).toBe(true);
      }
    }
  });

  it('applies soft-penalty deductions on top of the weighted average, and reports them', () => {
    const triggering = { ...metrics, quadrantBalance: 5, largestEmptyRegion: 5 };
    const { score: penalizedScore, penaltyReasons } = computeOverallScore(triggering, 'stockClean');
    const { score: cleanScore } = computeOverallScore({ ...metrics, quadrantBalance: 100, largestEmptyRegion: 100 }, 'stockClean');
    expect(penalizedScore).toBeLessThan(cleanScore);
    expect(penaltyReasons.some((r) => r.includes('soft penalty'))).toBe(true);
  });
});
