import { describe, it, expect } from 'vitest';
import { buildBouquetSpatialGraph, groupByCluster, reserveClusterCompanions, silhouetteGridN } from './bouquetSpatialGraph';
import type { Placement } from './types';

function place(x: number, y: number, extra: Partial<Placement> = {}): Placement {
  return { x, y, rotationDeg: 0, scale: 1, colorSeed: 0, ...extra };
}

describe('silhouetteGridN (Build 023)', () => {
  it('matches the critic\'s own clamp + ratio for a typical tile', () => {
    expect(silhouetteGridN(1600, 70)).toBe(14);
  });
  it('clamps to the minimum for a huge motif relative to tile size', () => {
    expect(silhouetteGridN(1600, 1000)).toBeGreaterThanOrEqual(4);
  });
});

describe('buildBouquetSpatialGraph', () => {
  it('flags a lone placement far from everything else as isolated', () => {
    const tileSize = 1600;
    const motifSize = 70; // cell ~112
    const placements = [
      place(50, 50), // cluster of 3 nearby
      place(60, 55),
      place(55, 60),
      place(1500, 1500), // far away, alone
    ];
    const graph = buildBouquetSpatialGraph(placements, tileSize, motifSize);
    expect(graph.isIsolated[3]).toBe(true);
    expect(graph.isIsolated[0]).toBe(false);
  });

  it('does not flag a placement sharing a cell with another', () => {
    const placements = [place(50, 50), place(52, 51)];
    const graph = buildBouquetSpatialGraph(placements, 1600, 70);
    expect(graph.isIsolated[0]).toBe(false);
    expect(graph.isIsolated[1]).toBe(false);
  });

  it('respects toroidal wraparound adjacency', () => {
    const tileSize = 1600;
    // Two placements near opposite edges of the tile, close together once wrapped.
    const placements = [place(2, 800), place(tileSize - 2, 800)];
    const graph = buildBouquetSpatialGraph(placements, tileSize, 70);
    expect(graph.isIsolated[0]).toBe(false);
    expect(graph.isIsolated[1]).toBe(false);
  });
});

describe('groupByCluster', () => {
  it('groups only clusterId-tagged placements, in ascending cluster order', () => {
    const placements = [
      place(0, 0, { clusterId: 1, clusterAnchorX: 0, clusterAnchorY: 0 }),
      place(10, 10), // no clusterId - excluded
      place(5, 5, { clusterId: 0, clusterAnchorX: 5, clusterAnchorY: 5 }),
      place(1, 1, { clusterId: 1, clusterAnchorX: 0, clusterAnchorY: 0 }),
    ];
    const groups = groupByCluster(placements);
    expect(groups.map((g) => g.clusterId)).toEqual([0, 1]);
    expect(groups[1].memberIndexes).toEqual([0, 3]);
  });

  it('returns an empty array for a placement list with no clusterId at all', () => {
    expect(groupByCluster([place(0, 0), place(1, 1)])).toEqual([]);
  });
});

describe('reserveClusterCompanions', () => {
  it('reserves the nearest-to-anchor thinnable member of each cluster', () => {
    const placements = [
      place(0, 0, { role: 'hero', clusterId: 0, clusterAnchorX: 0, clusterAnchorY: 0 }),
      place(50, 50, { role: 'filler', clusterId: 0, clusterAnchorX: 0, clusterAnchorY: 0 }), // far
      place(5, 5, { role: 'filler', clusterId: 0, clusterAnchorX: 0, clusterAnchorY: 0 }), // near
    ];
    const thinnable = [1, 2]; // hero (index 0) never in the thinnable pool
    const reserved = reserveClusterCompanions(thinnable, placements, 5);
    expect(reserved.has(2)).toBe(true);
    expect(reserved.has(1)).toBe(false);
  });

  it('caps reservations at maxReservations, in ascending clusterId order', () => {
    const placements = [
      place(0, 0, { clusterId: 0, clusterAnchorX: 0, clusterAnchorY: 0 }),
      place(100, 100, { clusterId: 1, clusterAnchorX: 100, clusterAnchorY: 100 }),
      place(200, 200, { clusterId: 2, clusterAnchorX: 200, clusterAnchorY: 200 }),
    ];
    const reserved = reserveClusterCompanions([0, 1, 2], placements, 2);
    expect(reserved.size).toBe(2);
  });

  it('returns an empty set when maxReservations is 0', () => {
    const placements = [place(0, 0, { clusterId: 0, clusterAnchorX: 0, clusterAnchorY: 0 })];
    expect(reserveClusterCompanions([0], placements, 0).size).toBe(0);
  });
});
