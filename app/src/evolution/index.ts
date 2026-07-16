// Design Evolution Engine (Phase 8) — top-level barrel, the one import
// surface other modules/UI consume instead of reaching into each
// evolution/* file directly. Every export is a real re-export from an
// already-real submodule (see each file's own header comment).

export * as Types from './types';
export * as CandidateGenerator from './candidateGenerator';
export * as MutationEngine from './mutationEngine';
export * as CrossoverEngine from './crossoverEngine';
export * as FitnessEvaluation from './fitnessEvaluation';
export * as SelectionStrategy from './selectionStrategy';
export * as DiversityControl from './diversityControl';
export * as EvolutionTimeline from './evolutionTimeline';
export * as StoppingConditions from './stoppingConditions';
export * as EvolutionEngine from './evolutionEngine';
