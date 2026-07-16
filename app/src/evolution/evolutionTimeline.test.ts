import { describe, it, expect } from 'vitest';
import { buildDesignSpecification } from '../trend/designIntelligence';
import type { KeywordBundle } from '../trend/designSpecTypes';
import { recordGeneration, compareGenerations, summarizeTimeline } from './evolutionTimeline';
import type { EvaluatedCandidate, EvolutionTimeline } from './types';

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

describe('recordGeneration', () => {
  it('identifies the highest-scoring candidate as best', () => {
    const record = recordGeneration(0, [fakeCandidate('a', 40), fakeCandidate('b', 90), fakeCandidate('c', 60)]);
    expect(record.bestCandidateId).toBe('b');
    expect(record.bestScore).toBe(90);
  });

  it('computes the real average score', () => {
    const record = recordGeneration(0, [fakeCandidate('a', 40), fakeCandidate('b', 60)]);
    expect(record.averageScore).toBe(50);
  });

  it('computes a real diversity distance from the real specs, not a placeholder', () => {
    const record = recordGeneration(0, [fakeCandidate('a', 40, { density: 0.2 }), fakeCandidate('b', 60, { density: 0.9, composition: 'maximalist' })]);
    expect(record.diversityAverageDistance).toBeGreaterThan(0);
  });
});

describe('compareGenerations', () => {
  it('reports the real score deltas between two generations', () => {
    const genA = recordGeneration(0, [fakeCandidate('a', 40)]);
    const genB = recordGeneration(1, [fakeCandidate('b', 70)]);
    const comparison = compareGenerations(genA, genB);
    expect(comparison.bestScoreDelta).toBe(30);
    expect(comparison.fromIndex).toBe(0);
    expect(comparison.toIndex).toBe(1);
  });

  it('reports the exact real field-level diff between the two generations\' best specs', () => {
    const genA = recordGeneration(0, [fakeCandidate('a', 40, { density: 0.3 })]);
    const genB = recordGeneration(1, [fakeCandidate('b', 70, { density: 0.8 })]);
    const comparison = compareGenerations(genA, genB);
    expect(comparison.bestSpecDiff.some((d) => d.path === '$.density')).toBe(true);
  });
});

describe('summarizeTimeline', () => {
  it('flags a monotonically non-decreasing best score as improved', () => {
    const timeline: EvolutionTimeline = [
      recordGeneration(0, [fakeCandidate('a', 40)]),
      recordGeneration(1, [fakeCandidate('b', 50)]),
      recordGeneration(2, [fakeCandidate('c', 65)]),
    ];
    const summary = summarizeTimeline(timeline);
    expect(summary.monotonicallyImproved).toBe(true);
    expect(summary.scoreDelta).toBe(25);
    expect(summary.generations).toBe(3);
  });

  it('flags a regression as not monotonically improved', () => {
    const timeline: EvolutionTimeline = [
      recordGeneration(0, [fakeCandidate('a', 60)]),
      recordGeneration(1, [fakeCandidate('b', 40)]),
    ];
    const summary = summarizeTimeline(timeline);
    expect(summary.monotonicallyImproved).toBe(false);
  });

  it('treats a single flat generation as monotonically improved (0 delta, no regression)', () => {
    const timeline: EvolutionTimeline = [recordGeneration(0, [fakeCandidate('a', 50)])];
    const summary = summarizeTimeline(timeline);
    expect(summary.monotonicallyImproved).toBe(true);
    expect(summary.scoreDelta).toBe(0);
  });
});
