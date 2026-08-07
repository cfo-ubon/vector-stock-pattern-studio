import type { DecisionTrace } from '../../aiCeo/domain/types';
import type { BusinessImpact, ConfidenceBand } from '../../decisionOS/domain/types';
import type { FactoryStage, BottleneckReport } from '../../factoryIntelligence/domain/types';
import type { OptimizationSimulationResult } from '../../factoryImprovement/domain/types';

// Mission 4 — Production Autopilot. The Factory can decide (031B), execute
// (031C), measure (032), improve (033); this module makes the Factory
// operate itself by preparing the owner's entire production session
// automatically. No new AI: every field here reuses an already-real
// engine's output (Decision OS's own `evaluateGenerationGate`, Factory
// Intelligence's Bottleneck Analyzer/Opportunity Finder, Continuous
// Factory Improvement's Optimization Simulator) — this module only
// composes and sequences them into one owner-facing workflow. The
// primary KPI is reducing Owner Time/Decisions, never inventing a
// second recommendation engine.

/** Part 4 — the 7 named actions the Factory can choose. `GENERATE` is
 * structurally last-priority everywhere in this module — never a
 * default. */
export const PRODUCTION_ACTION_VALUES = ['CONTINUE_PREVIOUS_BATCH', 'REPAIR', 'SEO', 'PACKAGE', 'EXPORT', 'FINISH_COLLECTION', 'GENERATE'] as const;
export type ProductionActionType = (typeof PRODUCTION_ACTION_VALUES)[number];

export interface ProductionRecommendation {
  action: ProductionActionType;
  reason: string;
  evidence: string[];
  sourceTaskIds: string[];
  decisionTrace: DecisionTrace | null;
}

/** Part 3 — one real, counted Preflight check. `status` is derived
 * purely from the count — never an opinion invented beyond the number
 * itself. */
export const PREFLIGHT_CHECK_STATUS_VALUES = ['OK', 'ATTENTION', 'BLOCKED'] as const;
export type PreflightCheckStatus = (typeof PREFLIGHT_CHECK_STATUS_VALUES)[number];

export interface PreflightCheck {
  name: string;
  status: PreflightCheckStatus;
  count: number;
  detail: string;
}

export interface PreflightValidationResult {
  checks: PreflightCheck[];
  shouldGenerate: boolean;
  generateBlockedReason: string | null;
  decisionTrace: DecisionTrace;
  computedAt: number;
}

/** Part 1 — Today's Production Session plan. Every numeric field is
 * `null` until real evidence exists to compute it — never a guessed
 * default. */
export interface ProductionSessionPlan {
  productionGoal: string;
  targetPackages: number;
  estimatedDurationMs: number | null;
  expectedReadyPackages: number | null;
  expectedReview: number | null;
  expectedRepair: number | null;
  expectedFactoryEfficiency: number | null;
  businessOutcomeScore: number | null;
  decisionTrace: DecisionTrace;
  policyIds: string[];
  evidenceIds: string[];
  confidence: ConfidenceBand;
  businessImpact: BusinessImpact;
}

/** Part 6 — Production Queue Review, shown before execution. */
export interface ProductionQueueReview {
  currentQueueCount: number;
  readyCount: number;
  blockedTasks: { stage: FactoryStage; count: number }[];
  estimatedCompletionMs: number | null;
  topBottleneck: BottleneckReport;
  expectedImprovement: OptimizationSimulationResult | null;
  computedAt: number;
}

/** Part 2 — the ONE Start Factory workflow's staged result. Every stage
 * is real, already-computed data; `requiresOwnerApproval` is always
 * `true` — this module never self-approves or auto-executes (Part 11). */
export interface FactoryWorkflowResult {
  decisionReview: PreflightValidationResult;
  queueValidation: ProductionQueueReview;
  dependencyIssues: string[];
  improvementNotices: string[];
  productionPlan: ProductionSessionPlan;
  recommendation: ProductionRecommendation;
  requiresOwnerApproval: true;
  computedAt: number;
}

