import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import { COMPOSITION_ZONES, type CompositionZone } from './compositionZones';
import { assignBatchCompositionZones } from './portfolioVariety';

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
