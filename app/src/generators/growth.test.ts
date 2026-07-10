import { describe, it, expect } from 'vitest';
import { createRng } from '../engine/rng';
import { validatePathD } from '../engine/curveEngine';
import { generateStem, growLeaves, terminalPoint, GROWTH_PRESETS } from './growth';

describe('generateStem', () => {
  it('is deterministic for the same seed', () => {
    const a = generateStem(createRng('stem-1'), 100, 0.1);
    const b = generateStem(createRng('stem-1'), 100, 0.1);
    expect(a.path).toBe(b.path);
    expect(a.length).toBe(b.length);
  });

  it('produces a valid path with no non-finite coordinates', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const stem = generateStem(createRng(seed), 80, 0.15);
      expect(validatePathD(stem.path)).toEqual([]);
    }
  });

  it('spans roughly the requested length', () => {
    const stem = generateStem(createRng('span'), 100, 0.05);
    expect(stem.length).toBeGreaterThan(80);
    expect(stem.length).toBeLessThan(140);
  });

  it('terminalPoint sits at the tip (t=1) of the sampler', () => {
    const stem = generateStem(createRng('tip'), 100, 0.1);
    const tip = terminalPoint(stem);
    const sampled = stem.sampler.at(1).point;
    expect(tip).toEqual(sampled);
  });
});

describe('growLeaves', () => {
  it('is deterministic for the same seed', () => {
    const stem = generateStem(createRng('leaves-stem'), 100, 0.1);
    const a = growLeaves(createRng('leaves'), stem, GROWTH_PRESETS.eucalyptus);
    const b = growLeaves(createRng('leaves'), stem, GROWTH_PRESETS.eucalyptus);
    expect(a).toEqual(b);
  });

  it('respects the leaf-count range for every preset', () => {
    for (const [name, preset] of Object.entries(GROWTH_PRESETS)) {
      const stem = generateStem(createRng(`count-${name}`), 100, preset.curvature);
      const leaves = growLeaves(createRng(`count-${name}`), stem, preset);
      expect(leaves.length).toBeGreaterThanOrEqual(1);
      expect(leaves.length).toBeLessThanOrEqual(preset.leafCount[1]);
    }
  });

  it('produces only finite placement values', () => {
    const stem = generateStem(createRng('finite'), 100, 0.12);
    const leaves = growLeaves(createRng('finite'), stem, GROWTH_PRESETS.olive);
    for (const leaf of leaves) {
      expect(Number.isFinite(leaf.point.x)).toBe(true);
      expect(Number.isFinite(leaf.point.y)).toBe(true);
      expect(Number.isFinite(leaf.angle)).toBe(true);
      expect(leaf.scale).toBeGreaterThan(0);
    }
  });

  it('opposite arrangement places pairs at matching t', () => {
    const stem = generateStem(createRng('opp'), 100, GROWTH_PRESETS.laurel.curvature);
    const leaves = growLeaves(createRng('opp'), stem, GROWTH_PRESETS.laurel);
    for (let i = 0; i < leaves.length - 1; i += 2) {
      expect(leaves[i].t).toBeCloseTo(leaves[i + 1].t, 5);
      expect(leaves[i].side).not.toBe(leaves[i + 1].side);
    }
  });
});
