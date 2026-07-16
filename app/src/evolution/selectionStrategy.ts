import type { Rng } from '../engine/types';
import type { EvaluatedCandidate, SelectionAlgorithm } from './types';

// Design Evolution Engine (Phase 8) — Section 5 "Selection Strategy".
// Three configurable algorithms, all operating purely on the real
// `fitness.score` the Design Critic already produced (Section 4) — none
// of them re-scores anything.

function byScoreDesc(a: EvaluatedCandidate, b: EvaluatedCandidate): number {
  return b.fitness.score - a.fitness.score;
}

/** Deterministic: always keeps the top `count` by fitness score. */
function selectElitist(pool: EvaluatedCandidate[], count: number): EvaluatedCandidate[] {
  return [...pool].sort(byScoreDesc).slice(0, count);
}

/** Runs `count` independent tournaments; each tournament samples
 * `tournamentSize` distinct candidates (without replacement *within* one
 * tournament) and keeps the best of that sample. A given candidate can
 * still be selected more than once across different tournaments — the
 * standard "selection with replacement" semantics for building a mating
 * pool. */
function selectTournament(pool: EvaluatedCandidate[], count: number, rng: Rng): EvaluatedCandidate[] {
  const tournamentSize = Math.min(3, pool.length);
  const winners: EvaluatedCandidate[] = [];
  for (let i = 0; i < count; i++) {
    const indices = new Set<number>();
    while (indices.size < tournamentSize) {
      indices.add(Math.floor(rng() * pool.length));
    }
    const contenders = [...indices].map((idx) => pool[idx]);
    winners.push(contenders.sort(byScoreDesc)[0]);
  }
  return winners;
}

/** Probability of selection proportional to fitness score, shifted so
 * the lowest-scoring candidate in the pool still has a small non-zero
 * chance rather than being mathematically impossible to pick — a score
 * of 0 (or a rare negative score from heavy penalties) must not zero out
 * its selection weight entirely. */
function selectRouletteWheel(pool: EvaluatedCandidate[], count: number, rng: Rng): EvaluatedCandidate[] {
  const minScore = Math.min(...pool.map((c) => c.fitness.score));
  const shift = minScore < 0 ? -minScore + 1 : 1;
  const weights = pool.map((c) => c.fitness.score + shift);
  const total = weights.reduce((sum, w) => sum + w, 0);

  const winners: EvaluatedCandidate[] = [];
  for (let i = 0; i < count; i++) {
    let target = rng() * total;
    let picked = pool[pool.length - 1];
    for (let idx = 0; idx < pool.length; idx++) {
      target -= weights[idx];
      if (target <= 0) {
        picked = pool[idx];
        break;
      }
    }
    winners.push(picked);
  }
  return winners;
}

export function selectCandidates(pool: EvaluatedCandidate[], count: number, algorithm: SelectionAlgorithm, rng: Rng): EvaluatedCandidate[] {
  if (pool.length === 0 || count <= 0) return [];
  switch (algorithm) {
    case 'elitist':
      return selectElitist(pool, count);
    case 'tournament':
      return selectTournament(pool, count, rng);
    case 'rouletteWheel':
      return selectRouletteWheel(pool, count, rng);
  }
}
