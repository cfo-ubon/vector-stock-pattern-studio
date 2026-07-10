import { describe, it, expect } from 'vitest';
import { buildTile } from './tile';
import { defaultParams } from './defaults';
import { computeQualityScore } from './qualityScore';

describe('computeQualityScore', () => {
  it('is deterministic for the same tile', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'quality-determinism' });
    const a = computeQualityScore(tile);
    const b = computeQualityScore(tile);
    expect(a).toEqual(b);
  });

  it('every sub-score and the overall score is within [0, 100]', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'quality-bounds' });
    const score = computeQualityScore(tile);
    for (const v of Object.values(score)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('reports full seamless integrity for every generated tile (structural guarantee)', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'quality-seamless' });
    expect(computeQualityScore(tile).seamlessIntegrity).toBe(100);
  });

  it('produces different scores for visually different compositions', () => {
    const base = { ...defaultParams(), categoryId: 'botanical', layoutId: 'grid' as const, seed: 'quality-diff' };
    const sparse = computeQualityScore(buildTile({ ...base, density: 0.1, hierarchy: undefined }));
    const dense = computeQualityScore(buildTile({ ...base, density: 0.9, hierarchy: undefined }));
    expect(sparse.composition).not.toBe(dense.composition);
  });
});
