import { describe, it, expect } from 'vitest';
import { defaultParams } from './defaults';
import { computeMetrics, computeHeroVisibilityScore } from './scoring';
import { buildTile } from './tile';
import { buildTileWithHeroRetry } from './heroDetector';

describe('buildTileWithHeroRetry (Build 003, Part 11)', () => {
  it('is deterministic for the same seed', () => {
    const params = { ...defaultParams(), seed: 'hero-retry-determinism' };
    const a = buildTileWithHeroRetry(params);
    const b = buildTileWithHeroRetry(params);
    expect(a.heroVisibilityScore).toBe(b.heroVisibilityScore);
    expect(a.attempts).toBe(b.attempts);
  });

  it('never returns a lower Hero Visibility Score than the plain first attempt', () => {
    for (let i = 0; i < 15; i++) {
      const params = { ...defaultParams(), seed: `hero-retry-floor-${i}` };
      const plain = buildTile(params);
      const plainScore = computeHeroVisibilityScore(computeMetrics(plain));
      const result = buildTileWithHeroRetry(params);
      expect(result.heroVisibilityScore).toBeGreaterThanOrEqual(plainScore - 1e-9);
    }
  });

  it('stops at the first attempt when it already clears the threshold', () => {
    for (let i = 0; i < 15; i++) {
      const params = { ...defaultParams(), seed: `hero-retry-early-stop-${i}` };
      const plain = buildTile(params);
      const plainScore = computeHeroVisibilityScore(computeMetrics(plain));
      if (plainScore < 55) continue;
      const result = buildTileWithHeroRetry(params);
      expect(result.attempts).toBe(1);
      expect(result.regenerated).toBe(false);
    }
  });

  it('never exceeds maxAttempts', () => {
    for (let i = 0; i < 10; i++) {
      const params = { ...defaultParams(), seed: `hero-retry-bound-${i}` };
      const result = buildTileWithHeroRetry(params, 3);
      expect(result.attempts).toBeLessThanOrEqual(3);
    }
  });

  it('respects a custom maxAttempts', () => {
    const params = { ...defaultParams(), seed: 'hero-retry-custom-max' };
    const result = buildTileWithHeroRetry(params, 1);
    expect(result.attempts).toBe(1);
  });

  it('returns a tileData that matches the reported best score', () => {
    const params = { ...defaultParams(), seed: 'hero-retry-consistency' };
    const result = buildTileWithHeroRetry(params);
    const recomputed = computeHeroVisibilityScore(computeMetrics(result.tileData));
    expect(recomputed).toBeCloseTo(result.heroVisibilityScore, 6);
  });

  it('exposes the winning attempt\'s own metrics, matching a fresh computeMetrics call', () => {
    const params = { ...defaultParams(), seed: 'hero-retry-metrics-exposed' };
    const result = buildTileWithHeroRetry(params);
    const recomputed = computeMetrics(result.tileData);
    expect(result.metrics).toEqual(recomputed);
  });

  it('produces a valid, renderable tile even when it never clears the threshold', () => {
    // A hierarchy-exempt-ish combination (bouquet already builds its own
    // tiers) shouldn't ever crash the retry loop even if it can't improve.
    const params = { ...defaultParams(), layoutId: 'bouquet' as const, seed: 'hero-retry-no-improve' };
    expect(() => buildTileWithHeroRetry(params)).not.toThrow();
  });
});
