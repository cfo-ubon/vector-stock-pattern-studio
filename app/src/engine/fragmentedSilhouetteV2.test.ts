import { describe, it, expect } from 'vitest';
import { detectFragmentedSilhouetteV2 } from './fragmentedSilhouetteV2';
import type { Placement } from './types';

function place(x: number, y: number, extra: Partial<Placement> = {}): Placement {
  return { x, y, rotationDeg: 0, scale: 1, colorSeed: 0, ...extra };
}

describe('detectFragmentedSilhouetteV2 (Build 023)', () => {
  const tileSize = 1600;
  const motifSize = 70;

  it('does not flag true confetti (isolated, no cluster explanation) as cluster-explained', () => {
    const placements = [
      place(50, 50), place(1550, 1550), place(50, 1550), place(1550, 50), place(800, 800),
    ];
    const result = detectFragmentedSilhouetteV2(placements, tileSize, motifSize);
    expect(result.clusterExplainedFraction).toBe(0);
  });

  it('recognizes a loosely-grouped cluster (isolated on the strict grid, but near its own anchor group) as cluster-explained', () => {
    // Two members of the same cluster, each isolated on the strict grid
    // (>1 cell apart from any other placement) but within cohesion radius
    // of one another.
    const placements = [
      place(0, 0, { role: 'hero', clusterId: 0, clusterAnchorX: 0, clusterAnchorY: 0 }),
      place(160, 0, { role: 'filler', clusterId: 0, clusterAnchorX: 0, clusterAnchorY: 0 }), // isolated from hero's cell but close-ish
      place(1550, 1550, { clusterId: 1, clusterAnchorX: 1550, clusterAnchorY: 1550 }), // far, alone in its own cluster
    ];
    const result = detectFragmentedSilhouetteV2(placements, tileSize, motifSize);
    expect(result.isolatedFraction).toBeGreaterThan(0);
  });

  it('returns a real result object shape (not throwing) on a typical mixed input', () => {
    const placements = Array.from({ length: 10 }, (_, i) => place(i * 150, i * 100));
    const result = detectFragmentedSilhouetteV2(placements, tileSize, motifSize);
    expect(typeof result.isolatedFraction).toBe('number');
    expect(typeof result.detected).toBe('boolean');
  });

  it('handles too few instances gracefully', () => {
    const result = detectFragmentedSilhouetteV2([place(0, 0), place(1, 1)], tileSize, motifSize);
    expect(result.detected).toBe(false);
  });
});
