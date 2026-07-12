import { describe, it, expect } from 'vitest';
import { createRng } from '../engine/rng';
import { buildDesignSpecification } from '../trend/designIntelligence';
import type { KeywordBundle } from '../trend/designSpecTypes';
import { HIERARCHY_PRESETS } from '../engine/hierarchy';
import {
  mutateClusterDensity,
  mutateMotifScale,
  mutateOverlap,
  mutateHierarchy,
  mutatePaletteWeighting,
  mutateNegativeSpace,
  MUTATION_OPERATORS,
  MUTATION_TYPES,
  applyMutation,
  applyRandomMutation,
  applyRandomMutations,
} from './mutationEngine';

function makeBundle(overrides: Partial<KeywordBundle> = {}): KeywordBundle {
  return {
    primaryKeyword: 'Luxury Botanical', secondaryKeywords: ['Wallpaper'], marketplace: 'adobestock', season: 'spring',
    audience: 'editorial', commercialCategory: 'wallpaper', patternType: 'botanical', paletteDirection: 'muted green',
    difficulty: 'moderate', collectionSize: 8, ...overrides,
  };
}

function makeSpec() {
  return buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
}

describe('mutation operators never touch styleDnaId', () => {
  for (const type of MUTATION_TYPES) {
    it(`${type} preserves styleDnaId`, () => {
      const spec = makeSpec();
      const rng = createRng(`mutation-styledna-${type}`);
      const mutated = MUTATION_OPERATORS[type](spec, rng);
      expect(mutated.styleDnaId).toBe(spec.styleDnaId);
    });
  }
});

describe('mutateClusterDensity', () => {
  it('changes density and clamps within [0.05, 0.95]', () => {
    const spec = makeSpec();
    const rng = createRng('cluster-density-1');
    const mutated = mutateClusterDensity(spec, rng);
    expect(mutated.density).not.toBe(spec.density);
    expect(mutated.density).toBeGreaterThanOrEqual(0.05);
    expect(mutated.density).toBeLessThanOrEqual(0.95);
  });

  it('clamps at the floor for an already-minimal density', () => {
    const spec = { ...makeSpec(), density: 0.05 };
    for (let i = 0; i < 20; i++) {
      const mutated = mutateClusterDensity(spec, createRng(`floor-${i}`));
      expect(mutated.density).toBeGreaterThanOrEqual(0.05);
    }
  });
});

describe('mutateMotifScale', () => {
  it('changes exactly one hierarchy scale field, within the real preset-observed range', () => {
    const spec = makeSpec();
    const rng = createRng('motif-scale-1');
    const mutated = mutateMotifScale(spec, rng);
    const fields = ['heroScale', 'secondaryScale', 'fillerScale', 'accentScale'] as const;
    const changed = fields.filter((f) => mutated.hierarchy[f] !== spec.hierarchy[f]);
    expect(changed.length).toBe(1);
    const allPresetValues = Object.values(HIERARCHY_PRESETS).map((p) => p.value[changed[0]]);
    expect(mutated.hierarchy[changed[0]]).toBeGreaterThanOrEqual(Math.min(...allPresetValues));
    expect(mutated.hierarchy[changed[0]]).toBeLessThanOrEqual(Math.max(...allPresetValues));
  });

  it('leaves every other spec field untouched', () => {
    const spec = makeSpec();
    const mutated = mutateMotifScale(spec, createRng('motif-scale-2'));
    expect(mutated.density).toBe(spec.density);
    expect(mutated.palette).toEqual(spec.palette);
  });
});

describe('mutateOverlap', () => {
  it('is a real, distinct density lever from mutateClusterDensity (different jitter amount)', () => {
    const spec = makeSpec();
    const same_seed = 'overlap-vs-density';
    const overlapResult = mutateOverlap(spec, createRng(same_seed));
    const densityResult = mutateClusterDensity(spec, createRng(same_seed));
    // Same seed, same jitter *direction*, but the two operators use
    // different jitter magnitudes, so their outputs diverge.
    expect(overlapResult.density).not.toBe(densityResult.density);
  });
});

