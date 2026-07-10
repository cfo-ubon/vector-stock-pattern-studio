import { describe, it, expect } from 'vitest';
import type { Placement } from './types';
import {
  computeWeight,
  applyBalanceCorrection,
  applyRhythmSmoothing,
  applyCompositionIntelligence,
  DEFAULT_COMPOSITION_INTELLIGENCE,
} from './compositionIntelligence';

function makePlacement(x: number, y: number, overrides: Partial<Placement> = {}): Placement {
  return { x, y, rotationDeg: 0, scale: 1, colorSeed: 0, ...overrides };
}

const TILE = 1000;

describe('computeWeight', () => {
  it('scales with the square of placement scale', () => {
    const small = computeWeight(makePlacement(0, 0, { scale: 1 }));
    const big = computeWeight(makePlacement(0, 0, { scale: 2 }));
    expect(big).toBeCloseTo(small * 4, 5);
  });

  it('weights hero > secondary > filler > accent at equal scale', () => {
    const hero = computeWeight(makePlacement(0, 0, { scale: 1, role: 'hero' }));
    const secondary = computeWeight(makePlacement(0, 0, { scale: 1, role: 'secondary' }));
    const filler = computeWeight(makePlacement(0, 0, { scale: 1, role: 'filler' }));
    const accent = computeWeight(makePlacement(0, 0, { scale: 1, role: 'accent' }));
    expect(hero).toBeGreaterThan(secondary);
    expect(secondary).toBeGreaterThan(filler);
    expect(filler).toBeGreaterThan(accent);
  });

  it('treats an unset role as neutral (same as scale^2 alone)', () => {
    const noRole = computeWeight(makePlacement(0, 0, { scale: 1.5 }));
    expect(noRole).toBeCloseTo(1.5 * 1.5, 5);
  });
});

describe('applyBalanceCorrection', () => {
  it('is a no-op when strength is 0', () => {
    const placements = [makePlacement(100, 100), makePlacement(120, 110), makePlacement(900, 900), makePlacement(50, 50)];
    const result = applyBalanceCorrection(placements, TILE, 0);
    expect(result).toBe(placements);
  });

  it('is a no-op for fewer than 4 placements', () => {
    const placements = [makePlacement(100, 100), makePlacement(120, 110)];
    const result = applyBalanceCorrection(placements, TILE, 1);
    expect(result).toBe(placements);
  });

  it('is a no-op when the 4 quadrants are already evenly weighted', () => {
    const placements = [
      makePlacement(100, 100), // quadrant 0 (top-left)
      makePlacement(600, 100), // quadrant 1 (top-right)
      makePlacement(100, 600), // quadrant 2 (bottom-left)
      makePlacement(600, 600), // quadrant 3 (bottom-right)
    ];
    const result = applyBalanceCorrection(placements, TILE, 1);
    expect(result).toEqual(placements);
  });

  it('reduces quadrant-weight imbalance for a severely lopsided layout', () => {
    // 10 placements crammed into the top-left quadrant, none anywhere else.
    const placements: Placement[] = [];
    for (let i = 0; i < 10; i++) {
      placements.push(makePlacement(50 + i * 20, 50 + i * 15));
    }
    const before = quadrantWeights(placements, TILE);
    const corrected = applyBalanceCorrection(placements, TILE, 1);
    const after = quadrantWeights(corrected, TILE);
    const imbalance = (arr: number[]) => Math.max(...arr) - Math.min(...arr);
    expect(imbalance(after)).toBeLessThan(imbalance(before));
  });

  it('never moves more than ~15% of placements in a single pass', () => {
    const placements: Placement[] = [];
    for (let i = 0; i < 40; i++) placements.push(makePlacement(10 + i * 5, 10 + i * 3));
    const corrected = applyBalanceCorrection(placements, TILE, 1);
    const movedCount = corrected.filter((p, i) => p.x !== placements[i].x || p.y !== placements[i].y).length;
    expect(movedCount).toBeLessThanOrEqual(Math.ceil(placements.length * 0.15) + 1);
  });

  it('is deterministic (pure function, no rng)', () => {
    const placements: Placement[] = [];
    for (let i = 0; i < 12; i++) placements.push(makePlacement(20 + i * 10, 30 + i * 8));
    const a = applyBalanceCorrection(placements, TILE, 0.7);
    const b = applyBalanceCorrection(placements, TILE, 0.7);
    expect(a).toEqual(b);
  });
});

