import type { DesignEvaluation } from './designEvaluation';

// Design Refinement Studio Pro, Mission 5 — Pattern Safety. The one real,
// already-computed signal for "will this tile visibly break at the seam
// when it repeats" is `cornerDeadZone` (`engine/scoring.ts`'s
// `cornerContinuity` metric — density in the 4 corner-adjacent grid cells
// vs. the tile's own average, since a repeated tile's 4 corners meet at
// one shared point), already detected by `detectProblems` and already
// part of every `DesignEvaluation` Mission 1/2 produce. This is
// deliberately NOT `CompositionMetrics.seamlessIntegrity` — that field is
// a structural constant (`engine/qualityScore.ts`: "true by construction
// ... not re-derived here", always 100) guaranteed by the generator's own
// wrap-clone step, not a per-edit risk signal a parameter change could
// ever move. Reusing the exact same `cornerDeadZone` detection the
// Inspector's Detected Problems and the AI Design Coach already surface,
// rather than inventing a second threshold.
export function hasSeamBreakRisk(evaluation: DesignEvaluation): boolean {
  return evaluation.problems.some((p) => p.id === 'cornerDeadZone');
}
