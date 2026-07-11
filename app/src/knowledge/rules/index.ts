import rejectRulesData from './rejectRules.json';

// Design Knowledge Engine (Phase 6.5) — Section 9 "Design Rules". Today
// this covers exactly one reusable rule set: the Candidate Engine's hard-
// reject thresholds (engine/candidateEngine.ts's applyHardRejectRules).
// Before this phase those thresholds were a bare TypeScript literal
// (`const HARD_NODE_BUDGET = 8000`) with no editable-data counterpart —
// unlike Motif/Pattern Grammar, which already moved to JSON in an earlier
// phase. `rejectRules.json` is now that data file, validated by
// `validators/index.ts`'s `validateRejectRulesData` (same registry/schema
// pattern every other knowledge domain in this app already uses), and
// `getHardNodeBudget()` below is what `candidateEngine.ts` calls instead
// of hardcoding the number — a minimal, additive wire-up, not a rewrite of
// the Candidate Engine itself. The structural checks (empty pattern/NaN
// geometry/raster image/external ref/duplicate ids) stay real regex/
// structural code in `candidateEngine.ts`, because they are logic, not
// tunable numbers; `structuralChecks` here is documentation of what that
// code does, not a second enforcement path.

export interface RejectRuleCheck {
  id: string;
  description: string;
}

export interface RejectRules {
  schemaVersion: number;
  hardNodeBudget: number;
  structuralChecks: RejectRuleCheck[];
}

export const REJECT_RULES: RejectRules = rejectRulesData as RejectRules;

export function getHardNodeBudget(): number {
  return REJECT_RULES.hardNodeBudget;
}

export function listStructuralChecks(): RejectRuleCheck[] {
  return REJECT_RULES.structuralChecks;
}