function quadrantWeights(placements: Placement[], tileSize: number): number[] {
  const q = [0, 0, 0, 0];
  for (const p of placements) {
    const px = ((p.x % tileSize) + tileSize) % tileSize;
    const py = ((p.y % tileSize) + tileSize) % tileSize;
    const qx = px < tileSize / 2 ? 0 : 1;
    const qy = py < tileSize / 2 ? 0 : 1;
    q[qy * 2 + qx] += computeWeight(p);
  }
  return q;
}

describe('applyRhythmSmoothing', () => {
  it('is a no-op when strength is 0', () => {
    const placements = [makePlacement(100, 100), makePlacement(110, 100), makePlacement(900, 900)];
    const result = applyRhythmSmoothing(placements, TILE, 0);
    expect(result).toBe(placements);
  });

  it('is a no-op for fewer than 3 placements', () => {
    const placements = [makePlacement(100, 100), makePlacement(110, 100)];
    const result = applyRhythmSmoothing(placements, TILE, 1);
    expect(result).toBe(placements);
  });

  it('is a no-op for a perfectly even grid (no spacing outliers)', () => {
    const placements: Placement[] = [];
    for (let gx = 0; gx < 4; gx++) {
      for (let gy = 0; gy < 4; gy++) {
        placements.push(makePlacement(gx * 250 + 50, gy * 250 + 50));
      }
    }
    const result = applyRhythmSmoothing(placements, TILE, 1);
    expect(result).toEqual(placements);
  });

  it('pulls an isolated outlier closer to its nearest neighbor', () => {
    // A tight cluster plus one placement sitting far away from everything.
    const placements: Placement[] = [
      makePlacement(500, 500),
      makePlacement(520, 500),
      makePlacement(500, 520),
      makePlacement(510, 510),
      makePlacement(50, 950), // isolated outlier
    ];
    const before = nearestDistance(placements, 4, TILE);
    const corrected = applyRhythmSmoothing(placements, TILE, 1);
    const after = nearestDistance(corrected, 4, TILE);
    expect(after).toBeLessThan(before);
  });

  it('is deterministic (pure function, no rng)', () => {
    const placements = [
      makePlacement(500, 500),
      makePlacement(520, 500),
      makePlacement(500, 520),
      makePlacement(510, 510),
      makePlacement(50, 950),
    ];
    const a = applyRhythmSmoothing(placements, TILE, 0.6);
    const b = applyRhythmSmoothing(placements, TILE, 0.6);
    expect(a).toEqual(b);
  });
});

function nearestDistance(placements: Placement[], index: number, tileSize: number): number {
  const p = placements[index];
  let best = Infinity;
  placements.forEach((o, j) => {
    if (j === index) return;
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const d = Math.hypot(p.x - (o.x + ox * tileSize), p.y - (o.y + oy * tileSize));
        if (d < best) best = d;
      }
    }
  });
  return best;
}

describe('applyCompositionIntelligence', () => {
  it('is a strict no-op (same array reference) when params is undefined', () => {
    const placements = [makePlacement(100, 100), makePlacement(900, 900), makePlacement(50, 50)];
    const result = applyCompositionIntelligence(placements, TILE, undefined);
    expect(result).toBe(placements);
  });

  it('runs balance correction before rhythm smoothing and returns a real result', () => {
    const placements: Placement[] = [];
    for (let i = 0; i < 10; i++) placements.push(makePlacement(50 + i * 20, 50 + i * 15));
    const result = applyCompositionIntelligence(placements, TILE, DEFAULT_COMPOSITION_INTELLIGENCE);
    expect(result.length).toBe(placements.length);
    for (const p of result) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it('is deterministic end to end', () => {
    const placements: Placement[] = [];
    for (let i = 0; i < 16; i++) placements.push(makePlacement(20 + i * 15, 30 + i * 11));
    const a = applyCompositionIntelligence(placements, TILE, DEFAULT_COMPOSITION_INTELLIGENCE);
    const b = applyCompositionIntelligence(placements, TILE, DEFAULT_COMPOSITION_INTELLIGENCE);
    expect(a).toEqual(b);
  });
});
