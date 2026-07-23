import { describe, it, expect } from 'vitest';
import { computeThumbnailLegibility, THUMBNAIL_SCALES } from './thumbnailLegibility';
import type { Placement } from './types';

function place(x: number, y: number, extra: Partial<Placement> = {}): Placement {
  return { x, y, rotationDeg: 0, scale: 1, colorSeed: 0, ...extra };
}

describe('thumbnailLegibility (Build 024, Phase 7)', () => {
  const tileSize = 1600;
  const motifSize = 100;

  it('scores all 4 named scales (1024/512/256/128)', () => {
    const result = computeThumbnailLegibility([place(800, 800, { role: 'hero' })], tileSize, motifSize);
    expect(result.scales.map((s) => s.scale)).toEqual([...THUMBNAIL_SCALES]);
  });

  it('an empty placement list is a perfect, legible score with no failure reasons', () => {
    const result = computeThumbnailLegibility([], tileSize, motifSize);
    expect(result.overallScore).toBe(100);
    expect(result.legibleAtAllScales).toBe(true);
    for (const s of result.scales) expect(s.failureReasons).toHaveLength(0);
  });

  it('flags focalPointVisible: false when the hero shrinks below the legibility floor at 128px', () => {
    const result = computeThumbnailLegibility([place(800, 800, { role: 'hero', scale: 0.02 })], tileSize, motifSize);
    const at128 = result.scales.find((s) => s.scale === 128)!;
    expect(at128.focalPointVisible).toBe(false);
    expect(at128.failureReasons.length).toBeGreaterThan(0);
  });

  it('detects motif merging risk for two instances with a near-zero vector-space gap', () => {
    const result = computeThumbnailLegibility(
      [place(800, 800, { scale: 1 }), place(800 + motifSize + 0.5, 800, { scale: 1 })],
      tileSize,
      motifSize,
    );
    const at128 = result.scales.find((s) => s.scale === 128)!;
    expect(at128.motifMergingRisk).toBeGreaterThan(0);
  });

  it('recommends enlargeHero when the hero is illegible at 128px', () => {
    const result = computeThumbnailLegibility([place(800, 800, { role: 'hero', scale: 0.02 })], tileSize, motifSize);
    expect(result.repairRecommendations).toContain('enlargeHero');
  });

  it('is deterministic — same placements always produce the same result', () => {
    const placements = [place(800, 800, { role: 'hero' }), place(500, 500, { role: 'filler', scale: 0.4 })];
    const a = computeThumbnailLegibility(placements, tileSize, motifSize);
    const b = computeThumbnailLegibility(placements, tileSize, motifSize);
    expect(a).toEqual(b);
  });

  it('a well-separated hero-only tile is legible at every scale', () => {
    const result = computeThumbnailLegibility([place(800, 800, { role: 'hero', scale: 2 })], tileSize, motifSize);
    expect(result.legibleAtAllScales).toBe(true);
  });
});
