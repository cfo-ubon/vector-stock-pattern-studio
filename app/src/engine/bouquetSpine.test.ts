import { describe, it, expect } from 'vitest';
import { buildBouquetSpineLayer } from './bouquetSpine';
import { createRng } from './rng';
import type { Placement } from './types';

function place(x: number, y: number, extra: Partial<Placement> = {}): Placement {
  return { x, y, rotationDeg: 0, scale: 1, colorSeed: 0, ...extra };
}

describe('buildBouquetSpineLayer (Build 023)', () => {
  const tileSize = 1600;
  const motifSize = 70;
  const colors = ['#111111', '#2a5c3a', '#eeeeee', '#c9a227'];

  it('returns null when no placement carries a clusterId', () => {
    const placements = [place(0, 0), place(300, 300)];
    const rng = createRng('spine-1');
    expect(buildBouquetSpineLayer(placements, tileSize, motifSize, rng, colors)).toBeNull();
  });

  it('returns null when every cluster has only a single (hero-only) member', () => {
    const placements = [
      place(100, 100, { role: 'hero', clusterId: 0, clusterAnchorX: 100, clusterAnchorY: 100 }),
      place(900, 900, { role: 'hero', clusterId: 1, clusterAnchorX: 900, clusterAnchorY: 900 }),
    ];
    const rng = createRng('spine-2');
    expect(buildBouquetSpineLayer(placements, tileSize, motifSize, rng, colors)).toBeNull();
  });

  it('returns null when a multi-member cluster has no member tagged role "hero"', () => {
    const placements = [
      place(100, 100, { role: 'secondary', clusterId: 0, clusterAnchorX: 100, clusterAnchorY: 100 }),
      place(160, 100, { role: 'filler', clusterId: 0, clusterAnchorX: 100, clusterAnchorY: 100 }),
    ];
    const rng = createRng('spine-3');
    expect(buildBouquetSpineLayer(placements, tileSize, motifSize, rng, colors)).toBeNull();
  });

  it('builds a layer-bouquet-spine group for a real hero + companion cluster', () => {
    const placements = [
      place(400, 400, { role: 'hero', clusterId: 0, clusterAnchorX: 400, clusterAnchorY: 400 }),
      place(460, 420, { role: 'secondary', clusterId: 0, clusterAnchorX: 400, clusterAnchorY: 400 }),
      place(430, 470, { role: 'accent', clusterId: 0, clusterAnchorX: 400, clusterAnchorY: 400 }),
    ];
    const rng = createRng('spine-4');
    const layer = buildBouquetSpineLayer(placements, tileSize, motifSize, rng, colors);
    expect(layer).not.toBeNull();
    expect(layer!.attrs?.id).toBe('layer-bouquet-spine');
    expect(layer!.children && layer!.children.length).toBeGreaterThan(0);
  });

  it('is deterministic for a fixed RNG seed', () => {
    const placements = [
      place(400, 400, { role: 'hero', clusterId: 0, clusterAnchorX: 400, clusterAnchorY: 400 }),
      place(460, 420, { role: 'secondary', clusterId: 0, clusterAnchorX: 400, clusterAnchorY: 400 }),
    ];
    const a = buildBouquetSpineLayer(placements, tileSize, motifSize, createRng('spine-5'), colors);
    const b = buildBouquetSpineLayer(placements, tileSize, motifSize, createRng('spine-5'), colors);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('handles a companion wrapped to the opposite tile edge without an absurd cross-tile stem', () => {
    // Hero near x=10, companion near x=1590 -- same cluster, wrapped
    // neighbors on a torus (naive dx would be ~1580, the real wrapped
    // distance is only ~20).
    const placements = [
      place(10, 800, { role: 'hero', clusterId: 0, clusterAnchorX: 10, clusterAnchorY: 800 }),
      place(1590, 800, { role: 'secondary', clusterId: 0, clusterAnchorX: 10, clusterAnchorY: 800 }),
    ];
    const rng = createRng('spine-6');
    const layer = buildBouquetSpineLayer(placements, tileSize, motifSize, rng, colors);
    expect(layer).not.toBeNull();
    // Every stem path's own 'd' attribute is expressed relative to the
    // hero (local cluster space) -- it should only contain small, local
    // coordinates (nowhere near the naive ~1580 raw-subtraction distance),
    // proving the wraparound-aware delta was used. The group's own
    // `translate(...)` offset (which legitimately can exceed tileSize for
    // the -1/+1 wrap copies) is deliberately excluded from this check.
    function collectPathD(node: any, out: string[]) {
      if (!node) return;
      if (node.tag === 'path' && typeof node.attrs?.d === 'string') out.push(node.attrs.d);
      for (const child of node.children ?? []) collectPathD(child, out);
    }
    const dStrings: string[] = [];
    collectPathD(layer, dStrings);
    expect(dStrings.length).toBeGreaterThan(0);
    for (const d of dStrings) {
      const numbers = [...d.matchAll(/-?\d+(\.\d+)?/g)].map((m) => Math.abs(Number(m[0])));
      const maxCoord = Math.max(...numbers.filter((n) => Number.isFinite(n)));
      expect(maxCoord).toBeLessThan(motifSize * 10);
    }
  });
});
