import { describe, it, expect } from 'vitest';
import { buildDesignSpecification } from '../trend/designIntelligence';
import type { KeywordBundle } from '../trend/designSpecTypes';
import { generateInitialPopulation } from './candidateGenerator';

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

describe('generateInitialPopulation', () => {
  it('supports a configurable candidate count', () => {
    expect(generateInitialPopulation(makeSpec(), 'gen-count-1', 3).length).toBe(3);
    expect(generateInitialPopulation(makeSpec(), 'gen-count-1', 8).length).toBe(8);
  });

  it('candidate 0 is always the untouched seed spec (elitism baseline)', () => {
    const spec = makeSpec();
    const population = generateInitialPopulation(spec, 'gen-elite-1', 5);
    expect(population[0].spec).toEqual(spec);
    expect(population[0].dna.appliedMutations).toEqual([]);
    expect(population[0].dna.parentIds).toEqual([]);
  });

  it('every other candidate has at least one real applied mutation', () => {
    const population = generateInitialPopulation(makeSpec(), 'gen-mutated-1', 4);
    for (const candidate of population.slice(1)) {
      expect(candidate.dna.appliedMutations.length).toBeGreaterThanOrEqual(1);
      expect(candidate.spec).not.toEqual(population[0].spec);
    }
  });

  it('every candidate preserves styleDnaId', () => {
    const spec = makeSpec();
    const population = generateInitialPopulation(spec, 'gen-styledna-1', 5);
    for (const candidate of population) {
      expect(candidate.spec.styleDnaId).toBe(spec.styleDnaId);
    }
  });

  it('every candidate id is unique and generation is 0', () => {
    const population = generateInitialPopulation(makeSpec(), 'gen-ids-1', 6);
    const ids = population.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const candidate of population) expect(candidate.dna.generation).toBe(0);
  });

  it('is fully reproducible for the same (seedSpec, seed, count)', () => {
    const spec = makeSpec();
    const a = generateInitialPopulation(spec, 'gen-repro-1', 5);
    const b = generateInitialPopulation(spec, 'gen-repro-1', 5);
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
    expect(a.map((c) => c.spec)).toEqual(b.map((c) => c.spec));
  });

  it('clamps count to at least 1', () => {
    expect(generateInitialPopulation(makeSpec(), 'gen-min-1', 0).length).toBe(1);
    expect(generateInitialPopulation(makeSpec(), 'gen-min-1', -3).length).toBe(1);
  });
});
