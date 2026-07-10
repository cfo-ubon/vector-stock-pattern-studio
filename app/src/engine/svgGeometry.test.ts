import { describe, it, expect } from 'vitest';
import { buildTile } from './tile';
import { defaultParams } from './defaults';
import { extractInstances, gridCoverage, periodicDist, countNodes } from './svgGeometry';

describe('extractInstances', () => {
  it('is deterministic and returns one instance per placement', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'geometry-det' });
    const a = extractInstances(tile);
    const b = extractInstances(tile);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it('every instance has finite position/rotation/scale', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'geometry-finite' });
    for (const inst of extractInstances(tile)) {
      expect(Number.isFinite(inst.x)).toBe(true);
      expect(Number.isFinite(inst.y)).toBe(true);
      expect(Number.isFinite(inst.rot)).toBe(true);
      expect(Number.isFinite(inst.scale)).toBe(true);
      expect(inst.scale).toBeGreaterThan(0);
    }
  });

  it('carries data-role onto instances when the Hierarchy Engine assigned one', () => {
    const tile = buildTile({ ...defaultParams(), layoutId: 'scatter', seed: 'geometry-role' });
    const instances = extractInstances(tile);
    const roles = new Set(instances.map((i) => i.role).filter(Boolean));
    expect(roles.size).toBeGreaterThan(0);
  });
});

describe('periodicDist', () => {
  it('finds the wrapped distance when it is shorter than the direct one', () => {
    const tileSize = 100;
    const a = { x: 2, y: 50 };
    const b = { x: 98, y: 50 };
    // Direct distance is 96; wrapped (via the left-edge copy) is 4.
    expect(periodicDist(a, b, tileSize)).toBeCloseTo(4, 5);
  });

  it('is symmetric', () => {
    const tileSize = 200;
    const a = { x: 10, y: 20 };
    const b = { x: 150, y: 180 };
    expect(periodicDist(a, b, tileSize)).toBeCloseTo(periodicDist(b, a, tileSize), 5);
  });
});

describe('gridCoverage', () => {
  it('reports full occupancy for one instance per cell', () => {
    const tileSize = 80;
    const gridN = 4;
    const cell = tileSize / gridN;
    const instances = [];
    for (let gy = 0; gy < gridN; gy++) {
      for (let gx = 0; gx < gridN; gx++) {
        instances.push({ x: gx * cell + cell / 2, y: gy * cell + cell / 2 });
      }
    }
    const cov = gridCoverage(instances, tileSize, gridN);
    expect(cov.occupancyRatio).toBe(1);
    expect(cov.avgPerTouchedCell).toBe(1);
  });

  it('reports zero occupancy for no instances', () => {
    const cov = gridCoverage([], 100, 8);
    expect(cov.occupancyRatio).toBe(0);
  });
});

describe('countNodes', () => {
  it('counts a tree correctly', () => {
    const tree = { tag: 'g' as const, children: [{ tag: 'path' as const }, { tag: 'g' as const, children: [{ tag: 'circle' as const }] }] };
    expect(countNodes(tree)).toBe(4);
  });

  it('counts a single leaf node as 1', () => {
    expect(countNodes({ tag: 'path' as const })).toBe(1);
  });
});
