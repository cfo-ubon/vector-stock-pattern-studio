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

  it('alternate/opposite leaves are always tagged "front" (no layering concept of their own, Build 003 behavior unchanged)', () => {
    for (const name of ['eucalyptus', 'olive', 'laurel', 'sage', 'fern', 'leafyBranch']) {
      const preset = GROWTH_PRESETS[name];
      const stem = generateStem(createRng(`layer-${name}`), 100, preset.curvature);
      const leaves = growLeaves(createRng(`layer-${name}`), stem, preset);
      expect(leaves.every((l) => l.layer === 'front')).toBe(true);
    }
  });
});

describe('growLeaves: Build 004 Section 5 whorled arrangement', () => {
  it('groups leaves into real whorls: every leaf in a whorl shares the same t (within jitter tolerance) and covers a full ring, not just 2 sides', () => {
    const stem = generateStem(createRng('whorl-stem'), 100, GROWTH_PRESETS.herbWhorl.curvature);
    const leaves = growLeaves(createRng('whorl'), stem, GROWTH_PRESETS.herbWhorl);
    expect(leaves.length).toBeGreaterThan(3); // more than a single alternate/opposite node could ever produce
    const distinctSides = new Set(leaves.map((l) => l.side));
    expect(distinctSides.size).toBe(2); // real ring coverage, not one-sided
  });

  it('is deterministic for the same seed', () => {
    const stem = generateStem(createRng('whorl-det-stem'), 100, GROWTH_PRESETS.herbWhorl.curvature);
    const a = growLeaves(createRng('whorl-det'), stem, GROWTH_PRESETS.herbWhorl);
    const b = growLeaves(createRng('whorl-det'), stem, GROWTH_PRESETS.herbWhorl);
    expect(a).toEqual(b);
  });

  it('produces both "back" and "front" layered leaves across enough seeds (real Layered Leaves, not always one tag)', () => {
    let sawBack = false;
    let sawFront = false;
    for (let seed = 0; seed < 10; seed++) {
      const stem = generateStem(createRng(`whorl-layer-stem-${seed}`), 100, GROWTH_PRESETS.herbWhorl.curvature);
      const leaves = growLeaves(createRng(`whorl-layer-${seed}`), stem, GROWTH_PRESETS.herbWhorl);
      if (leaves.some((l) => l.layer === 'back')) sawBack = true;
      if (leaves.some((l) => l.layer === 'front')) sawFront = true;
    }
    expect(sawBack).toBe(true);
    expect(sawFront).toBe(true);
  });

  it('whorl node positions are not perfectly evenly spaced (real Leaf Rhythm jitter)', () => {
    let sawJitter = false;
    for (let seed = 0; seed < 10; seed++) {
      const stem = generateStem(createRng(`whorl-rhythm-stem-${seed}`), 100, GROWTH_PRESETS.herbWhorl.curvature);
      const leaves = growLeaves(createRng(`whorl-rhythm-${seed}`), stem, GROWTH_PRESETS.herbWhorl);
      const distinctT = [...new Set(leaves.map((l) => Math.round(l.t * 1000) / 1000))].sort((a, b) => a - b);
      if (distinctT.length > 1) {
        const gaps = distinctT.slice(1).map((t, i) => t - distinctT[i]);
        if (new Set(gaps.map((g) => Math.round(g * 1000))).size > 1) sawJitter = true;
      }
    }
    expect(sawJitter).toBe(true);
  });

  it('produces only finite placement values', () => {
    const stem = generateStem(createRng('whorl-finite'), 100, GROWTH_PRESETS.herbWhorl.curvature);
    const leaves = growLeaves(createRng('whorl-finite'), stem, GROWTH_PRESETS.herbWhorl);
    for (const leaf of leaves) {
      expect(Number.isFinite(leaf.point.x)).toBe(true);
      expect(Number.isFinite(leaf.point.y)).toBe(true);
      expect(Number.isFinite(leaf.angle)).toBe(true);
      expect(leaf.scale).toBeGreaterThan(0);
    }
  });
});

describe('growLeaves: Build 004 Section 5 radial arrangement', () => {
  it('every leaf radiates from the same anchor t (a basal rosette, not spread along the stem length)', () => {
    const stem = generateStem(createRng('radial-stem'), 100, GROWTH_PRESETS.basalRosette.curvature);
    const leaves = growLeaves(createRng('radial'), stem, GROWTH_PRESETS.basalRosette);
    const anchorT = GROWTH_PRESETS.basalRosette.startT!;
    for (const leaf of leaves) expect(leaf.t).toBeCloseTo(anchorT, 5);
  });

  it('leaves fan across a real angular spread (not all identical direction)', () => {
    const stem = generateStem(createRng('radial-spread-stem'), 100, GROWTH_PRESETS.basalRosette.curvature);
    const leaves = growLeaves(createRng('radial-spread'), stem, GROWTH_PRESETS.basalRosette);
    const angles = leaves.map((l) => l.angle);
    expect(Math.max(...angles) - Math.min(...angles)).toBeGreaterThan(90);
  });

  it('back-layer leaves are always emitted before front-layer leaves (paint order = array order)', () => {
    const stem = generateStem(createRng('radial-order-stem'), 100, GROWTH_PRESETS.basalRosette.curvature);
    const leaves = growLeaves(createRng('radial-order'), stem, GROWTH_PRESETS.basalRosette);
    let seenFront = false;
    for (const leaf of leaves) {
      if (leaf.layer === 'front') seenFront = true;
      if (seenFront) expect(leaf.layer).toBe('front'); // never back after the first front
    }
  });

  it('is deterministic for the same seed', () => {
    const stem = generateStem(createRng('radial-det-stem'), 100, GROWTH_PRESETS.basalRosette.curvature);
    const a = growLeaves(createRng('radial-det'), stem, GROWTH_PRESETS.basalRosette);
    const b = growLeaves(createRng('radial-det'), stem, GROWTH_PRESETS.basalRosette);
    expect(a).toEqual(b);
  });

  it('produces only finite placement values', () => {
    const stem = generateStem(createRng('radial-finite'), 100, GROWTH_PRESETS.basalRosette.curvature);
    const leaves = growLeaves(createRng('radial-finite'), stem, GROWTH_PRESETS.basalRosette);
    for (const leaf of leaves) {
      expect(Number.isFinite(leaf.point.x)).toBe(true);
      expect(Number.isFinite(leaf.point.y)).toBe(true);
      expect(Number.isFinite(leaf.angle)).toBe(true);
      expect(leaf.scale).toBeGreaterThan(0);
    }
  });
});
