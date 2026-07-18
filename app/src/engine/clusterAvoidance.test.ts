import { describe, it, expect } from 'vitest';
import { resolveClusterCollisions, TANGENT_AVOIDANCE_MARGIN, type SizedPoint } from './clusterAvoidance';

function pairwiseDist(a: SizedPoint, b: SizedPoint, tileSize: number): number {
  let dx = a.x - b.x;
  let dy = a.y - b.y;
  if (dx > tileSize / 2) dx -= tileSize;
  if (dx < -tileSize / 2) dx += tileSize;
  if (dy > tileSize / 2) dy -= tileSize;
  if (dy < -tileSize / 2) dy += tileSize;
  return Math.sqrt(dx * dx + dy * dy);
}

describe('resolveClusterCollisions', () => {
  const tileSize = 1000;
  const baseRadius = 40;
  const minDistMul = 1.7;

  it('is a no-op when every pair already clears the required separation', () => {
    const points: SizedPoint[] = [
      { x: 100, y: 100, sizeMul: 1.35 },
      { x: 900, y: 900, sizeMul: 1.35 },
    ];
    const result = resolveClusterCollisions(points, baseRadius, minDistMul, tileSize);
    expect(result[0].x).toBeCloseTo(points[0].x, 6);
    expect(result[0].y).toBeCloseTo(points[0].y, 6);
    expect(result[1].x).toBeCloseTo(points[1].x, 6);
    expect(result[1].y).toBeCloseTo(points[1].y, 6);
  });

  it('separates two large ("hero") anchors placed too close together', () => {
    const points: SizedPoint[] = [
      { x: 500, y: 500, sizeMul: 1.35 },
      { x: 510, y: 500, sizeMul: 1.35 },
    ];
    const required = baseRadius * minDistMul * 1.35;
    const before = pairwiseDist(points[0], points[1], tileSize);
    expect(before).toBeLessThan(required);

    const result = resolveClusterCollisions(points, baseRadius, minDistMul, tileSize);
    const after = pairwiseDist(result[0], result[1], tileSize);
    expect(after).toBeGreaterThanOrEqual(required - 1e-6);
  });

  it('leaves a small-anchor pair alone when it already clears their required separation', () => {
    const points: SizedPoint[] = [
      { x: 500, y: 500, sizeMul: 0.62 },
      { x: 550, y: 500, sizeMul: 0.62 },
    ];
    const required = baseRadius * minDistMul * 0.62;
    const before = pairwiseDist(points[0], points[1], tileSize);
    expect(before).toBeGreaterThanOrEqual(required);

    const result = resolveClusterCollisions(points, baseRadius, minDistMul, tileSize);
    expect(result[0].x).toBeCloseTo(points[0].x, 6);
    expect(result[1].x).toBeCloseTo(points[1].x, 6);
  });

  it('resolves collisions across the tile wrap seam', () => {
    const points: SizedPoint[] = [
      { x: 5, y: 500, sizeMul: 1.35 },
      { x: 995, y: 500, sizeMul: 1.35 },
    ];
    const required = baseRadius * minDistMul * 1.35;
    const before = pairwiseDist(points[0], points[1], tileSize);
    expect(before).toBeLessThan(required);

    const result = resolveClusterCollisions(points, baseRadius, minDistMul, tileSize);
    const after = pairwiseDist(result[0], result[1], tileSize);
    expect(after).toBeGreaterThanOrEqual(required - 1e-6);
  });

  it('resolves a cluster of three mutually-close large anchors', () => {
    const points: SizedPoint[] = [
      { x: 500, y: 500, sizeMul: 1.35 },
      { x: 508, y: 500, sizeMul: 1.35 },
      { x: 500, y: 508, sizeMul: 1.35 },
    ];
    const result = resolveClusterCollisions(points, baseRadius, minDistMul, tileSize);
    const required = baseRadius * minDistMul * 1.35;
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        expect(pairwiseDist(result[i], result[j], tileSize)).toBeGreaterThanOrEqual(required - 1e-6);
      }
    }
  });

  it('keeps every point within tile bounds after resolving', () => {
    const points: SizedPoint[] = [
      { x: 500, y: 500, sizeMul: 1.35 },
      { x: 505, y: 502, sizeMul: 1.35 },
    ];
    const result = resolveClusterCollisions(points, baseRadius, minDistMul, tileSize);
    for (const p of result) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(tileSize);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThan(tileSize);
    }
  });

  describe('marginMul (Build 010, Section 6: Professional Illustrator Rules, touching-tangent avoidance)', () => {
    it('default marginMul (1) reproduces the exact pre-Build-010 boundary-distance resolve', () => {
      const points: SizedPoint[] = [
        { x: 500, y: 500, sizeMul: 1.35 },
        { x: 510, y: 500, sizeMul: 1.35 },
      ];
      const withoutArg = resolveClusterCollisions(points, baseRadius, minDistMul, tileSize);
      const explicitOne = resolveClusterCollisions(points, baseRadius, minDistMul, tileSize, 1);
      expect(withoutArg).toEqual(explicitOne);
    });

    it('a marginMul > 1 resolves a colliding pair to real clearance beyond the exact touching boundary', () => {
      const points: SizedPoint[] = [
        { x: 500, y: 500, sizeMul: 1.35 },
        { x: 510, y: 500, sizeMul: 1.35 },
      ];
      const required = baseRadius * minDistMul * 1.35;
      const boundaryResult = resolveClusterCollisions(points, baseRadius, minDistMul, tileSize, 1);
      const marginResult = resolveClusterCollisions(points, baseRadius, minDistMul, tileSize, TANGENT_AVOIDANCE_MARGIN);
      const boundaryDist = pairwiseDist(boundaryResult[0], boundaryResult[1], tileSize);
      const marginDist = pairwiseDist(marginResult[0], marginResult[1], tileSize);
      expect(boundaryDist).toBeCloseTo(required, 5);
      expect(marginDist).toBeGreaterThan(required);
    });

    it('a pair already clear of the plain boundary can still be nudged further apart under a margin', () => {
      // Sits just past the plain `required` boundary but inside the
      // margin-widened one -- the real "just barely touching" case.
      const required = baseRadius * minDistMul * 1.35;
      const points: SizedPoint[] = [
        { x: 500, y: 500, sizeMul: 1.35 },
        { x: 500 + required + 1, y: 500, sizeMul: 1.35 },
      ];
      const boundaryResult = resolveClusterCollisions(points, baseRadius, minDistMul, tileSize, 1);
      expect(boundaryResult[0].x).toBeCloseTo(points[0].x, 6);
      const marginResult = resolveClusterCollisions(points, baseRadius, minDistMul, tileSize, TANGENT_AVOIDANCE_MARGIN);
      const marginDist = pairwiseDist(marginResult[0], marginResult[1], tileSize);
      expect(marginDist).toBeGreaterThan(required + 1);
    });
  });
});
