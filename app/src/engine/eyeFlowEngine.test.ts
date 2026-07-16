import { describe, it, expect } from 'vitest';
import type { Placement } from './types';
import { applyEyeFlow, EYE_FLOW_PATHS, mapCompositionZoneToEyeFlow } from './eyeFlowEngine';
import { periodicDist } from './svgGeometry';

function makePlacement(x: number, y: number, overrides: Partial<Placement> = {}): Placement {
  return { x, y, rotationDeg: 0, scale: 1, colorSeed: 0, ...overrides };
}

const TILE = 1000;

describe('applyEyeFlow', () => {
  it('is a no-op when strength is 0', () => {
    const placements = [makePlacement(100, 100), makePlacement(500, 500)];
    for (const path of EYE_FLOW_PATHS) {
      expect(applyEyeFlow(placements, TILE, path, 0)).toBe(placements);
    }
  });

  it('is a strict no-op for the wallpaper path regardless of strength', () => {
    const placements = [makePlacement(100, 100), makePlacement(500, 500), makePlacement(900, 50)];
    expect(applyEyeFlow(placements, TILE, 'wallpaper', 1)).toBe(placements);
  });

  it('is a no-op for an empty placement list', () => {
    expect(applyEyeFlow([], TILE, 'sCurve', 1)).toEqual([]);
  });

  it('pulls placements toward the sCurve skeleton without changing count', () => {
    const placements = Array.from({ length: 30 }, (_, i) => makePlacement((i * 37) % TILE, (i * 53) % TILE));
    const result = applyEyeFlow(placements, TILE, 'sCurve', 1);
    expect(result.length).toBe(placements.length);
    // Every placement should move at least a little (skeleton points are dense
    // and spread across the whole tile, so an exact match is vanishingly rare).
    const moved = result.filter((p, i) => p.x !== placements[i].x || p.y !== placements[i].y);
    expect(moved.length).toBeGreaterThan(placements.length * 0.9);
  });

  it('never moves a placement further than the bounded pull fraction allows', () => {
    const placements = [makePlacement(10, 10), makePlacement(990, 990), makePlacement(500, 20)];
    const result = applyEyeFlow(placements, TILE, 'diagonal', 1);
    // Max single-step pull is 0.22 * strength(<=1) of the distance to the
    // nearest anchor; since anchors span the whole tile (up to ~half tile
    // diagonal away in the worst case), no placement should teleport further
    // than a fraction of the tile size in one pass.
    for (let i = 0; i < placements.length; i++) {
      const dx = result[i].x - placements[i].x;
      const dy = result[i].y - placements[i].y;
      expect(Math.hypot(dx, dy)).toBeLessThan(TILE * 0.3);
    }
  });

  it('pulls a placement already on the diagonal skeleton negligibly', () => {
    const onDiagonal = makePlacement(500, 500);
    const [result] = applyEyeFlow([onDiagonal], TILE, 'diagonal', 1);
    expect(Math.hypot(result.x - onDiagonal.x, result.y - onDiagonal.y)).toBeLessThan(5);
  });

  it('asymmetrical pulls every placement toward the same single off-center point', () => {
    const placements = [makePlacement(50, 50), makePlacement(950, 950), makePlacement(20, 900)];
    const result = applyEyeFlow(placements, TILE, 'asymmetrical', 1);
    // All 3 placements should move toward the same golden-ratio anchor
    // (0.618, 0.382 normalized) rather than 3 different directions. Uses
    // wrap-aware distance since the pull itself is toroidal.
    const target = { x: 0.618 * TILE, y: 0.382 * TILE };
    result.forEach((p, i) => {
      const before = periodicDist(placements[i], target, TILE);
      const after = periodicDist(p, target, TILE);
      expect(after).toBeLessThan(before);
    });
  });
});

describe('mapCompositionZoneToEyeFlow', () => {
  it('maps the 4 zones with a real analog', () => {
    expect(mapCompositionZoneToEyeFlow('sCurve')).toBe('sCurve');
    expect(mapCompositionZoneToEyeFlow('diagonal')).toBe('diagonal');
    expect(mapCompositionZoneToEyeFlow('editorial')).toBe('editorial');
    expect(mapCompositionZoneToEyeFlow('goldenRatio')).toBe('spiral');
  });

  it('leaves zones without an honest analog unmapped', () => {
    expect(mapCompositionZoneToEyeFlow('zFlow')).toBeUndefined();
    expect(mapCompositionZoneToEyeFlow('centerFocus')).toBeUndefined();
    expect(mapCompositionZoneToEyeFlow('cornerFlow')).toBeUndefined();
    expect(mapCompositionZoneToEyeFlow('radial')).toBeUndefined();
    expect(mapCompositionZoneToEyeFlow('wave')).toBeUndefined();
    expect(mapCompositionZoneToEyeFlow('offset')).toBeUndefined();
  });
});
