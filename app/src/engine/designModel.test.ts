import { describe, it, expect } from 'vitest';
import { defaultParams } from './defaults';
import { cloneParams, hashParams, normalizeParams } from './designModel';

describe('cloneParams', () => {
  it('produces a deep-equal but independent copy', () => {
    const original = { ...defaultParams(), hierarchy: { ...defaultParams().hierarchy!, heroRatio: 0.2 }, customColors: ['#111111', '#222222'] };
    const clone = cloneParams(original);
    expect(clone).toEqual(original);
    expect(clone).not.toBe(original);
    expect(clone.hierarchy).not.toBe(original.hierarchy);
    expect(clone.customColors).not.toBe(original.customColors);
  });

  it('mutating the clone never affects the original', () => {
    const original = { ...defaultParams(), customColors: ['#111111'] };
    const clone = cloneParams(original);
    clone.customColors!.push('#222222');
    clone.density = 0.99;
    expect(original.customColors).toEqual(['#111111']);
    expect(original.density).not.toBe(0.99);
  });

  it('preserves undefined optional fields as undefined (not dropped/nulled)', () => {
    const original = { ...defaultParams(), customColors: undefined, mixCategoryIds: undefined };
    const clone = cloneParams(original);
    expect(clone.customColors).toBeUndefined();
    expect(clone.mixCategoryIds).toBeUndefined();
  });

  it('deep-clones compositionIntelligence independently of the original', () => {
    const original = { ...defaultParams(), compositionIntelligence: { balanceStrength: 0.7, rhythmStrength: 0.4 } };
    const clone = cloneParams(original);
    expect(clone.compositionIntelligence).toEqual(original.compositionIntelligence);
    expect(clone.compositionIntelligence).not.toBe(original.compositionIntelligence);
  });
});

describe('hashParams', () => {
  it('is deterministic for identical params', () => {
    const params = defaultParams();
    expect(hashParams(params)).toBe(hashParams(cloneParams(params)));
  });

  it('changes when any field changes', () => {
    const base = defaultParams();
    const changedSeed = { ...base, seed: `${base.seed}-x` };
    const changedDensity = { ...base, density: base.density + 0.1 };
    expect(hashParams(base)).not.toBe(hashParams(changedSeed));
    expect(hashParams(base)).not.toBe(hashParams(changedDensity));
  });

  it('is independent of object key insertion order', () => {
    const a = { ...defaultParams() };
    const b: typeof a = JSON.parse(JSON.stringify(a));
    // Re-insert keys in reverse order into a fresh object.
    const reordered = Object.keys(b)
      .reverse()
      .reduce((acc, k) => ({ ...acc, [k]: (b as Record<string, unknown>)[k] }), {} as typeof a);
    expect(hashParams(a)).toBe(hashParams(reordered));
  });
});

describe('normalizeParams', () => {
  it('clamps out-of-range and invalid numeric values to safe defaults/bounds', () => {
    const bad = {
      ...defaultParams(),
      colorCount: -5,
      density: 5,
      motifSize: -100,
      rotationJitter: 999,
      scaleJitter: -1,
      radialSymmetry: 0,
      negativeSpace: 5,
      overlapAmount: -5,
      compositionIntelligence: { balanceStrength: 5, rhythmStrength: -5 },
    };
    const normalized = normalizeParams(bad);
    expect(normalized.colorCount).toBeGreaterThanOrEqual(1);
    expect(normalized.density).toBeLessThanOrEqual(1);
    expect(normalized.motifSize).toBeGreaterThan(0);
    expect(normalized.rotationJitter).toBeLessThanOrEqual(180);
    expect(normalized.scaleJitter).toBeGreaterThanOrEqual(0);
    expect(normalized.radialSymmetry).toBeGreaterThanOrEqual(1);
    expect(normalized.negativeSpace).toBeLessThanOrEqual(1);
    expect(normalized.overlapAmount).toBeGreaterThanOrEqual(0);
    expect(normalized.compositionIntelligence!.balanceStrength).toBeLessThanOrEqual(1);
    expect(normalized.compositionIntelligence!.rhythmStrength).toBeGreaterThanOrEqual(0);
  });

  it('clamps out-of-range V2 compositionIntelligence fields and drops an invalid flowProfile', () => {
    const bad = {
      ...defaultParams(),
      compositionIntelligence: {
        balanceStrength: 0.5,
        rhythmStrength: 0.35,
        attractionStrength: 5,
        negativeSpaceStrength: -5,
        flowBiasStrength: 99,
        flowProfile: 'sideways' as never,
      },
    };
    const normalized = normalizeParams(bad);
    expect(normalized.compositionIntelligence!.attractionStrength).toBeLessThanOrEqual(1);
    expect(normalized.compositionIntelligence!.negativeSpaceStrength).toBeGreaterThanOrEqual(0);
    expect(normalized.compositionIntelligence!.flowBiasStrength).toBeLessThanOrEqual(1);
    expect(normalized.compositionIntelligence!.flowProfile).toBeUndefined();
  });

  it('preserves a valid flowProfile and leaves unset V2 fields unset (no fabricated values)', () => {
    const params = {
      ...defaultParams(),
      compositionIntelligence: { balanceStrength: 0.5, rhythmStrength: 0.35, flowProfile: 'dynamic' as const },
    };
    const normalized = normalizeParams(params);
    expect(normalized.compositionIntelligence!.flowProfile).toBe('dynamic');
    expect(normalized.compositionIntelligence!.attractionStrength).toBeUndefined();
    expect(normalized.compositionIntelligence!.negativeSpaceStrength).toBeUndefined();
    expect(normalized.compositionIntelligence!.flowBiasStrength).toBeUndefined();
  });

  it('handles NaN gracefully by falling back to a sane default', () => {
    const bad = { ...defaultParams(), density: NaN, motifSize: NaN };
    const normalized = normalizeParams(bad);
    expect(Number.isFinite(normalized.density)).toBe(true);
    expect(Number.isFinite(normalized.motifSize)).toBe(true);
  });

  it('leaves already-valid params unchanged', () => {
    const valid = defaultParams();
    const normalized = normalizeParams(valid);
    expect(normalized.density).toBe(valid.density);
    expect(normalized.motifSize).toBe(valid.motifSize);
    expect(normalized.colorCount).toBe(valid.colorCount);
  });

  it('does not mutate the input', () => {
    const original = defaultParams();
    const originalCopy = { ...original };
    normalizeParams({ ...original, density: 5 });
    expect(original).toEqual(originalCopy);
  });
});