describe('mutateHierarchy', () => {
  it('always swaps to one of the real HIERARCHY_PRESETS values', () => {
    const spec = makeSpec();
    const mutated = mutateHierarchy(spec, createRng('hierarchy-1'));
    const matchesAPreset = Object.values(HIERARCHY_PRESETS).some((p) => JSON.stringify(p.value) === JSON.stringify(mutated.hierarchy));
    expect(matchesAPreset).toBe(true);
  });

  it('prefers a different preset than the one already active', () => {
    const spec = { ...makeSpec(), hierarchy: { ...HIERARCHY_PRESETS.heroFocus.value } };
    let sawDifferent = false;
    for (let i = 0; i < 15; i++) {
      const mutated = mutateHierarchy(spec, createRng(`hierarchy-diff-${i}`));
      if (JSON.stringify(mutated.hierarchy) !== JSON.stringify(spec.hierarchy)) sawDifferent = true;
    }
    expect(sawDifferent).toBe(true);
  });
});

describe('mutatePaletteWeighting', () => {
  it('keeps palette.id and the same 4 hex values, only reassigning which role gets which', () => {
    const spec = makeSpec();
    const mutated = mutatePaletteWeighting(spec, createRng('palette-weighting-1'));
    expect(mutated.palette).toEqual(spec.palette);
    const before = Object.values(spec.colorRoles).sort();
    const after = Object.values(mutated.colorRoles).sort();
    expect(after).toEqual(before);
  });

  it('actually changes which role holds which color at least once across several seeds', () => {
    const spec = makeSpec();
    let sawChange = false;
    for (let i = 0; i < 10; i++) {
      const mutated = mutatePaletteWeighting(spec, createRng(`palette-weighting-${i}`));
      if (JSON.stringify(mutated.colorRoles) !== JSON.stringify(spec.colorRoles)) sawChange = true;
    }
    expect(sawChange).toBe(true);
  });
});

describe('mutateNegativeSpace', () => {
  it('changes negativeSpace and clamps within [0.05, 0.95]', () => {
    const spec = makeSpec();
    const mutated = mutateNegativeSpace(spec, createRng('negative-space-1'));
    expect(mutated.negativeSpace).not.toBe(spec.negativeSpace);
    expect(mutated.negativeSpace).toBeGreaterThanOrEqual(0.05);
    expect(mutated.negativeSpace).toBeLessThanOrEqual(0.95);
  });
});

describe('applyMutation', () => {
  it('captures the real effect via diffJson, not a hand-written description', () => {
    const spec = makeSpec();
    const { spec: mutated, mutation } = applyMutation(spec, 'clusterDensity', createRng('apply-1'));
    expect(mutation.type).toBe('clusterDensity');
    expect(mutation.diff.length).toBeGreaterThan(0);
    expect(mutation.diff.every((d) => d.path.startsWith('$.density'))).toBe(true);
    expect(mutated.density).not.toBe(spec.density);
  });
});

describe('applyRandomMutation / applyRandomMutations', () => {
  it('applyRandomMutation picks one of the 6 named types', () => {
    const spec = makeSpec();
    const { mutation } = applyRandomMutation(spec, createRng('random-1'));
    expect(MUTATION_TYPES).toContain(mutation.type);
  });

  it('applyRandomMutations with extraMutationChance=0 always applies exactly 1 mutation', () => {
    const spec = makeSpec();
    const { mutations } = applyRandomMutations(spec, createRng('random-2'), 0);
    expect(mutations.length).toBe(1);
  });

  it('applyRandomMutations with extraMutationChance=1 stacks distinct mutation types up to the total available', () => {
    const spec = makeSpec();
    const { mutations, spec: mutated } = applyRandomMutations(spec, createRng('random-3'), 1);
    expect(mutations.length).toBeGreaterThan(1);
    const types = mutations.map((m) => m.type);
    expect(new Set(types).size).toBe(types.length);
    expect(mutated.styleDnaId).toBe(spec.styleDnaId);
  });
});