/** Part 5 — Owner Decision Reduction. */
export const OWNER_DECISION_TYPE_VALUES = ['APPROVE_SESSION', 'APPROVE_OVERRIDE', 'APPROVE_EXPORT'] as const;
export type OwnerDecisionType = (typeof OWNER_DECISION_TYPE_VALUES)[number];

export interface OwnerDecisionRecord {
  id: string;
  sessionId: string | null;
  type: OwnerDecisionType;
  decidedAt: number;
  durationMs: number;
  note: string | null;
}
export const OWNER_DECISION_SCHEMA_VERSION = 1;

/** Disclosed target from the spec's own "≤3 decisions/day" success
 * criterion — a policy target, not a measured baseline. */
export const DAILY_OWNER_DECISION_TARGET = 3;

/** Part 7 — Production Completion Review. Composes Build 032's
 * `FactoryReview` + `BusinessOutcomeScore` + Build 033's newly-created
 * Improvement Backlog tasks + this module's own next recommendation —
 * no field here is computed a second, duplicate way. */
export interface ProductionCompletionReview {
  batchId: string;
  packagesProduced: number;
  commercialReady: number;
  review: number;
  repair: number;
  rejected: number;
  businessOutcomeScore: number | null;
  factoryEfficiency: number | null;
  ownerTimeSavedMinutes: number;
  improvementTasksCreated: number;
  nextRecommendation: ProductionRecommendation;
  createdAt: number;
}

/** Part 8 — Continue Yesterday, applied to Factory Controller batches
 * (distinct from `aiCeo/continueYesterday.ts`'s own asset-generation-run
 * concept — same "pick, don't invent" philosophy, different domain). */
export interface ContinueYesterdayCheck {
  hasUnfinishedWork: boolean;
  batchId: string | null;
  reason: string | null;
  incompleteTaskCount: number;
}

/** Part 10 — Daily Factory Brief, shown when the application opens.
 * Composes Build 032's own Daily Factory Brief + this module's
 * recommendation + real Owner Decision count — never a second
 * evidence-gathering pass. */
export interface ProductionDailyBrief {
  todaysMission: string;
  factoryStatus: string;
  commercialPackagesReady: number;
  estimatedOwnerTimeMinutes: number;
  ownerDecisionsToday: number;
  withinDailyDecisionTarget: boolean;
  topRecommendation: ProductionRecommendation;
  businessOutcomeScore: number | null;
  generatedAt: number;
}

/** Part 9 — Production Session History. One persisted row per session,
 * spanning Plan (Part 1) through Execution through Outcome (Part 7). */
export const PRODUCTION_SESSION_STATUS_VALUES = ['PLANNED', 'APPROVED', 'RUNNING', 'COMPLETED', 'CANCELLED'] as const;
export type ProductionSessionStatus = (typeof PRODUCTION_SESSION_STATUS_VALUES)[number];

export interface ProductionSessionHistoryEntry {
  status: ProductionSessionStatus;
  at: number;
  note?: string;
}

export interface ProductionSession {
  id: string;
  status: ProductionSessionStatus;
  plan: ProductionSessionPlan;
  batchId: string | null;
  outcome: ProductionCompletionReview | null;
  decisionCount: number;
  decisionTrace: DecisionTrace;
  history: ProductionSessionHistoryEntry[];
  startedAt: number | null;
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
}
export const PRODUCTION_SESSION_SCHEMA_VERSION = 1;

/** Part 13 — single-row Autopilot State, mirrors
 * `FactorySchedulerState`'s own single-row pattern. */
export interface ProductionAutopilotState {
  id: 'productionAutopilot';
  lastSessionId: string | null;
  lastSessionStatus: ProductionSessionStatus | null;
  updatedAt: number;
}
