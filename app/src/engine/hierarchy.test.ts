import { describe, it, expect } from 'vitest';
import {
  applyHierarchy,
  computeVisualHierarchyScore,
  DEFAULT_HIERARCHY,
  ROLE_IMPORTANCE,
  ROLE_LAYER_PRIORITY,
  sortByLayerPriority,
} from './hierarchy';
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

describe('applyHierarchy premiumRhythm (Build 010, Section 5: Premium Rhythm Engine)', () => {
  it('is a strict no-op (byte-identical scale sequence) when premiumRhythm is undefined', () => {
    const withoutFlag = applyHierarchy(makePlacements(200), DEFAULT_HIERARCHY, createRng('rhythm-noop'));
    const explicitFalse = applyHierarchy(makePlacements(200), { ...DEFAULT_HIERARCHY, premiumRhythm: false }, createRng('rhythm-noop'));
    expect(withoutFlag.map((p) => p.scale)).toEqual(explicitFalse.map((p) => p.scale));
  });

  it('still scales each role by roughly its configured multiplier when enabled', () => {
    const rng = createRng('rhythm-scale');
    const placements = makePlacements(2000);
    const roled = applyHierarchy(placements, { ...DEFAULT_HIERARCHY, premiumRhythm: true }, rng);
    const byRole = { hero: [] as number[], secondary: [] as number[], filler: [] as number[], accent: [] as number[] };
    for (const p of roled) byRole[p.role as keyof typeof byRole].push(p.scale);
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    expect(avg(byRole.hero)).toBeCloseTo(DEFAULT_HIERARCHY.heroScale, 0);
    expect(avg(byRole.filler)).toBeCloseTo(DEFAULT_HIERARCHY.fillerScale, 0);
    expect(avg(byRole.accent)).toBeCloseTo(DEFAULT_HIERARCHY.accentScale, 0);
  });

  it('produces a deliberate non-monotonic sequence per role (not every consecutive same-role scale is equal)', () => {
    const rng = createRng('rhythm-sequence');
    const placements = makePlacements(500);
    const roled = applyHierarchy(placements, { ...DEFAULT_HIERARCHY, premiumRhythm: true }, rng);
    const fillerScales = roled.filter((p) => p.role === 'filler').map((p) => p.scale);
    expect(fillerScales.length).toBeGreaterThan(4);
    // At least 2 distinct rounded scale values should appear (a real
    // alternating cycle, not one flat repeated value).
    const distinct = new Set(fillerScales.map((s) => Math.round(s * 100)));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('is deterministic for the same seed', () => {
    const a = applyHierarchy(makePlacements(100), { ...DEFAULT_HIERARCHY, premiumRhythm: true }, createRng('rhythm-det'));
    const b = applyHierarchy(makePlacements(100), { ...DEFAULT_HIERARCHY, premiumRhythm: true }, createRng('rhythm-det'));
    expect(a.map((p) => p.scale)).toEqual(b.map((p) => p.scale));
  });
});

describe('promoteSecondaryHero (via applyHierarchy secondaryHeroBoost)', () => {
  it('is a strict no-op when secondaryHeroBoost is unset', () => {
    const rngA = createRng('secondary-hero-noop');
    const rngB = createRng('secondary-hero-noop');
    const placements = makePlacements(500);
    const withoutBoost = applyHierarchy(placements, DEFAULT_HIERARCHY, rngA);
    const explicitZero = applyHierarchy(placements, { ...DEFAULT_HIERARCHY, secondaryHeroBoost: 0 }, rngB);
    expect(explicitZero).toEqual(withoutBoost);
  });

  it('boosts only the single largest-scaled secondary placement, strictly below heroScale', () => {
    const rng = createRng('secondary-hero-boost');
    const placements = makePlacements(500);
    const hierarchy = { ...DEFAULT_HIERARCHY, secondaryHeroBoost: 1 };
    const roled = applyHierarchy(placements, hierarchy, rng);
    const secondaries = roled.filter((p) => p.role === 'secondary');
    const boostedCount = secondaries.filter((p) => p.scale > DEFAULT_HIERARCHY.secondaryScale * 1.3).length;
    expect(boostedCount).toBe(1);
    const boosted = secondaries.find((p) => p.scale > DEFAULT_HIERARCHY.secondaryScale * 1.3)!;
    expect(boosted.scale).toBeLessThan(hierarchy.heroScale);

    const heroes = roled.filter((p) => p.role === 'hero');
    expect(Math.max(...heroes.map((p) => p.scale))).toBeGreaterThan(boosted.scale);
  });

  it('is a no-op when there is no secondary-role placement at all', () => {
    const rng = createRng('secondary-hero-none');
    const hierarchy = { ...DEFAULT_HIERARCHY, heroRatio: 0.5, secondaryRatio: 0, fillerRatio: 0.3, accentRatio: 0.2, secondaryHeroBoost: 1 };
    const roled = applyHierarchy(makePlacements(200), hierarchy, rng);
    expect(roled.some((p) => p.role === 'secondary')).toBe(false);
  });
});

describe('computeVisualHierarchyScore', () => {
  function p(role: Placement['role'], scale: number, i: number): Placement {
    return { x: i, y: i, rotationDeg: 0, scale, colorSeed: i, role };
  }

  it('returns 100 when fewer than 2 distinct roles are present', () => {
    expect(computeVisualHierarchyScore([p('hero', 1.6, 0), p('hero', 1.5, 1)])).toBe(100);
    expect(computeVisualHierarchyScore([p(undefined, 1, 0)])).toBe(100);
  });

  it('scores a cleanly separated hierarchy higher than a flat one', () => {
    const flatHierarchy = { ...DEFAULT_HIERARCHY, heroScale: 1.05, secondaryScale: 1.0, fillerScale: 0.98, accentScale: 0.95 };
    const separated = applyHierarchy(makePlacements(500), DEFAULT_HIERARCHY, createRng('vh-score-separated'));
    const flat = applyHierarchy(makePlacements(500), flatHierarchy, createRng('vh-score-flat'));
    expect(computeVisualHierarchyScore(separated)).toBeGreaterThan(computeVisualHierarchyScore(flat));
  });

  it('returns 0 when every placement shares the exact same scale', () => {
    expect(computeVisualHierarchyScore([p('hero', 1, 0), p('secondary', 1, 1)])).toBe(0);
  });
});

describe('ROLE_IMPORTANCE / ROLE_LAYER_PRIORITY', () => {
  it('rank hero > secondary > filler > accent for both dimensions', () => {
    expect(ROLE_IMPORTANCE.hero).toBeGreaterThan(ROLE_IMPORTANCE.secondary);
    expect(ROLE_IMPORTANCE.secondary).toBeGreaterThan(ROLE_IMPORTANCE.filler);
    expect(ROLE_IMPORTANCE.filler).toBeGreaterThan(ROLE_IMPORTANCE.accent);
    expect(ROLE_LAYER_PRIORITY.hero).toBeGreaterThan(ROLE_LAYER_PRIORITY.secondary);
    expect(ROLE_LAYER_PRIORITY.secondary).toBeGreaterThan(ROLE_LAYER_PRIORITY.filler);
    expect(ROLE_LAYER_PRIORITY.filler).toBeGreaterThan(ROLE_LAYER_PRIORITY.accent);
  });
});

describe('sortByLayerPriority', () => {
  function p(role: Placement['role'], i: number): Placement {
    return { x: i, y: i, rotationDeg: 0, scale: 1, colorSeed: i, role };
  }

  it('is a strict no-op (identical order) when no placement has a role', () => {
    const placements = [p(undefined, 0), p(undefined, 1), p(undefined, 2)];
    const sorted = sortByLayerPriority(placements);
    expect(sorted.map((x) => x.colorSeed)).toEqual([0, 1, 2]);
  });

  it('paints hero last regardless of original order', () => {
    const placements = [p('hero', 0), p('accent', 1), p('filler', 2), p('secondary', 3)];
    const sorted = sortByLayerPriority(placements);
    expect(sorted[sorted.length - 1].role).toBe('hero');
  });

  it('is a stable sort: placements sharing a role keep their relative order', () => {
    const placements = [p('filler', 0), p('filler', 1), p('hero', 2), p('filler', 3)];
    const sorted = sortByLayerPriority(placements);
    const fillerSeeds = sorted.filter((x) => x.role === 'filler').map((x) => x.colorSeed);
    expect(fillerSeeds).toEqual([0, 1, 3]);
  });

  it('orders every role by ROLE_LAYER_PRIORITY: accent, filler, secondary, hero', () => {
    const placements = [p('hero', 0), p('secondary', 1), p('accent', 2), p('filler', 3)];
    const sorted = sortByLayerPriority(placements);
    expect(sorted.map((x) => x.role)).toEqual(['accent', 'filler', 'secondary', 'hero']);
  });
});
