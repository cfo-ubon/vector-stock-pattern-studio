import type { CompositionMetrics } from '../engine/scoring';
import { PENALTY_RULES_V2, isPenaltyApplicable, type PenaltyEvaluationContext } from '../engine/penaltyRulesV2';

// Design Critic & Art Direction Engine (Phase 7) — Section 3 "Penalty
// System". `engine/scoring.ts`'s `SOFT_PENALTY_RULES` (19 real, measurable
// penalty rules, built across Milestone 1 and Project Phoenix V2) already
// IS the brief's "measurable penalties" system — every rule is a concrete,
// checkable condition on real geometry with a fixed point deduction. This
// module does not invent a second penalty system; it packages the same
// rules `applySoftPenalties` already evaluates into structured `DesignProblem`
// objects for the Section 7 Design Report, adding only a severity tier
// (derived from each rule's own real point value, not a separate judgment).
//
// Build 012 (Evaluation Intelligence Engine V3): reads `PENALTY_RULES_V2`
// (`engine/penaltyRulesV2.ts`) instead of the raw `SOFT_PENALTY_RULES` list —
// same ids/labels/points/check functions, but gated through
// `isPenaltyApplicable` so a lattice-layout tile (grid/gridMinimal/halfDrop/
// brick/stripe) no longer reports `gridAppearance`/`equalSpacingDetected`/etc.
// as "problems" for doing exactly what those layouts are designed to do
// (BUILD_012_AUDIT.md Finding 1) — this was a real, live bug: `critic/
// qualityGate.ts` blocks export/SEO/collection generation on any high-
// severity (>=20pt) problem, and `gridAppearance` (20pts) fired on 100% of
// lattice-layout tiles regardless of actual quality. `ctx` defaults to
// `{ layoutClass: 'organic' }` — the same "every rule applies" behavior
// this function had before Build 012 — so every existing caller that
// doesn't pass a real layout context (i.e. genuinely has no layout
// information available) sees identical output to before.

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

/** Every soft-penalty rule that actually triggers against `metrics` AND
 * applies under `ctx` (Build 012: layout-aware — see module doc comment),
 * packaged as a structured, severity-tiered `DesignProblem[]` — the exact
 * same `rule.check(metrics)` condition `applySoftPenalties`/
 * `applySoftPenaltiesV2` evaluate, never a re-implementation of it. Sorted
 * highest-points-first so the most severe problem is always first. */
export function detectProblems(metrics: CompositionMetrics, ctx: PenaltyEvaluationContext = { layoutClass: 'organic' }): DesignProblem[] {
  return PENALTY_RULES_V2.filter((rule) => rule.check(metrics) && isPenaltyApplicable(rule, ctx))
    .map((rule) => ({ id: rule.id, label: rule.label, points: rule.points, severity: severityForPoints(rule.points) }))
    .sort((a, b) => b.points - a.points);
}
