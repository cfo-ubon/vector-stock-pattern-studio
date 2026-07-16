import type { DesignReport } from './designReport';
import type { DesignProblem } from './problems';

// Design Critic & Art Direction Engine (Phase 7) — the quality gate the
// brief's Success Criteria names: "The Design Critic must become the
// quality gate before any artwork proceeds to SEO, export, or marketplace
// preparation." Confirmed during Phase 7 scoping that no such gate
// existed anywhere before this phase — `App.tsx`'s download/collection-
// generation handlers ran unconditionally. This module is the check
// itself (pure, no UI); `components/workbench/LivePreviewPanel.tsx` calls
// it before its download/generate actions and confirms with the user
// when it fails, rather than silently blocking — a real gate the
// designer can still override, not a hard wall with no escape hatch.

export interface QualityGateResult {
  passed: boolean;
  blockingProblems: DesignProblem[];
  meetsCommercialBar: boolean;
  message: string;
}

/** Below this, the tile is blocked regardless of the spec's own
 * (designer-editable) `qualityTargets.minOverallScore` — a hard commercial
 * floor so a designer can't accidentally set their own bar to 0 and lose
 * the gate entirely. 50 is the same "weak metric" threshold
 * `engine/scoring.ts`'s `computeOverallScore` already uses to call out a
 * metric as needing attention, not an independently-invented number. */
const GATE_MIN_OVERALL = 50;

/** Checks a real, already-built Design Report against the commercial
 * quality gate. Blocks on either of two real, independent signals: the
 * spec's own quality targets not being met, or at least one high-
 * severity problem (a real `>=20`-point `SOFT_PENALTY_RULES` trigger)
 * being present — either is enough to fail the gate on its own. */
export function checkQualityGate(report: DesignReport): QualityGateResult {
  const blockingProblems = report.problems.filter((p) => p.severity === 'high');
  const overallOk = report.critique.overall >= GATE_MIN_OVERALL;
  const passed = report.meetsCommercialBar && blockingProblems.length === 0 && overallOk;

  const reasons: string[] = [];
  if (!report.meetsCommercialBar) reasons.push("does not meet the spec's own quality targets");
  if (blockingProblems.length > 0) reasons.push(`${blockingProblems.length} high-severity problem(s): ${blockingProblems.map((p) => p.label).join('; ')}`);
  if (!overallOk) reasons.push(`overall score ${report.critique.overall} is below the ${GATE_MIN_OVERALL} commercial floor`);

  return {
    passed,
    blockingProblems,
    meetsCommercialBar: report.meetsCommercialBar,
    message: passed ? 'Meets the commercial quality gate.' : `Quality gate not met — ${reasons.join('; ')}.`,
  };
}
