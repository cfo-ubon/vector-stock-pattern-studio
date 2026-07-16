import type { EvolutionConfig } from './types';

// Design Evolution Engine (Phase 8) — Section 9 "Stopping Conditions".
// Every check is independently configurable and independently optional
// (undefined disables it) except `maxGenerations`, which is always a
// hard cap so a run can never loop forever regardless of what else is
// configured.

export interface StoppingState {
  generationIndex: number;
  bestScore: number;
  startedAt: number;
  evaluationsUsed: number;
}

export interface StoppingDecision {
  stop: boolean;
  reason: string;
}

export function shouldStop(state: StoppingState, config: EvolutionConfig): StoppingDecision {
  if (state.generationIndex + 1 >= config.maxGenerations) {
    return { stop: true, reason: `reached the maximum of ${config.maxGenerations} generation(s)` };
  }
  if (config.qualityThreshold !== undefined && state.bestScore >= config.qualityThreshold) {
    return { stop: true, reason: `best candidate reached the quality threshold (${state.bestScore} >= ${config.qualityThreshold})` };
  }
  if (config.maxDurationMs !== undefined && Date.now() - state.startedAt >= config.maxDurationMs) {
    return { stop: true, reason: `reached the performance budget of ${config.maxDurationMs}ms` };
  }
  if (config.maxEvaluations !== undefined && state.evaluationsUsed >= config.maxEvaluations) {
    return { stop: true, reason: `reached the maximum of ${config.maxEvaluations} fitness evaluation(s)` };
  }
  return { stop: false, reason: '' };
}
