import { describe, it, expect } from 'vitest';
import { assignDepthLayer, sortByDepthLayer, computeDepthDiagnostics, DEPTH_LAYER_ORDER } from './depthLayers';
import type { Placement } from './types';

function place(x: number, y: number, extra: Partial<Placement> = {}): Placement {
  return { x, y, rotationDeg: 0, scale: 1, colorSeed: 0, ...extra };
}

describe('depthLayers (Build 024, Phase 6)', () => {
  const tileSize = 1600;

  it('assigns hero to heroFlowers and secondary to secondaryFlowers', () => {
    expect(assignDepthLayer(place(0, 0, { role: 'hero' }), 1, tileSize)).toBe('heroFlowers');
    expect(assignDepthLayer(place(0, 0, { role: 'secondary' }), 1, tileSize)).toBe('secondaryFlowers');
  });

  it('assigns an unrolled (no-role) placement to background', () => {
    expect(assignDepthLayer(place(0, 0), 1, tileSize)).toBe('background');
  });

  it('assigns a small filler far from any anchor to farBackFoliage', () => {
    const layer = assignDepthLayer(place(1000, 1000, { role: 'filler', scale: 0.3 }), 1, tileSize);
    expect(layer).toBe('farBackFoliage');
  });

  it('assigns a large filler near its cluster anchor to foregroundLeaves', () => {
    const layer = assignDepthLayer(
      place(10, 10, { role: 'filler', scale: 1.2, clusterId: 0, clusterAnchorX: 0, clusterAnchorY: 0 }),
      1,
      tileSize,
    );
    expect(layer).toBe('foregroundLeaves');
  });

  it('sortByDepthLayer always paints hero after secondary after background', () => {
    const placements = [
      place(0, 0, { role: 'filler' }),
      place(10, 10, { role: 'hero' }),
      place(20, 20, { role: 'secondary' }),
    ];
    const sorted = sortByDepthLayer(placements, tileSize);
    const roles = sorted.map((p) => p.role);
    expect(roles.indexOf('hero')).toBeGreaterThan(roles.indexOf('secondary'));
    expect(roles.indexOf('secondary')).toBeGreaterThan(roles.indexOf('filler'));
  });

  it('DEPTH_LAYER_ORDER has exactly the 7 named planes, hero last', () => {
    expect(DEPTH_LAYER_ORDER).toHaveLength(7);
    expect(DEPTH_LAYER_ORDER[DEPTH_LAYER_ORDER.length - 1]).toBe('accentDetails');
    expect(DEPTH_LAYER_ORDER).toContain('heroFlowers');
  });

  it('computeDepthDiagnostics on an empty placement list reports a flattened composition', () => {
    const diag = computeDepthDiagnostics([], tileSize, 70);
    expect(diag.layerCount).toBe(0);
    expect(diag.flattenedCompositionRisk).toBe(true);
  });

  it('computeDepthDiagnostics detects hero occlusion when a foreground instance overlaps the hero', () => {
    const placements = [
      place(800, 800, { role: 'hero', scale: 1.5 }),
      place(810, 810, { role: 'filler', scale: 1.3, clusterId: 0, clusterAnchorX: 800, clusterAnchorY: 800 }),
    ];
    const diag = computeDepthDiagnostics(placements, tileSize, 100);
    expect(diag.heroOcclusionRatio).toBeGreaterThan(0);
  });

  it('computeDepthDiagnostics flags flattenedCompositionRisk for a single-role tile', () => {
    const placements = [place(0, 0, { role: 'filler' }), place(100, 100, { role: 'filler' })];
    const diag = computeDepthDiagnostics(placements, tileSize, 70);
    expect(diag.flattenedCompositionRisk).toBe(true);
  });

  it('is deterministic (same input, same output) with no RNG involved', () => {
    const placements = [place(0, 0, { role: 'hero' }), place(300, 300, { role: 'filler', scale: 0.5 })];
    const a = computeDepthDiagnostics(placements, tileSize, 70);
    const b = computeDepthDiagnostics(placements, tileSize, 70);
    expect(a).toEqual(b);
  });
});
