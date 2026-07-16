import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import { COMPOSITION_ZONES, type CompositionZone } from './compositionZones';
import { CLUSTER_ARCHETYPES } from './clusterEngine';
import { HIERARCHY_PRESETS } from './hierarchy';
import { BOTANICAL_FAMILIES } from '../generators/botanicalFamilies';
import { HERO_ARCHETYPE_POOL } from '../generators/premiumHero';
import { LAYOUT_LIST } from '../layouts';
import { assignBatchCompositionZones, assignBatchValues, assignPortfolioDiversity } from './portfolioVariety';

describe('assignBatchCompositionZones (Build 003, Part 13)', () => {
  it('assigns every candidate exactly once when count equals the pool size', () => {
    const rng = createRng('variety-full-cycle');
    const zones = assignBatchCompositionZones(rng, COMPOSITION_ZONES.length, COMPOSITION_ZONES);
    expect(new Set(zones).size).toBe(COMPOSITION_ZONES.length);
    expect(zones.length).toBe(COMPOSITION_ZONES.length);
  });

  it('never reuses a zone within the first full cycle for a batch of 9 (the real "Generate 9 Variations" size)', () => {
    for (let i = 0; i < 20; i++) {
      const rng = createRng(`variety-batch9-${i}`);
      const zones = assignBatchCompositionZones(rng, 9, COMPOSITION_ZONES);
      expect(new Set(zones).size).toBe(9);
    }
  });

  it('never assigns the same zone to two adjacent batch positions, even across a bag reshuffle boundary', () => {
    const smallPool: CompositionZone[] = ['diagonal', 'sCurve', 'centerFocus'];
    for (let i = 0; i < 20; i++) {
      const rng = createRng(`variety-adjacency-${i}`);
      const zones = assignBatchCompositionZones(rng, 25, smallPool);
      for (let j = 1; j < zones.length; j++) {
        expect(zones[j]).not.toBe(zones[j - 1]);
      }
    }
  });

  it('cycles a small Style-DNA-sized pool (2-3 zones) evenly rather than clumping on one zone', () => {
    const stylePool: CompositionZone[] = ['radial', 'wave'];
    const rng = createRng('variety-style-pool');
    const zones = assignBatchCompositionZones(rng, 9, stylePool);
    const counts = new Map<CompositionZone, number>();
    for (const z of zones) counts.set(z, (counts.get(z) ?? 0) + 1);
    // 9 items over a 2-zone pool: every full cycle of 2 uses each zone once,
    // so counts can only ever differ by at most 1 (4 and 5, not e.g. 8 and 1).
    const values = [...counts.values()];
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  });

  it('only ever produces zones from the given candidate list', () => {
    const pool: CompositionZone[] = ['offset', 'goldenRatio'];
    const rng = createRng('variety-restricted-pool');
    const zones = assignBatchCompositionZones(rng, 12, pool);
    for (const z of zones) expect(pool).toContain(z);
  });

  it('handles a single-candidate pool without throwing (an unavoidable repeat, not a bug)', () => {
    const rng = createRng('variety-single-pool');
    const zones = assignBatchCompositionZones(rng, 5, ['centerFocus']);
    expect(zones).toEqual(['centerFocus', 'centerFocus', 'centerFocus', 'centerFocus', 'centerFocus']);
  });

  it('is deterministic for the same rng sequence', () => {
    const a = assignBatchCompositionZones(createRng('variety-determinism'), 9, COMPOSITION_ZONES);
    const b = assignBatchCompositionZones(createRng('variety-determinism'), 9, COMPOSITION_ZONES);
    expect(a).toEqual(b);
  });

  it('throws for an empty candidate pool rather than silently returning nonsense', () => {
    const rng = createRng('variety-empty-pool');
    expect(() => assignBatchCompositionZones(rng, 3, [])).toThrow();
  });

  it('returns an empty array when count is 0', () => {
    const rng = createRng('variety-zero-count');
    expect(assignBatchCompositionZones(rng, 0, COMPOSITION_ZONES)).toEqual([]);
  });
});

