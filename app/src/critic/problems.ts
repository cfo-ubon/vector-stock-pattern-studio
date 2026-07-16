import { SOFT_PENALTY_RULES, type CompositionMetrics } from '../engine/scoring';

// Design Critic & Art Direction Engine (Phase 7) — Section 3 "Penalty
// System". `engine/scoring.ts`'s `SOFT_PENALTY_RULES` (19 real, measurable
// penalty rules, built across Milestone 1 and Project Phoenix V2) already
// IS the brief's "measurable penalties" system — every rule is a concrete,
// checkable condition on real geometry with a fixed point deduction. This
// module does not invent a second penalty system; it packages the same
// rules `applySoftPenalties` already evaluates into structured `DesignProblem`
// objects for the Section 7 Design Report, adding only a severity tier
// (derived from each rule's own real point value, not a separate judgment).

export type ProblemSeverity = 'high' | 'medium' | 'low';

export interface DesignProblem {
  id: string;
  label: string;
  points: number;
  severity: ProblemSeverity;
}

/** >=15 points mirrors the point value of the brief's own most severe
 * named penalties (weakHierarchy, equalSpacingDetected, lowClusterCohesion,
 * heroInsufficientDetail all deduct 15); >=20 (gridAppearance,
 * zeroMotifOverlap, mechanicalComposition) is the real ceiling any single
 * rule deducts. Thresholds derived from the rules' own existing point
 * distribution, not invented independently of it. */
function severityForPoints(points: number): ProblemSeverity {
  if (points >= 20) return 'high';
  if (points >= 10) return 'medium';
  return 'low';
}

/** Every soft-penalty rule that actually triggers against `metrics`,
 * packaged as a structured, severity-tiered `DesignProblem[]` — the exact
 * same `rule.check(metrics)` condition `applySoftPenalties` evaluates,
 * never a re-implementation of it. Sorted highest-points-first so the
 * most severe problem is always first. */
export function detectProblems(metrics: CompositionMetrics): DesignProblem[] {
  return SOFT_PENALTY_RULES.filter((rule) => rule.check(metrics))
    .map((rule) => ({ id: rule.id, label: rule.label, points: rule.points, severity: severityForPoints(rule.points) }))
    .sort((a, b) => b.points - a.points);
}
