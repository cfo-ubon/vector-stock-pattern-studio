import { describe, it, expect } from 'vitest';
import { createRng } from '../engine/rng';
import { poissonDiscPoints } from './shared';

function periodicDist(ax: number, ay: number, bx: number, by: number, tileSize: number) {
  let best = Infinity;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const ddx = ax - (bx + dx * tileSize);
      const ddy = ay - (by + dy * tileSize);
      const d = Math.sqrt(ddx * ddx + ddy * ddy);
      if (d < best) best = d;
    }
  }
  return best;
}

describe('poissonDiscPoints obstacles (Build 003, Part 4)', () => {
  const tileSize = 1000;
  const minDist = 40;

  it('is unaffected when obstacles is omitted (backward compatible)', () => {
    const withoutArg = poissonDiscPoints(tileSize, minDist, 20, createRng('obstacle-compat'));
    const withUndefined = poissonDiscPoints(tileSize, minDist, 20, createRng('obstacle-compat'), undefined, undefined);
    expect(withUndefined).toEqual(withoutArg);
  });

  it('keeps every generated point outside every obstacle radius', () => {
    const obstacles = [
      { x: 500, y: 500, radius: 150 },
      { x: 100, y: 900, radius: 80 },
    ];
    const points = poissonDiscPoints(tileSize, minDist, 40, createRng('obstacle-basic'), undefined, obstacles);
    for (const [x, y] of points) {
      for (const o of obstacles) {
        expect(periodicDist(x, y, o.x, o.y, tileSize)).toBeGreaterThanOrEqual(o.radius);
      }
    }
  });

  it('respects obstacles across the tile wrap seam', () => {
    const obstacles = [{ x: 2, y: 500, radius: 120 }];
    const points = poissonDiscPoints(tileSize, minDist, 30, createRng('obstacle-wrap'), undefined, obstacles);
    for (const [x, y] of points) {
      expect(periodicDist(x, y, obstacles[0].x, obstacles[0].y, tileSize)).toBeGreaterThanOrEqual(obstacles[0].radius);
    }
  });

  it('a large obstacle covering most of the tile still yields a valid (possibly short) result without throwing', () => {
    const obstacles = [{ x: 500, y: 500, radius: 900 }];
    expect(() => poissonDiscPoints(tileSize, minDist, 20, createRng('obstacle-huge'), undefined, obstacles)).not.toThrow();
  });
});
