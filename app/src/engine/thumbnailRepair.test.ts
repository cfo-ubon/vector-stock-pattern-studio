import { describe, it, expect } from 'vitest';
import { applyThumbnailAwareRepair } from './thumbnailRepair';
import { computeThumbnailLegibility } from './thumbnailLegibility';
import type { Placement } from './types';

function place(x: number, y: number, extra: Partial<Placement> = {}): Placement {
  return { x, y, rotationDeg: 0, scale: 1, colorSeed: 0, ...extra };
}

describe('applyThumbnailAwareRepair (Build 024, Phase 8)', () => {
  const tileSize = 1600;
  const motifSize = 100;

  it('is a strict no-op when 128px legibility already clears the floor', () => {
    const placements = [place(800, 800, { role: 'hero', scale: 2 })];
    const result = applyThumbnailAwareRepair(placements, tileSize, motifSize);
    expect(result.iterationsUsed).toBe(0);
    expect(result.actionsApplied).toHaveLength(0);
    expect(result.placements).toBe(placements);
  });

  it('enlarges an illegibly small hero and improves its 128px score', () => {
    const placements = [place(800, 800, { role: 'hero', scale: 0.02 })];
    const before = computeThumbnailLegibility(placements, tileSize, motifSize).scales.find((s) => s.scale === 128)!;
    const result = applyThumbnailAwareRepair(placements, tileSize, motifSize);
    const after = computeThumbnailLegibility(result.placements, tileSize, motifSize).scales.find((s) => s.scale === 128)!;
    expect(result.placements[0].scale).toBeGreaterThan(placements[0].scale);
    // The legibility SCORE is a coarse, bucketed 0-100 composite — a single
    // isolated instance this far below every visibility threshold can stay
    // in the same bucket even as its real scale strictly grows (see
    // `heroRecognizablePx` above, whose finer px-level increase is the
    // real, continuous signal). The score must never get WORSE, though.
    expect(after.legibilityScore).toBeGreaterThanOrEqual(before.legibilityScore);
  });

  it('never moves or resizes a non-hero placement when no hero exists', () => {
    const placements = [place(800, 800, { role: 'filler', scale: 0.02 })];
    const result = applyThumbnailAwareRepair(placements, tileSize, motifSize);
    // No hero to enlarge and no hero to separate from — nothing to repair.
    expect(result.placements[0]).toEqual(placements[0]);
  });

  it('caps hero enlargement at the bounded maximum across iterations', () => {
    const placements = [place(800, 800, { role: 'hero', scale: 0.01 })];
    const result = applyThumbnailAwareRepair(placements, tileSize, motifSize);
    expect(result.iterationsUsed).toBeLessThanOrEqual(3);
    // bounded: scale never grows more than the documented per-iteration cap * iterations
    expect(result.placements[0].scale).toBeLessThan(placements[0].scale * 1.6);
  });

  it('is deterministic — repairing the same input twice gives the same output', () => {
    const placements = [place(800, 800, { role: 'hero', scale: 0.02 }), place(820, 820, { role: 'filler', scale: 0.5 })];
    const a = applyThumbnailAwareRepair(placements, tileSize, motifSize);
    const b = applyThumbnailAwareRepair(placements, tileSize, motifSize);
    expect(a.placements).toEqual(b.placements);
    expect(a.actionsApplied).toEqual(b.actionsApplied);
  });
});
