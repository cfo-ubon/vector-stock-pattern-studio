import { describe, it, expect } from 'vitest';
import { computeGoldenBalance, computeLuxuryCompositionScore } from './luxuryComposition';
import { buildTile } from './tile';
import { defaultParams } from './defaults';
import { computeMetrics } from './scoring';
import { extractInstances, type MotifInstance } from './svgGeometry';

const TILE = 1000;

function makeInstance(x: number, y: number, overrides: Partial<MotifInstance> = {}): MotifInstance {
  return { x, y, rot: 0, scale: 1, index: 0, nodeCount: 1, ...overrides };
}

describe('computeGoldenBalance (Build 009, Section 7: Luxury Composition Rules)', () => {
  it('returns 100 when there is no hero-role instance (nothing to check)', () => {
    const instances = [makeInstance(500, 500), makeInstance(100, 100, { role: 'filler' })];
    expect(computeGoldenBalance(instances, TILE)).toBe(100);
  });

  it('scores a hero placed exactly on a golden-ratio point at (or near) the maximum', () => {
    const onGoldenPoint = [makeInstance(618, 382, { role: 'hero' })];
    expect(computeGoldenBalance(onGoldenPoint, TILE)).toBe(100);
  });

  it('scores a dead-center hero lower than one on a golden-ratio point', () => {
    const center = [makeInstance(500, 500, { role: 'hero' })];
    const golden = [makeInstance(618, 382, { role: 'hero' })];
    expect(computeGoldenBalance(center, TILE)).toBeLessThan(computeGoldenBalance(golden, TILE));
  });

  it('is wrap-aware (a hero near the tile edge can be close to a golden point through the seam)', () => {
    // (0.382, 0.382) golden point vs. a hero at x=990 (equivalent to -10,
    // i.e. very close to 0 through the wrap) -- should score the same as a
    // hero placed at the unwrapped equivalent position near x=0.
    const wrapped = [makeInstance(TILE * GOLDEN() - TILE, TILE * GOLDEN(), { role: 'hero' })];
    const direct = [makeInstance(TILE * GOLDEN(), TILE * GOLDEN(), { role: 'hero' })];
    expect(computeGoldenBalance(wrapped, TILE)).toBe(computeGoldenBalance(direct, TILE));
  });

  it('averages across multiple hero instances', () => {
    const oneGood = [makeInstance(618, 382, { role: 'hero' })];
    const oneGoodOneCenter = [makeInstance(618, 382, { role: 'hero' }), makeInstance(500, 500, { role: 'hero' })];
    expect(computeGoldenBalance(oneGoodOneCenter, TILE)).toBeLessThan(computeGoldenBalance(oneGood, TILE));
  });

  function GOLDEN(): number {
    return 0.382;
  }
});

describe('computeLuxuryCompositionScore (Build 009, Section 7)', () => {
  it('produces every dimension and overall in [0, 100] for a real tile', () => {
    const tile = buildTile({ ...defaultParams(), categoryId: 'botanical', seed: 'luxury-composition-range' });
    const metrics = computeMetrics(tile);
    const instances = extractInstances(tile);
    const score = computeLuxuryCompositionScore(instances, tile.params.tileSize, metrics);
    for (const key of ['goldenBalance', 'breathingRoom', 'clusterRhythm', 'hierarchyClarity', 'heroIsolation', 'elegantOverlap', 'controlledComplexity', 'overall'] as const) {
      expect(score[key]).toBeGreaterThanOrEqual(0);
      expect(score[key]).toBeLessThanOrEqual(100);
    }
  });

  it('overall is the mean of the 7 real dimensions', () => {
    const tile = buildTile({ ...defaultParams(), categoryId: 'botanical', seed: 'luxury-composition-formula' });
    const metrics = computeMetrics(tile);
    const instances = extractInstances(tile);
    const score = computeLuxuryCompositionScore(instances, tile.params.tileSize, metrics);
    const expected = Math.round(
      (score.goldenBalance + score.breathingRoom + score.clusterRhythm + score.hierarchyClarity + score.heroIsolation + score.elegantOverlap + score.controlledComplexity) / 7,
    );
    expect(score.overall).toBe(expected);
  });

  it('breathingRoom/clusterRhythm/elegantOverlap reuse the exact already-real metric fields', () => {
    const tile = buildTile({ ...defaultParams(), categoryId: 'botanical', seed: 'luxury-composition-reuse' });
    const metrics = computeMetrics(tile);
    const instances = extractInstances(tile);
    const score = computeLuxuryCompositionScore(instances, tile.params.tileSize, metrics);
    expect(score.breathingRoom).toBe(metrics.largestEmptyRegion);
    expect(score.clusterRhythm).toBe(metrics.clusterCohesion);
    expect(score.elegantOverlap).toBe(metrics.overlapQuality);
  });
});
