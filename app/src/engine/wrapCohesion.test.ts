import { describe, it, expect } from 'vitest';
import type { Placement } from './types';
import { computeWrapCohesion } from './wrapCohesion';

const TILE_SIZE = 1200;
const THRESHOLD = 60;

function p(x: number, y: number, clusterId: number): Placement {
  return { x, y, rotationDeg: 0, scale: 1, colorSeed: 0, clusterId };
}

describe('computeWrapCohesion', () => {
  it('detects real left-right seam continuity between two different clusters (not a bounding-box guess)', () => {
    const placements = [p(1190, 600, 0), p(5, 600, 1)];
    const result = computeWrapCohesion(placements, TILE_SIZE, THRESHOLD);
    expect(result.leftRightContinuity).toBe(true);
    expect(result.falsePositiveWrapPairs).toBe(0);
  });

  it('rejects a left-right bounding-box "wrap" whose real member distance is too large, counting it as a false positive instead of continuity', () => {
    const placements = [p(1190, 50, 0), p(5, 900, 1)];
    const result = computeWrapCohesion(placements, TILE_SIZE, THRESHOLD);
    expect(result.leftRightContinuity).toBe(false);
    expect(result.falsePositiveWrapPairs).toBeGreaterThanOrEqual(1);
  });

  it('detects real top-bottom seam continuity between two different clusters', () => {
    const placements = [p(600, 1190, 0), p(600, 5, 1)];
    const result = computeWrapCohesion(placements, TILE_SIZE, THRESHOLD);
    expect(result.topBottomContinuity).toBe(true);
  });

  it('detects corner-only continuity distinctly from the per-axis LR/TB checks (and flags both axes as false positives)', () => {
    const placements = [p(1190, 1190, 0), p(5, 5, 1)];
    const result = computeWrapCohesion(placements, TILE_SIZE, THRESHOLD);
    expect(result.cornerContinuity).toBe(true);
    expect(result.leftRightContinuity).toBe(false);
    expect(result.topBottomContinuity).toBe(false);
    expect(result.falsePositiveWrapPairs).toBe(2);
  });

  it('reports no continuity and no false positives when there is only one cluster (nothing to compare across the seam)', () => {
    const placements = [p(1190, 1190, 0), p(1170, 1170, 0)];
    const result = computeWrapCohesion(placements, TILE_SIZE, THRESHOLD);
    expect(result.leftRightContinuity).toBe(false);
    expect(result.topBottomContinuity).toBe(false);
    expect(result.cornerContinuity).toBe(false);
    expect(result.falsePositiveWrapPairs).toBe(0);
  });
});
