import { describe, it, expect } from 'vitest';
import type { Placement } from './types';
import { applyAttraction } from './patternPhysics';

function p(x: number, y: number, role?: Placement['role']): Placement {
  return { x, y, rotationDeg: 0, scale: 1, colorSeed: 0, role };
}

const TILE = 1000;

describe('applyAttraction', () => {
  it('is a no-op when strength is 0', () => {
    const placements = [p(100, 100, 'hero'), p(150, 150, 'filler')];
    const result = applyAttraction(placements, TILE, 0);
    expect(result).toBe(placements);
  });

  it('is a no-op for fewer than 2 placements', () => {
    const placements = [p(100, 100, 'hero')];
    const result = applyAttraction(placements, TILE, 1);
    expect(result).toBe(placements);
  });

  it('is a no-op when no placement carries a role', () => {
    const placements = [p(100, 100), p(500, 500), p(900, 900)];
    const result = applyAttraction(placements, TILE, 1);
    expect(result).toBe(placements);
  });

  it('pulls a low-importance placement toward its nearest higher-importance neighbor', () => {
    const placements = [p(500, 500, 'hero'), p(560, 500, 'accent')];
    const result = applyAttraction(placements, TILE, 1);
    const accent = result.find((r) => r.role === 'accent')!;
    const before = Math.hypot(560 - 500, 0);
    const after = Math.hypot(accent.x - 500, accent.y - 500);
    expect(after).toBeLessThan(before);
  });

  it('never moves the most important placement present (nothing above it to attract to)', () => {
    const placements = [p(500, 500, 'hero'), p(560, 500, 'filler')];
    const result = applyAttraction(placements, TILE, 1);
    const hero = result.find((r) => r.role === 'hero')!;
    expect(hero.x).toBe(500);
    expect(hero.y).toBe(500);
  });

  it('does not attract a placement toward a same-or-lower-importance neighbor', () => {
    // Two fillers, no hero/secondary anywhere — neither should move toward
    // the other since neither is strictly more important.
    const placements = [p(500, 500, 'filler'), p(560, 500, 'filler')];
    const result = applyAttraction(placements, TILE, 1);
    expect(result[0].x).toBe(500);
    expect(result[1].x).toBe(560);
  });

  it('never pulls a placement across a distance beyond its real local radius', () => {
    // A hero far across the tile from a tight cluster of fillers should not
    // yank any of them across the whole tile toward it.
    const placements = [
      p(500, 500, 'filler'),
      p(510, 500, 'filler'),
      p(500, 510, 'filler'),
      p(950, 950, 'hero'), // far away, wrap-adjacent-ish but still distant
    ];
    const result = applyAttraction(placements, TILE, 1);
    const moved = result.slice(0, 3);
    for (let i = 0; i < moved.length; i++) {
      const dist = Math.hypot(moved[i].x - placements[i].x, moved[i].y - placements[i].y);
      expect(dist).toBeLessThan(50); // nowhere close to the ~600+ distance to the hero
    }
  });

  it('respects wrap-around when finding the nearest higher-importance neighbor', () => {
    // A hero just across the tile seam should attract an accent near the
    // opposite edge via the shorter wrap-around path, not be ignored.
    const placements = [p(990, 500, 'accent'), p(10, 500, 'hero')];
    const result = applyAttraction(placements, TILE, 1);
    const accent = result.find((r) => r.role === 'accent')!;
    // Real distance through the seam is 20; pulling toward it should move x
    // in the positive direction (wrapping forward), not snap backward across
    // the whole tile.
    expect(accent.x).toBeGreaterThan(990);
  });

  it('is deterministic (pure function, no rng)', () => {
    const placements = [p(500, 500, 'hero'), p(560, 500, 'accent'), p(520, 540, 'filler')];
    const a = applyAttraction(placements, TILE, 0.7);
    const b = applyAttraction(placements, TILE, 0.7);
    expect(a).toEqual(b);
  });

  it('scales the pull amount with strength', () => {
    const placements = [p(500, 500, 'hero'), p(560, 500, 'accent')];
    const weak = applyAttraction(placements, TILE, 0.2);
    const strong = applyAttraction(placements, TILE, 1);
    const distWeak = Math.hypot(weak[1].x - 500, weak[1].y - 500);
    const distStrong = Math.hypot(strong[1].x - 500, strong[1].y - 500);
    expect(distStrong).toBeLessThan(distWeak);
  });
});
