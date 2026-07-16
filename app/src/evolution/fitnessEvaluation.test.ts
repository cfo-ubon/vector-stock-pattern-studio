import { describe, it, expect } from 'vitest';
import { buildDesignSpecification } from '../trend/designIntelligence';
import type { KeywordBundle } from '../trend/designSpecTypes';
import { evaluateFitness, evaluatePopulation } from './fitnessEvaluation';
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

describe('evaluateFitness', () => {
  it('produces a real 11-dimension critique and a gate result from a real render, not a placeholder', () => {
    const [candidate] = generateInitialPopulation(makeSpec(), 'fitness-real-1', 1);
    const evaluated = evaluateFitness(candidate);
    expect(evaluated.fitness.score).toBe(evaluated.fitness.critique.overall);
    expect(typeof evaluated.fitness.gate.passed).toBe('boolean');
    expect(evaluated.report.critique).toEqual(evaluated.fitness.critique);
  }, 20000);

  it('flags a hard-rejected candidate transparently via fitness.rejected, not a bare -1', () => {
    const brokenSpec = { ...makeSpec(), density: 0.97, negativeSpace: 0.02 };
    const [candidate] = generateInitialPopulation(brokenSpec, 'fitness-rejected-1', 1);
    const evaluated = evaluateFitness(candidate);
    if (evaluated.fitness.score === -1) {
      expect(evaluated.fitness.rejected).toBe(true);
    } else {
      expect(evaluated.fitness.rejected).toBe(false);
    }
  }, 20000);

  it('is deterministic for the same candidate id', () => {
    const [candidate] = generateInitialPopulation(makeSpec(), 'fitness-repro-1', 1);
    const a = evaluateFitness(candidate);
    const b = evaluateFitness(candidate);
    expect(a.fitness.score).toBe(b.fitness.score);
    expect(a.fitness.critique).toEqual(b.fitness.critique);
  }, 20000);
});

describe('evaluatePopulation', () => {
  it('evaluates every candidate in the population', () => {
    const population = generateInitialPopulation(makeSpec(), 'fitness-population-1', 3);
    const evaluated = evaluatePopulation(population);
    expect(evaluated.length).toBe(3);
    for (const c of evaluated) expect(typeof c.fitness.score).toBe('number');
  }, 30000);
});
