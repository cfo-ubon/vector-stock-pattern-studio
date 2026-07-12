import { describe, it, expect } from 'vitest';
import { buildDesignSpecification } from '../trend/designIntelligence';
import type { KeywordBundle } from '../trend/designSpecTypes';
import { runEvolution } from './evolutionEngine';
import { summarizeTimeline } from './evolutionTimeline';

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

describe('runEvolution: structural guarantees', () => {
  it('runs at least one generation and returns a real best candidate', () => {
    const result = runEvolution(makeSpec(), 'evo-basic-1', { populationSize: 3, maxGenerations: 2 });
    expect(result.timeline.length).toBeGreaterThan(0);
    expect(result.best).toBeDefined();
    expect(result.generationsUsed).toBe(result.timeline.length);
  }, 60000);

  it('elitism guarantees the recorded best score never regresses across generations', () => {
    const result = runEvolution(makeSpec(), 'evo-monotonic-1', { populationSize: 4, maxGenerations: 3 });
    const summary = summarizeTimeline(result.timeline);
    expect(summary.monotonicallyImproved).toBe(true);
  }, 90000);

  it('every generation has exactly populationSize candidates', () => {
    const result = runEvolution(makeSpec(), 'evo-popsize-1', { populationSize: 4, maxGenerations: 3 });
    for (const gen of result.timeline) expect(gen.candidates.length).toBe(4);
  }, 90000);

  it('is fully reproducible for the same (seedSpec, seed, config)', () => {
    const spec = makeSpec();
    const a = runEvolution(spec, 'evo-repro-1', { populationSize: 3, maxGenerations: 2 });
    const b = runEvolution(spec, 'evo-repro-1', { populationSize: 3, maxGenerations: 2 });
    expect(a.best.id).toBe(b.best.id);
    expect(a.best.fitness.score).toBe(b.best.fitness.score);
    expect(a.timeline.map((g) => g.bestScore)).toEqual(b.timeline.map((g) => g.bestScore));
  }, 90000);
});

describe('runEvolution: genuine convergence', () => {
  it('recovers from a fully hard-rejected starting population to a real, non-rejected best candidate, improving generation over generation', () => {
    // This exact spec + seed pair is load-bearing: it's the specific
    // combination that was empirically confirmed (against real generated
    // data, before this test was written) to produce a fully
    // hard-rejected generation 0 — a different base spec or seed can and
    // does land generation 0 somewhere else on the search space entirely
    // (evolution is a stochastic search, not a fixed sequence), so this
    // test is about the *mechanism*'s ability to recover from that
    // specific, real, previously-observed state, mirroring the exact
    // condition `critic/improvementLoop.ts` guards against.
    const geometricBundle: KeywordBundle = {
      primaryKeyword: 'Grid Pattern', secondaryKeywords: [], marketplace: 'adobestock', season: 'spring',
      audience: 'editorial', commercialCategory: 'wallpaper', patternType: 'geometric',
      paletteDirection: '', difficulty: 'moderate', collectionSize: 8,
    };
    const geometricSpec = buildDesignSpecification({ keywordBundle: geometricBundle, trendPackId: undefined, createdAt: 1000 });
    const spec = { ...geometricSpec, negativeSpace: 0.18, density: 0.6 };
    const result = runEvolution(spec, 'dee-sanity-moderate-1', { populationSize: 6, maxGenerations: 4, mutationRate: 0.75, crossoverRate: 0.6 });

    expect(result.timeline[0].bestScore).toBe(-1);
    expect(result.best.fitness.rejected).toBe(false);
    expect(result.best.fitness.score).toBeGreaterThan(result.timeline[0].bestScore);

    const summary = summarizeTimeline(result.timeline);
    expect(summary.monotonicallyImproved).toBe(true);
    expect(summary.scoreDelta).toBeGreaterThan(0);

    // Population health (average score) also climbs once a working
    // candidate is found — evolution isn't just carrying one lucky
    // survivor, the rest of the population improves alongside it.
    const lastGen = result.timeline[result.timeline.length - 1];
    const firstNonRejectedGen = result.timeline.find((g) => g.bestScore > -1)!;
    expect(lastGen.averageScore).toBeGreaterThanOrEqual(firstNonRejectedGen.averageScore);
  }, 120000);
});

describe('runEvolution: Design DNA lineage', () => {
  it('generation 0 candidates have no parents; later generations trace back to real parent ids', () => {
    const result = runEvolution(makeSpec(), 'evo-dna-1', { populationSize: 3, maxGenerations: 2 });
    const gen0Ids = new Set(result.timeline[0].candidates.map((c) => c.id));
    for (const candidate of result.timeline[0].candidates) {
      expect(candidate.dna.parentIds.length).toBe(0);
    }
    if (result.timeline.length > 1) {
      for (const candidate of result.timeline[1].candidates) {
        if (candidate.dna.generation === 0) continue; // the carried-over elite
        for (const parentId of candidate.dna.parentIds) {
          expect(gen0Ids.has(parentId)).toBe(true);
        }
      }
    }
  }, 90000);

  it('a crossover child records both parent ids and which trait came from which parent', () => {
    const result = runEvolution(makeSpec(), 'evo-dna-crossover-1', { populationSize: 6, maxGenerations: 2, crossoverRate: 1 });
    if (result.timeline.length > 1) {
      const crossoverChildren = result.timeline[1].candidates.filter((c) => c.dna.crossover !== null);
      for (const child of crossoverChildren) {
        expect(child.dna.parentIds.length).toBe(2);
        expect(child.dna.crossover!.traitsFromA.length + child.dna.crossover!.traitsFromB.length).toBe(4);
      }
    }
  }, 90000);
});

describe('runEvolution: stopping conditions', () => {
  it('honors maxGenerations as a hard cap', () => {
    const result = runEvolution(makeSpec(), 'evo-stop-maxgen-1', { populationSize: 3, maxGenerations: 2 });
    expect(result.generationsUsed).toBeLessThanOrEqual(2);
    expect(result.stoppedReason).toContain('maximum of 2 generation');
  }, 90000);

  it('stops early once a trivially low quality threshold is met', () => {
    const result = runEvolution(makeSpec(), 'evo-stop-threshold-1', { populationSize: 3, maxGenerations: 5, qualityThreshold: 1 });
    expect(result.generationsUsed).toBeLessThan(5);
    expect(result.stoppedReason).toContain('quality threshold');
  }, 90000);

  it('honors maxEvaluations as a hard compute budget', () => {
    const result = runEvolution(makeSpec(), 'evo-stop-evals-1', { populationSize: 4, maxGenerations: 10, maxEvaluations: 4 });
    expect(result.evaluationsUsed).toBeLessThanOrEqual(6);
    expect(result.stoppedReason).toContain('fitness evaluation');
  }, 90000);
});

describe('runEvolution: transparent scoring', () => {
  it('the winning candidate carries its full real critique breakdown, not just one number', () => {
    const result = runEvolution(makeSpec(), 'evo-transparent-1', { populationSize: 3, maxGenerations: 2 });
    expect(Object.keys(result.best.fitness.critique).length).toBeGreaterThanOrEqual(11);
    expect(result.best.fitness.score).toBe(result.best.fitness.critique.overall);
  }, 90000);
});