describe('assignBatchValues (Build 004, Section 11 — generic shuffled bag)', () => {
  it('works over a non-CompositionZone candidate type (plain strings)', () => {
    const rng = createRng('generic-strings');
    const pool = ['a', 'b', 'c', 'd'];
    const values = assignBatchValues(rng, pool.length, pool);
    expect(new Set(values).size).toBe(pool.length);
  });

  it('never reuses a candidate within the first full cycle', () => {
    for (let i = 0; i < 20; i++) {
      const rng = createRng(`generic-cycle-${i}`);
      const pool = [1, 2, 3, 4, 5];
      const values = assignBatchValues(rng, pool.length, pool);
      expect(new Set(values).size).toBe(pool.length);
    }
  });

  it('never assigns the same value to two adjacent positions across a bag reshuffle boundary', () => {
    const pool = ['x', 'y', 'z'];
    for (let i = 0; i < 20; i++) {
      const rng = createRng(`generic-adjacency-${i}`);
      const values = assignBatchValues(rng, 25, pool);
      for (let j = 1; j < values.length; j++) {
        expect(values[j]).not.toBe(values[j - 1]);
      }
    }
  });

  it('throws for an empty candidate list', () => {
    const rng = createRng('generic-empty');
    expect(() => assignBatchValues(rng, 3, [])).toThrow();
  });

  it('is deterministic for the same rng sequence', () => {
    const pool = ['a', 'b', 'c'];
    const a = assignBatchValues(createRng('generic-determinism'), 10, pool);
    const b = assignBatchValues(createRng('generic-determinism'), 10, pool);
    expect(a).toEqual(b);
  });
});

describe('assignPortfolioDiversity (Build 004, Section 11)', () => {
  it('assigns every one of the 9 dimensions a valid value from its default pool for each of count items', () => {
    const rng = createRng('portfolio-diversity-defaults');
    const assignments = assignPortfolioDiversity(rng, 9);
    expect(assignments.length).toBe(9);
    for (const a of assignments) {
      expect(BOTANICAL_FAMILIES).toContain(a.botanicalFamily);
      expect(Object.keys(HIERARCHY_PRESETS)).toContain(a.heroStructure);
      expect(CLUSTER_ARCHETYPES).toContain(a.clusterType);
      expect(['calm', 'directional', 'dynamic']).toContain(a.rotationStyle);
      expect(['minimalLight', 'richContrast', 'darkMoody', 'neutralPaper']).toContain(a.negativeSpaceStrategy);
      expect(COMPOSITION_ZONES).toContain(a.compositionZone);
      expect(['dominantDuo', 'fullPalette', 'monochromeAccent', 'highContrast']).toContain(a.colorHarmony);
      expect(LAYOUT_LIST.map((l) => l.id)).toContain(a.layoutSkeleton);
      expect(HERO_ARCHETYPE_POOL).toContain(a.heroSilhouette);
    }
  });

  it('does not repeat a dimension value within its own first full cycle across a 9-item batch', () => {
    const rng = createRng('portfolio-diversity-no-repeat');
    const assignments = assignPortfolioDiversity(rng, 9);
    // Every default pool used here has >= 9 candidates except clusterType/
    // botanicalFamily/layoutSkeleton/heroSilhouette, which are still checked
    // against their own real pool size rather than assumed to be >= 9.
    const checkNoRepeat = <K extends keyof (typeof assignments)[number]>(key: K, poolSize: number) => {
      const values = assignments.map((a) => a[key]);
      const uniqueInFirstCycle = new Set(values.slice(0, poolSize));
      expect(uniqueInFirstCycle.size).toBe(Math.min(poolSize, 9));
    };
    checkNoRepeat('botanicalFamily', BOTANICAL_FAMILIES.length);
    checkNoRepeat('clusterType', CLUSTER_ARCHETYPES.length);
    checkNoRepeat('compositionZone', COMPOSITION_ZONES.length);
    checkNoRepeat('heroSilhouette', HERO_ARCHETYPE_POOL.length);
  });

  it('respects narrowed candidate pools (e.g. a Style DNA preset preference) rather than falling back to the full default set', () => {
    const rng = createRng('portfolio-diversity-narrowed');
    const narrowFamilies = BOTANICAL_FAMILIES.slice(0, 2);
    const narrowClusters = CLUSTER_ARCHETYPES.slice(0, 2);
    const narrowHeroSilhouettes = HERO_ARCHETYPE_POOL.slice(0, 2);
    const assignments = assignPortfolioDiversity(rng, 9, {
      botanicalFamilies: narrowFamilies,
      clusterTypes: narrowClusters,
      heroSilhouettes: narrowHeroSilhouettes,
    });
    for (const a of assignments) {
      expect(narrowFamilies).toContain(a.botanicalFamily);
      expect(narrowClusters).toContain(a.clusterType);
      expect(narrowHeroSilhouettes).toContain(a.heroSilhouette);
    }
  });

  it('is deterministic for the same rng sequence', () => {
    const a = assignPortfolioDiversity(createRng('portfolio-diversity-determinism'), 9);
    const b = assignPortfolioDiversity(createRng('portfolio-diversity-determinism'), 9);
    expect(a).toEqual(b);
  });

  it('returns an empty array when count is 0', () => {
    const rng = createRng('portfolio-diversity-zero');
    expect(assignPortfolioDiversity(rng, 0)).toEqual([]);
  });
});
