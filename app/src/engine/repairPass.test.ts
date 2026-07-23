import { describe, it, expect } from 'vitest';
import { applyBouquetRepairPass } from './repairPass';
import type { Placement } from './types';

function place(x: number, y: number, extra: Partial<Placement> = {}): Placement {
  return { x, y, rotationDeg: 0, scale: 1, colorSeed: 0, ...extra };
}

describe('applyBouquetRepairPass (Build 023)', () => {
  const tileSize = 1600;
  const motifSize = 70; // cell ~112

  it('is a strict no-op (identical array reference) when nothing carries a clusterId', () => {
    const placements = [place(0, 0), place(500, 500)];
    const result = applyBouquetRepairPass(placements, tileSize, motifSize);
    expect(result.placements).toBe(placements);
    expect(result.repairedCount).toBe(0);
  });

  it('pulls a far cluster member toward its anchor without exceeding the bound', () => {
    const anchorX = 0;
    const anchorY = 0;
    const placements = [
      place(anchorX, anchorY, { role: 'hero', clusterId: 0, clusterAnchorX: anchorX, clusterAnchorY: anchorY }),
      place(anchorX + 300, anchorY, { role: 'filler', clusterId: 0, clusterAnchorX: anchorX, clusterAnchorY: anchorY }),
    ];
    const result = applyBouquetRepairPass(placements, tileSize, motifSize, { maxRepairFraction: 1 });
    expect(result.repairedCount).toBeGreaterThan(0);
    const repaired = result.placements[1];
    const originalDist = 300;
    const newDist = Math.hypot(repaired.x - anchorX, repaired.y - anchorY);
    expect(newDist).toBeLessThan(originalDist);
    // never snapped all the way to the anchor
    expect(newDist).toBeGreaterThan(0);
  });

  it('never moves the hero itself', () => {
    const placements = [
      place(0, 0, { role: 'hero', clusterId: 0, clusterAnchorX: 0, clusterAnchorY: 0 }),
      place(300, 0, { role: 'filler', clusterId: 0, clusterAnchorX: 0, clusterAnchorY: 0 }),
    ];
    const result = applyBouquetRepairPass(placements, tileSize, motifSize, { maxRepairFraction: 1 });
    expect(result.placements[0].x).toBe(0);
    expect(result.placements[0].y).toBe(0);
  });

  it('respects maxRepairFraction — repairs at most that share of a cluster\'s non-hero members', () => {
    const placements = [
      place(0, 0, { role: 'hero', clusterId: 0, clusterAnchorX: 0, clusterAnchorY: 0 }),
      place(400, 0, { role: 'filler', clusterId: 0, clusterAnchorX: 0, clusterAnchorY: 0 }),
      place(0, 400, { role: 'filler', clusterId: 0, clusterAnchorX: 0, clusterAnchorY: 0 }),
    ];
    const result = applyBouquetRepairPass(placements, tileSize, motifSize, { maxRepairFraction: 0.5, maxIterations: 1 });
    // floor(2 * 0.5) = 1 repair max per iteration
    expect(result.repairedCount).toBeLessThanOrEqual(1);
  });

  it('never moves a placement from one cluster toward a different cluster\'s anchor', () => {
    const placements = [
      place(0, 0, { role: 'hero', clusterId: 0, clusterAnchorX: 0, clusterAnchorY: 0 }),
      place(300, 0, { role: 'filler', clusterId: 0, clusterAnchorX: 0, clusterAnchorY: 0 }),
      place(900, 900, { role: 'hero', clusterId: 1, clusterAnchorX: 900, clusterAnchorY: 900 }),
    ];
    const result = applyBouquetRepairPass(placements, tileSize, motifSize, { maxRepairFraction: 1 });
    const repaired = result.placements[1];
    // should have moved toward (0,0), not toward (900,900)
    expect(repaired.x).toBeLessThan(300);
  });

  it('is deterministic — repeated calls with the same input produce the same output', () => {
    const placements = [
      place(0, 0, { role: 'hero', clusterId: 0, clusterAnchorX: 0, clusterAnchorY: 0 }),
      place(300, 50, { role: 'filler', clusterId: 0, clusterAnchorX: 0, clusterAnchorY: 0 }),
    ];
    const a = applyBouquetRepairPass(placements, tileSize, motifSize, { maxRepairFraction: 1 });
    const b = applyBouquetRepairPass(placements, tileSize, motifSize, { maxRepairFraction: 1 });
    expect(a.placements).toEqual(b.placements);
  });
});
