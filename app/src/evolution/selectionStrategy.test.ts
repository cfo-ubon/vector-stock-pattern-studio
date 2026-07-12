import { describe, it, expect } from 'vitest';
import { createRng } from '../engine/rng';
import { selectCandidates } from './selectionStrategy';
import type { EvaluatedCandidate } from './types';

function fakeCandidate(id: string, score: number): EvaluatedCandidate {
  return {
    id,
    spec: {} as EvaluatedCandidate['spec'],
    dna: { candidateId: id, generation: 0, parentIds: [], appliedMutations: [], crossover: null },
    fitness: {
      score,
      rejected: false,
      critique: { composition: score, hierarchy: score, balance: score, rhythm: score, flow: score, clusterQuality: score, negativeSpace: score, overlap: score, repeatQuality: score, motifDiversity: score, commercialReadiness: score, overall: score },
      gate: { passed: score >= 50, blockingProblems: [], meetsCommercialBar: score >= 50, message: '' },
      meetsCommercialBar: score >= 50,
    },
    report: {} as EvaluatedCandidate['report'],
  };
}

const pool = [fakeCandidate('a', 90), fakeCandidate('b', 70), fakeCandidate('c', 50), fakeCandidate('d', 30), fakeCandidate('e', 10)];

describe('selectCandidates: elitist', () => {
  it('always keeps the exact top N by score, deterministically', () => {
    const result = selectCandidates(pool, 2, 'elitist', createRng('elitist-1'));
    expect(result.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('is unaffected by rng (same result every time)', () => {
    const r1 = selectCandidates(pool, 3, 'elitist', createRng('x'));
    const r2 = selectCandidates(pool, 3, 'elitist', createRng('y'));
    expect(r1.map((c) => c.id)).toEqual(r2.map((c) => c.id));
  });
});

describe('selectCandidates: tournament', () => {
  it('returns exactly `count` candidates, all real members of the pool', () => {
    const result = selectCandidates(pool, 4, 'tournament', createRng('tournament-1'));
    expect(result.length).toBe(4);
    for (const c of result) expect(pool.map((p) => p.id)).toContain(c.id);
  });

  it('is reproducible for the same seed', () => {
    const r1 = selectCandidates(pool, 4, 'tournament', createRng('tournament-repro'));
    const r2 = selectCandidates(pool, 4, 'tournament', createRng('tournament-repro'));
    expect(r1.map((c) => c.id)).toEqual(r2.map((c) => c.id));
  });

  it('favors higher-fitness candidates over many draws', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 50; i++) {
      const result = selectCandidates(pool, 1, 'tournament', createRng(`tournament-bias-${i}`));
      counts[result[0].id] = (counts[result[0].id] ?? 0) + 1;
    }
    expect(counts.a ?? 0).toBeGreaterThan(counts.e ?? 0);
  });
});

describe('selectCandidates: rouletteWheel', () => {
  it('returns exactly `count` candidates, all real members of the pool', () => {
    const result = selectCandidates(pool, 3, 'rouletteWheel', createRng('roulette-1'));
    expect(result.length).toBe(3);
    for (const c of result) expect(pool.map((p) => p.id)).toContain(c.id);
  });

  it('never crashes on an all-zero-or-negative-score pool', () => {
    const negativePool = [fakeCandidate('x', -1), fakeCandidate('y', -1), fakeCandidate('z', 0)];
    const result = selectCandidates(negativePool, 2, 'rouletteWheel', createRng('roulette-negative'));
    expect(result.length).toBe(2);
  });

  it('favors higher-fitness candidates over many draws', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 60; i++) {
      const result = selectCandidates(pool, 1, 'rouletteWheel', createRng(`roulette-bias-${i}`));
      counts[result[0].id] = (counts[result[0].id] ?? 0) + 1;
    }
    expect(counts.a ?? 0).toBeGreaterThan(counts.e ?? 0);
  });
});

describe('selectCandidates: edge cases', () => {
  it('returns an empty array for an empty pool', () => {
    expect(selectCandidates([], 3, 'elitist', createRng('empty'))).toEqual([]);
  });

  it('returns an empty array when count is 0', () => {
    expect(selectCandidates(pool, 0, 'elitist', createRng('zero'))).toEqual([]);
  });
});
