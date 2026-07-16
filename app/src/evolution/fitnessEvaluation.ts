import { runDesignSpecQualityLoop } from '../trend/designSpecQuality';
import { buildDesignReport } from '../critic/designReport';
import { checkQualityGate } from '../critic/qualityGate';
import type { EvolutionCandidate, EvaluatedCandidate, EvolutionFitness } from './types';

// Design Evolution Engine (Phase 8) — Section 4 "Fitness Evaluation".
// Scores every candidate using the real Design Critic (Phase 7), never a
// second scoring implementation: one real tile is rendered via the
// existing `runDesignSpecQualityLoop` (the same SVG Intelligence Engine
// adapter every other phase uses, `mode: 'fast'`/`maxRounds: 1` — a
// population of candidates is itself the outer search loop, so spending
// extra inner quality-loop rounds per candidate here would just multiply
// cost without adding signal), then `buildDesignReport` +
// `checkQualityGate` (both unchanged from Phase 7) turn that render into
// the same 11-dimension Design Critique and commercial gate the Design
// Critic panel already shows. `fitness.score` is `critique.overall` —
// transparent because the full critique breakdown travels with it, never
// just the one number. `fitness.rejected` mirrors the Candidate Engine's
// own hard-reject sentinel (a real candidate whose node count blows the
// safety budget scores exactly -1) so a caller never has to guess why a
// candidate's score looks abnormally low — a mutation/crossover that
// pushes density too high can genuinely produce an unrenderable-for-stock
// candidate, and that should be visible, not silently averaged in.

export function evaluateFitness(candidate: EvolutionCandidate): EvaluatedCandidate {
  const loop = runDesignSpecQualityLoop(candidate.spec, candidate.id, 'fast', 1);
  const report = buildDesignReport(candidate.spec, loop.pool.winner.tileData, loop.pool.winner.metrics, loop.check.report, loop.check.meetsTargets);
  const gate = checkQualityGate(report);
  const fitness: EvolutionFitness = {
    score: report.critique.overall,
    rejected: loop.pool.winner.rejected,
    critique: report.critique,
    gate,
    meetsCommercialBar: report.meetsCommercialBar,
  };
  return { ...candidate, fitness, report };
}

export function evaluatePopulation(candidates: EvolutionCandidate[]): EvaluatedCandidate[] {
  return candidates.map(evaluateFitness);
}
