import { describe, it, expect } from 'vitest';
import { buildTile } from './tile';
import { defaultParams } from './defaults';
import { serialize } from './svgAst';
import { GENERATORS } from '../generators';
import { LAYOUTS } from '../layouts';
import { HIERARCHY_PRESETS } from './hierarchy';
import type { GenerateParams } from './types';

describe('buildTile: seeded reproducibility', () => {
  it('the same seed + params produce byte-identical SVG output', () => {
    const params = { ...defaultParams(), seed: 'reproducibility-check' };
    const a = serialize(buildTile(params).svg);
    const b = serialize(buildTile(params).svg);
    expect(a).toBe(b);
  });

  it('a different seed produces different output', () => {
    const base = defaultParams();
    const a = serialize(buildTile({ ...base, seed: 'seed-a' }).svg);
    const b = serialize(buildTile({ ...base, seed: 'seed-b' }).svg);
    expect(a).not.toBe(b);
  });
});

describe('buildTile: SVG validity', () => {
  it('never emits raster images or base64 data URIs', () => {
    const svg = serialize(buildTile({ ...defaultParams(), seed: 'validity-1' }).svg);
    expect(svg).not.toMatch(/<image/i);
    expect(svg).not.toMatch(/data:image/i);
    expect(svg).not.toMatch(/base64/i);
  });

  it('every motif group id is unique within the tile', () => {
    const svg = serialize(buildTile({ ...defaultParams(), seed: 'validity-2' }).svg);
    const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not use disallowed filter/blur/mask effects that break EPS export', () => {
    const svg = serialize(buildTile({ ...defaultParams(), seed: 'validity-3' }).svg);
    expect(svg).not.toMatch(/<filter/i);
    expect(svg).not.toMatch(/feGaussianBlur/i);
    expect(svg).not.toMatch(/<mask/i);
  });
});

describe('buildTile: every layout x a sample of categories builds without throwing', () => {
  const categories = ['botanical', 'geometric', 'mandala', 'tropical', 'animalprint'];
  const layoutIds = Object.keys(LAYOUTS) as GenerateParams['layoutId'][];

  for (const layoutId of layoutIds) {
    for (const categoryId of categories) {
      it(`${layoutId} x ${categoryId} (with hierarchy + negativeSpace + overlapAmount set)`, () => {
        const generator = GENERATORS[categoryId];
        const params: GenerateParams = {
          ...defaultParams(),
          categoryId,
          layoutId,
          motifSize: generator.defaultMotifSize,
          hierarchy: HIERARCHY_PRESETS.heroFocus.value,
          negativeSpace: 0.3,
          overlapAmount: 0.2,
          seed: `smoke-${layoutId}-${categoryId}`,
        };
        expect(() => buildTile(params)).not.toThrow();
      });
    }
  }
});

describe('buildTile: backward compatibility', () => {
  it('a params object with no hierarchy/negativeSpace/overlapAmount/artDirection fields (pre-v1.23 shape) still builds', () => {
    const legacy = { ...defaultParams(), seed: 'legacy-1' };
    delete (legacy as Partial<GenerateParams>).hierarchy;
    delete (legacy as Partial<GenerateParams>).negativeSpace;
    delete (legacy as Partial<GenerateParams>).overlapAmount;
    delete (legacy as Partial<GenerateParams>).artDirection;
    expect(() => buildTile(legacy)).not.toThrow();
  });

  it('undefined hierarchy produces the exact same output as before the Hierarchy Engine existed (no data-role attrs)', () => {
    const params = { ...defaultParams(), hierarchy: undefined, seed: 'legacy-2' };
    const svg = serialize(buildTile(params).svg);
    expect(svg).not.toMatch(/data-role/);
  });
});

describe('buildTile: Hierarchy Engine', () => {
  it('emits data-role attributes when hierarchy is set on a non-exempt layout', () => {
    const params: GenerateParams = {
      ...defaultParams(),
      layoutId: 'grid',
      hierarchy: HIERARCHY_PRESETS.heroFocus.value,
      seed: 'hier-role-1',
    };
    const svg = serialize(buildTile(params).svg);
    expect(svg).toMatch(/data-role="(hero|secondary|filler|accent)"/);
  });

  it('does not apply the hierarchy pass on exempt layouts (bouquet already builds its own tiers)', () => {
    const params: GenerateParams = {
      ...defaultParams(),
      layoutId: 'bouquet',
      hierarchy: HIERARCHY_PRESETS.heroFocus.value,
      seed: 'hier-role-2',
    };
    const svg = serialize(buildTile(params).svg);
    expect(svg).not.toMatch(/data-role/);
  });
});

describe('buildTile: Composition Intelligence Engine', () => {
  it('a params object with no compositionIntelligence field (pre-v1.29 shape) still builds', () => {
    const legacy = { ...defaultParams(), seed: 'ci-legacy-1' };
    delete (legacy as Partial<GenerateParams>).compositionIntelligence;
    expect(() => buildTile(legacy)).not.toThrow();
  });

  it('undefined compositionIntelligence produces identical output to the field being entirely absent', () => {
    const withField = { ...defaultParams(), compositionIntelligence: undefined, seed: 'ci-legacy-2' };
    const withoutField = { ...defaultParams(), seed: 'ci-legacy-2' } as Partial<GenerateParams>;
    delete withoutField.compositionIntelligence;
    expect(serialize(buildTile(withField).svg)).toBe(serialize(buildTile(withoutField as GenerateParams).svg));
  });

  it('actually changes the generated geometry for at least one real scenario (not a silent no-op when enabled)', () => {
    let foundDifference = false;
    for (let i = 0; i < 20 && !foundDifference; i++) {
      const base: GenerateParams = { ...defaultParams(), layoutId: 'scatter', density: 0.15, motifSize: 150, seed: `ci-diff-${i}` };
      const off = serialize(buildTile({ ...base, compositionIntelligence: undefined }).svg);
      const on = serialize(buildTile({ ...base, compositionIntelligence: { balanceStrength: 1, rhythmStrength: 1 } }).svg);
      if (off !== on) foundDifference = true;
    }
    expect(foundDifference).toBe(true);
  });

  it('same seed + settings with the feature on reproduce byte-identical output (determinism preserved)', () => {
    const params: GenerateParams = { ...defaultParams(), compositionIntelligence: { balanceStrength: 0.8, rhythmStrength: 0.5 }, seed: 'ci-determinism' };
    expect(serialize(buildTile(params).svg)).toBe(serialize(buildTile(params).svg));
  });

  it('never produces NaN/Infinity or duplicate ids across several layouts with the feature at full strength', () => {
    const layoutIds: GenerateParams['layoutId'][] = ['grid', 'scatter', 'halfDrop', 'sCurve', 'toss'];
    for (const layoutId of layoutIds) {
      const svg = serialize(
        buildTile({
          ...defaultParams(),
          layoutId,
          compositionIntelligence: { balanceStrength: 1, rhythmStrength: 1 },
          seed: `ci-robust-${layoutId}`,
        }).svg,
      );
      expect(svg).not.toMatch(/NaN|Infinity/);
      const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
