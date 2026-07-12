import { diffJson, type JsonDiffEntry } from '../workbench/jsonDiff';
import { averagePairwiseDistance } from './diversityControl';
import type { EvaluatedCandidate, EvolutionGenerationRecord, EvolutionTimeline } from './types';

// Design Evolution Engine (Phase 8) — Section 7 "Evolution Timeline".
// Records one transparent snapshot per generation and supports comparing
// any two of them — reusing `diffJson` (Workbench, unchanged) for the
// spec-level comparison rather than a second diff implementation.

export function recordGeneration(index: number, candidates: EvaluatedCandidate[]): EvolutionGenerationRecord {
  const best = [...candidates].sort((a, b) => b.fitness.score - a.fitness.score)[0];
  const averageScore = candidates.reduce((sum, c) => sum + c.fitness.score, 0) / candidates.length;
  return {
    index,
    candidates,
    bestCandidateId: best.id,
    bestScore: best.fitness.score,
    averageScore,
    diversityAverageDistance: averagePairwiseDistance(candidates.map((c) => c.spec)),
  };
}

export interface GenerationComparison {
  fromIndex: number;
  toIndex: number;
  bestScoreDelta: number;
  averageScoreDelta: number;
  bestSpecDiff: JsonDiffEntry[];
}

/** Compares two recorded generations' best candidates — both the score
 * movement and the exact real fields that differ between them. */
export function compareGenerations(from: EvolutionGenerationRecord, to: EvolutionGenerationRecord): GenerationComparison {
  const fromBest = from.candidates.find((c) => c.id === from.bestCandidateId)!;
  const toBest = to.candidates.find((c) => c.id === to.bestCandidateId)!;
  return {
    fromIndex: from.index,
    toIndex: to.index,
    bestScoreDelta: to.bestScore - from.bestScore,
    averageScoreDelta: to.averageScore - from.averageScore,
    bestSpecDiff: diffJson(fromBest.spec, toBest.spec),
  };
}

export interface TimelineSummary {
  generations: number;
  startScore: number;
  finalScore: number;
  scoreDelta: number;
  monotonicallyImproved: boolean;
}

/** A monotonically non-decreasing best score across generations is a
 * direct, checkable consequence of the evolution loop's elitism (the
 * previous generation's best always survives unchanged into the next
 * generation's population) — this summary is what lets a caller (and a
 * test) confirm that actually held for a real run, not assume it. */
export function summarizeTimeline(timeline: EvolutionTimeline): TimelineSummary {
  const first = timeline[0];
  const last = timeline[timeline.length - 1];
  const monotonicallyImproved = timeline.every((gen, i) => i === 0 || gen.bestScore >= timeline[i - 1].bestScore);
  return {
    generations: timeline.length,
    startScore: first.bestScore,
    finalScore: last.bestScore,
    scoreDelta: last.bestScore - first.bestScore,
    monotonicallyImproved,
  };
}
