import { describe, it, expect } from 'vitest';
import type { Placement } from './types';
import { buildBouquetSpatialGraph } from './bouquetSpatialGraph';
import { applyRepairEngineV2 } from './repairEngineV2';

const TILE_SIZE = 1200;
const MOTIF_SIZE = 200; // gridN clamps to the minimum (4) at this tileSize/motifSize ratio.

function p(x: number, y: number, extra: Partial<Placement> = {}): Placement {
  return { x, y, rotationDeg: 0, scale: 1, colorSeed: 0, role: 'secondary', ...extra };
}

function isolatedCount(placements: Placement[]): number {
  return buildBouquetSpatialGraph(placements, TILE_SIZE, MOTIF_SIZE).isIsolated.filter(Boolean).length;
}

describe('applyRepairEngineV2', () => {
  it('is a strict no-op when no placement carries a clusterId', () => {
    const placements = [p(10, 10), p(500, 500), p(900, 200)];
    const result = applyRepairEngineV2(placements, TILE_SIZE, MOTIF_SIZE);
    expect(result.placements).toEqual(placements);
    expect(result.passesUsed).toBe(0);
    expect(result.appliedActions).toHaveLength(0);
  });

  it('moves a whole isolated non-primary cluster rigidly (relative member offsets preserved) and never increases the isolated-cell count', () => {
    const placements: Placement[] = [
      // Primary bouquet unit — tight, mutually-adjacent trio, isPrimaryCluster tagged.
      p(50, 80, { clusterId: 0, isPrimaryCluster: true, role: 'hero' }),
      p(70, 80, { clusterId: 0, isPrimaryCluster: true }),
      p(50, 100, { clusterId: 0, isPrimaryCluster: true }),
      // A secondary (non-primary) cluster, far away, its two members in
      // separate cells that are each isolated from everything else.
      p(650, 50, { clusterId: 1, clusterAnchorX: 650, clusterAnchorY: 50 }),
      p(650, 650, { clusterId: 1, clusterAnchorX: 650, clusterAnchorY: 50 }),
    ];
    const before = isolatedCount(placements);
    expect(before).toBeGreaterThan(0);

    const result = applyRepairEngineV2(placements, TILE_SIZE, MOTIF_SIZE);

    const secondaryBefore = placements.filter((pl) => pl.clusterId === 1);
    const secondaryAfter = result.placements.filter((pl) => pl.clusterId === 1);
    expect(secondaryAfter).toHaveLength(2);

    // Rigid whole-cluster movement: the offset between the cluster's own
    // two members must be preserved, not just their absolute positions.
    const offsetBefore = { dx: secondaryBefore[1].x - secondaryBefore[0].x, dy: secondaryBefore[1].y - secondaryBefore[0].y };
    const offsetAfter = { dx: secondaryAfter[1].x - secondaryAfter[0].x, dy: secondaryAfter[1].y - secondaryAfter[0].y };
    expect(offsetAfter.dx).toBeCloseTo(offsetBefore.dx, 3);
    expect(offsetAfter.dy).toBeCloseTo(offsetBefore.dy, 3);

    // The cluster actually moved (repair took a real action).
    expect(result.appliedActions.length).toBeGreaterThanOrEqual(1);
    expect(secondaryAfter[0].x).not.toBeCloseTo(secondaryBefore[0].x, 0);

    // Simulated repair only ever applies strictly-improving candidates, so
    // the isolated-cell count can never regress.
    const after = isolatedCount(result.placements);
    expect(after).toBeLessThanOrEqual(before);

    // Bounded pass count (the brief's MAX_PASSES=4 invariant).
    expect(result.passesUsed).toBeLessThanOrEqual(4);
  });

  it('pulls a secondary cluster toward its own nearest primary unit, not a farther one (multi-unit tile)', () => {
    const placements: Placement[] = [
      // The FARTHER primary is listed first / has the lower clusterId, so a
      // buggy "just pick the first primary" implementation would choose it
      // over the genuinely nearer one below.
      p(650, 650, { clusterId: 0, isPrimaryCluster: true, role: 'hero' }),
      p(670, 650, { clusterId: 0, isPrimaryCluster: true }),
      p(650, 670, { clusterId: 0, isPrimaryCluster: true }),
      // The isolated secondary cluster, genuinely closer to the NEAR primary.
      p(300, 300, { clusterId: 1, clusterAnchorX: 300, clusterAnchorY: 300 }),
      // The NEARER primary — higher clusterId, later in iteration order.
      p(50, 50, { clusterId: 2, isPrimaryCluster: true, role: 'hero' }),
      p(70, 50, { clusterId: 2, isPrimaryCluster: true }),
      p(50, 70, { clusterId: 2, isPrimaryCluster: true }),
    ];

    const result = applyRepairEngineV2(placements, TILE_SIZE, MOTIF_SIZE);
    const secondaryAfter = result.placements.find((pl) => pl.clusterId === 1)!;

    // Moving toward the near primary (50,50) means x strictly decreases from
    // 300; moving toward the far one (650,650) would mean x increases.
    expect(secondaryAfter.x).toBeLessThan(300);
    expect(result.appliedActions.length).toBeGreaterThanOrEqual(1);
    expect(result.passesUsed).toBeLessThanOrEqual(4);
  });
});
