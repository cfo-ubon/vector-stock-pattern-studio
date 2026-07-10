import { describe, it, expect } from 'vitest';
import { applyHierarchy, DEFAULT_HIERARCHY } from './hierarchy';
import { createRng } from './rng';
import type { Placement } from './types';

function makePlacements(n: number): Placement[] {
  return Array.from({ length: n }, (_, i) => ({ x: i, y: i, rotationDeg: 0, scale: 1, colorSeed: i }));
}

describe('applyHierarchy', () => {
  it('assigns roles in roughly the configured proportions over a large sample', () => {
    const rng = createRng('hierarchy-distribution');
    const placements = makePlacements(4000);
    const roled = applyHierarchy(placements, DEFAULT_HIERARCHY, rng);
    const counts = { hero: 0, secondary: 0, filler: 0, accent: 0 };
    for (const p of roled) counts[p.role as keyof typeof counts]++;
    const total = roled.length;
    expect(counts.hero / total).toBeCloseTo(DEFAULT_HIERARCHY.heroRatio, 1);
    expect(counts.secondary / total).toBeCloseTo(DEFAULT_HIERARCHY.secondaryRatio, 1);
    expect(counts.filler / total).toBeCloseTo(DEFAULT_HIERARCHY.fillerRatio, 1);
    expect(counts.accent / total).toBeCloseTo(DEFAULT_HIERARCHY.accentRatio, 1);
  });

  it('scales each role by its configured multiplier', () => {
    const rng = createRng('hierarchy-scale');
    const placements = makePlacements(2000);
    const roled = applyHierarchy(placements, DEFAULT_HIERARCHY, rng);
    const byRole = { hero: [] as number[], secondary: [] as number[], filler: [] as number[], accent: [] as number[] };
    for (const p of roled) byRole[p.role as keyof typeof byRole].push(p.scale);
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    // Original scale was always 1, so post-hierarchy average should track
    // each role's scale multiplier (within the +/-6% per-instance wobble).
    expect(avg(byRole.hero)).toBeCloseTo(DEFAULT_HIERARCHY.heroScale, 0);
    expect(avg(byRole.filler)).toBeCloseTo(DEFAULT_HIERARCHY.fillerScale, 0);
    expect(avg(byRole.accent)).toBeCloseTo(DEFAULT_HIERARCHY.accentScale, 0);
  });

  it('normalizes ratios that do not sum to 1 instead of producing an inconsistent distribution', () => {
    const rng = createRng('hierarchy-normalize');
    const skewed = { ...DEFAULT_HIERARCHY, heroRatio: 4, secondaryRatio: 4, fillerRatio: 0, accentRatio: 0 };
    const roled = applyHierarchy(makePlacements(1000), skewed, rng);
    const roles = new Set(roled.map((p) => p.role));
    expect(roles.has('filler')).toBe(false);
    expect(roles.has('accent')).toBe(false);
    expect(roled.every((p) => p.role === 'hero' || p.role === 'secondary')).toBe(true);
  });
});
