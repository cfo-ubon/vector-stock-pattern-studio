import type { EvidenceBand } from '../../marketing/domain/evidence';
import type { CollectionPatternType } from '../../design-director/domain/collectionPlan';

// Build 029, Module 3 — the single, concise Design Plan shown before
// generation. Every field the Decision Engine resolved gets one
// `DesignPlanDecision` entry with a real source and a
// "ระบบเลือกค่านี้เพราะ..." rationale — mirrors the
// source/confidence/evidence-per-field convention `buildMarketingHandoffApplication.ts`
// (Build 028C) already established for the Marketing -> Creative Director
// handoff, applied here to the whole generation configuration instead of
// just the brief fields.

export type DesignDecisionSource =
  | 'marketOpportunity'
  | 'marketSnapshot'
  | 'dailyMission'
  | 'portfolioGap'
  | 'evergreenDefault'
  | 'seasonalCalendar'
  | 'customGoal'
  | 'userConstraint'
  | 'generatorDefault';

export interface DesignPlanDecision {
  key: string;
  label: string;
  value: string;
  /** The "ระบบเลือกค่านี้เพราะ..." explanation — always present, never
   * generic ("the system recommends this"), always naming the real
   * evidence or default rule that produced the value. */
  rationaleTh: string;
  rationaleEn: string;
  source: DesignDecisionSource;
  /** True when a user constraint (Module 4) overrode what the Decision
   * Engine would otherwise have picked. */
  userLocked: boolean;
}

export interface CollectionRolePlanEntry {
  role: CollectionPatternType;
  count: number;
}

export interface DesignPlanRisk {
  label: string;
  detail: string;
}

/** The frozen, user-approved plan (Safety Rule #1) — once a run reaches
 * `PLAN_READY` this object never changes; generation reads it verbatim. */
export interface DesignPlan {
  /** "What will be created" — one plain sentence, not a field dump. */
  summary: string;
  decisions: DesignPlanDecision[];
  marketEvidence: string[];
  portfolioReason: string;
  targetMarketplace: string;
  targetCustomer: string;
  targetProducts: string[];
  collectionStructure: CollectionRolePlanEntry[];
  visualDirection: string;
  paletteDirection: string;
  estimatedProductionEffort: string;
  risks: DesignPlanRisk[];
  confidence: EvidenceBand;
  /** Human-readable freshness label, same convention `MarketSnapshot.dataFreshness`
   * already uses — honest about how old the evidence is, never silently
   * presented as live. */
  dataFreshness: string;
  /** True when built from `PORTFOLIO_GAP`/`EVERGREEN_COMMERCIAL` fallback
   * evidence rather than a real Market Snapshot/Opportunity — the UI must
   * show this plainly (Module 12), never disguise it as a live
   * recommendation. */
  offline: boolean;
}

/** Finds one decision by key — the helper every UI/test uses instead of
 * `decisions.find(...)` inline, so a missing key fails loudly. */
export function getDesignPlanDecision(plan: DesignPlan, key: string): DesignPlanDecision | undefined {
  return plan.decisions.find((d) => d.key === key);
}
