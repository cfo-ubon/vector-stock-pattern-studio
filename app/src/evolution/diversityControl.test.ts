import { describe, it, expect } from 'vitest';
import { buildDesignSpecification } from '../trend/designIntelligence';
import type { KeywordBundle } from '../trend/designSpecTypes';
import { measureDistance, averagePairwiseDistance, enforceDiversity } from './diversityControl';
import type { EvaluatedCandidate } from './types';

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

function fakeCandidate(id: string, score: number, specOverrides: Partial<ReturnType<typeof makeSpec>> = {}): EvaluatedCandidate {
  return {
    id,
    spec: { ...makeSpec(), ...specOverrides },
    dna: { candidateId: id, generation: 0, parentIds: [], appliedMutations: [], crossover: null },
    fitness: {
      score,
      rejected: false,
      critique: { composition: score, hierarchy: score, balance: score, rhythm: score, flow: score, clusterQuality: score, negativeSpace: score, overlap: score, repeatQuality: score, motifDiversity: score, commercialReadiness: score, overall: score },
      gate: { passed: true, blockingProblems: [], meetsCommercialBar: true, message: '' },
      meetsCommercialBar: true,
    },
    report: {} as EvaluatedCandidate['report'],
  };
}

describe('measureDistance', () => {
  it('is 0 for identical specs', () => {
    const spec = makeSpec();
    expect(measureDistance(spec, spec)).toBe(0);
  });

  it('is greater than 0 for specs differing in one field', () => {
    const a = makeSpec();
    const b = { ...a, density: a.density + 0.2 };
    expect(measureDistance(a, b)).toBeGreaterThan(0);
  });

  it('grows with the number of differing fields', () => {
    const a = makeSpec();
    const oneFieldChanged = { ...a, density: a.density + 0.2 };
    const threeFieldsChanged = { ...a, density: a.density + 0.2, negativeSpace: a.negativeSpace + 0.2, composition: 'maximalist' as const };
    expect(measureDistance(a, threeFieldsChanged)).toBeGreaterThan(measureDistance(a, oneFieldChanged));
  });
});

describe('averagePairwiseDistance', () => {
  it('is 0 for a single spec or empty list', () => {
    expect(averagePairwiseDistance([])).toBe(0);
    expect(averagePairwiseDistance([makeSpec()])).toBe(0);
  });

  it('is 0 when every spec is identical', () => {
    const spec = makeSpec();
    expect(averagePairwiseDistance([spec, spec, spec])).toBe(0);
  });

  it('is greater than 0 when specs differ', () => {
    const a = makeSpec();
    const b = { ...a, density: a.density + 0.3 };
    expect(averagePairwiseDistance([a, b])).toBeGreaterThan(0);
  });
});

describe('enforceDiversity', () => {
  it('keeps the highest-fitness candidate when two are near-identical (below minDistance)', () => {
    const a = fakeCandidate('a', 90);
    const bNearDuplicate = fakeCandidate('b', 80, { density: a.spec.density + 0.001 });
    const c = fakeCandidate('c', 60, { density: 0.9, negativeSpace: 0.9, composition: 'minimal' });
    // minDistance (2) sits strictly between b's real distance from a (1
    // changed field) and c's (3 changed fields), and targetSize (2) is
    // smaller than the pool (3) so there's real room to drop the
    // near-duplicate without needing to top back up.
    expect(measureDistance(a.spec, bNearDuplicate.spec)).toBeLessThan(2);
    expect(measureDistance(a.spec, c.spec)).toBeGreaterThanOrEqual(2);
    const result = enforceDiversity([a, bNearDuplicate, c], 2, 2);
    expect(result.map((r) => r.id)).toContain('a');
    expect(result.map((r) => r.id)).not.toContain('b');
  });

  it('tops back up to targetSize from the dropped pool when diversity pruning would shrink it too far', () => {
    const a = fakeCandidate('a', 90);
    const bNearDuplicate = fakeCandidate('b', 80, { density: a.spec.density + 0.001 });
    const result = enforceDiversity([a, bNearDuplicate], 5, 2);
    expect(result.length).toBe(2);
  });

  it('never returns more than the input pool size', () => {
    const pool = [fakeCandidate('a', 90), fakeCandidate('b', 70)];
    const result = enforceDiversity(pool, 0, 5);
    expect(result.length).toBe(2);
  });

  it('keeps all candidates when minDistance is 0', () => {
    const pool = [fakeCandidate('a', 90), fakeCandidate('b', 90), fakeCandidate('c', 90)];
    const result = enforceDiversity(pool, 0, 3);
    expect(result.length).toBe(3);
  });
});
