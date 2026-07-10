import { describe, it, expect } from 'vitest';
import { buildTile } from './tile';
import { defaultParams } from './defaults';
import { computeMetrics, computeOverallScore, QUALITY_PRESET_WEIGHTS, type QualityPresetId } from './scoring';

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
});
