import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import { COMPOSITION_ZONES, placeZoneAnchors, sampleZoneParams } from './compositionZones';

describe('sampleZoneParams', () => {
  it('is deterministic for the same seed', () => {
    const a = sampleZoneParams(createRng('zone-params-1'));
    const b = sampleZoneParams(createRng('zone-params-1'));
    expect(a).toEqual(b);
  });
});

describe('placeZoneAnchors', () => {
  const tileSize = 1200;
  const minDist = 120;
  const targetCount = 10;

  it('respects the requested minimum toroidal spacing for every zone', () => {
    for (const zone of COMPOSITION_ZONES) {
      const points = placeZoneAnchors(zone, tileSize, minDist, targetCount, createRng(`spacing-${zone}`));
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const [ax, ay] = points[i];
          const [bx, by] = points[j];
          let best = Infinity;
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              const d = Math.hypot(ax - (bx + dx * tileSize), ay - (by + dy * tileSize));
              if (d < best) best = d;
            }
          }
          expect(best).toBeGreaterThanOrEqual(minDist - 1e-6);
        }
      }
    }
  });

  it('gets reasonably close to the requested anchor count for every zone', () => {
    for (const zone of COMPOSITION_ZONES) {
      const points = placeZoneAnchors(zone, tileSize, minDist, targetCount, createRng(`count-${zone}`));
      expect(points.length).toBeGreaterThanOrEqual(Math.floor(targetCount * 0.6));
    }
  });

  it('keeps every anchor within the tile bounds', () => {
    for (const zone of COMPOSITION_ZONES) {
      const points = placeZoneAnchors(zone, tileSize, minDist, targetCount, createRng(`bounds-${zone}`));
      for (const [x, y] of points) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(tileSize);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThan(tileSize);
      }
    }
  });

  it('is deterministic for the same seed', () => {
    const a = placeZoneAnchors('diagonal', tileSize, minDist, targetCount, createRng('zone-det-1'));
    const b = placeZoneAnchors('diagonal', tileSize, minDist, targetCount, createRng('zone-det-1'));
    expect(a).toEqual(b);
  });

  it('diagonal zone concentrates anchors nearer the diagonal band than a matched uniform-random baseline', () => {
    // Real, measured evidence that the zone actually biases anchor
    // position rather than being cosmetic: average perpendicular distance
    // from the (phase-shifted) diagonal should be smaller for the zone's
    // own anchors than for plain uniform points across many seeds.
    let zoneTotal = 0;
    let uniformTotal = 0;
    const trials = 20;
    for (let t = 0; t < trials; t++) {
      const rng = createRng(`diagonal-bias-${t}`);
      const points = placeZoneAnchors('diagonal', tileSize, minDist, targetCount, rng);
      for (const [x, y] of points) {
        const nx = x / tileSize;
        const ny = y / tileSize;
        const raw = nx - ny;
        const d = Math.min(((raw % 1) + 1) % 1, 1 - (((raw % 1) + 1) % 1));
        zoneTotal += d;
      }
      const uniformRng = createRng(`uniform-bias-${t}`);
      for (let i = 0; i < points.length; i++) {
        const nx = uniformRng();
        const ny = uniformRng();
        const raw = nx - ny;
        const d = Math.min(((raw % 1) + 1) % 1, 1 - (((raw % 1) + 1) % 1));
        uniformTotal += d;
      }
    }
    expect(zoneTotal).toBeLessThan(uniformTotal);
  });

  it('falls back to a real, non-degenerate anchor count even with a very tight minDist', () => {
    const points = placeZoneAnchors('goldenRatio', tileSize, 20, 30, createRng('tight-minDist-1'));
    expect(points.length).toBeGreaterThan(0);
  });

  it('centerFocus anchors sit measurably closer to the tile center than cornerFlow anchors', () => {
    // Real, distinct identity check: centerFocus and cornerFlow use the
    // same falloff-from-a-point formula (§ fieldDensity) around two
    // different points — this confirms they actually produce different
    // spatial distributions, not the same shape under two names.
    const toroidalDistToCenter = (x: number, y: number) => {
      const nx = x / tileSize;
      const ny = y / tileSize;
      const dx = Math.min(((nx - 0.5) % 1 + 1) % 1, 1 - (((nx - 0.5) % 1 + 1) % 1));
      const dy = Math.min(((ny - 0.5) % 1 + 1) % 1, 1 - (((ny - 0.5) % 1 + 1) % 1));
      return Math.hypot(dx, dy);
    };
    let centerFocusTotal = 0;
    let cornerFlowTotal = 0;
    let n = 0;
    for (let t = 0; t < 15; t++) {
      const cf = placeZoneAnchors('centerFocus', tileSize, minDist, targetCount, createRng(`cf-${t}`));
      const cn = placeZoneAnchors('cornerFlow', tileSize, minDist, targetCount, createRng(`cn-${t}`));
      for (const [x, y] of cf) centerFocusTotal += toroidalDistToCenter(x, y);
      for (const [x, y] of cn) cornerFlowTotal += toroidalDistToCenter(x, y);
      n += cf.length + cn.length;
    }
    expect(n).toBeGreaterThan(0);
    expect(centerFocusTotal).toBeLessThan(cornerFlowTotal);
  });
});
