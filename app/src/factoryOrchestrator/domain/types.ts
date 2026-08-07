import type { DecisionTrace } from '../../aiCeo/domain/types';
import type { DecisionTimelineEntry } from '../../decisionOS/domain/types';
import type { FactoryTask, FactoryTimelineEntry } from '../../factory/domain/types';
import type { FactoryHealth } from '../../factory/factoryMetrics';
import type { BusinessOutcomeScore } from '../../factoryIntelligence/domain/types';
import type { FactoryEvolutionEntry } from '../../factoryImprovement/domain/types';
import type { OwnerDecisionRecord, ProductionSession, ProductionSessionPlan } from '../../productionAutopilot/domain/types';

// Mission 5 — Factory Orchestrator. The Factory already has 5 real
// authorities: Decision OS (decides), Factory Controller (executes),
// Factory Intelligence (measures), Continuous Improvement (improves),
// Production Autopilot (coordinates the production workflow). This
// module adds a 6th layer that coordinates those five as ONE factory —
// it is not a 6th authority. Every type below either wraps/references an
// already-real record from one of those five modules, or is a thin
// bookkeeping record the orchestrator itself owns (its own state
// machine, its own execution context cache, its own archive/backup
// rows) — nothing here recomputes a decision, a metric, or a
// recommendation a moment earlier subsystem already computed.

/** Part 2 — the Factory State Machine's 11 named states. This is a
 * *coarser*, orchestration-level lifecycle layered ON TOP of
 * `ProductionSession`'s own 5-state machine (PLANNED/APPROVED/RUNNING/
 * COMPLETED/CANCELLED, unchanged since Mission 4) — it is never a
 * replacement for it. See `orchestrationRun.ts`'s header comment for the
 * exact state-to-state mapping. */
export const ORCHESTRATION_STATUS_VALUES = [
  'IDLE',
  'PREPARING',
  'PREFLIGHT',
  'PLANNING',
  'WAITING_OWNER_APPROVAL',
  'RUNNING',
  'PAUSED',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED',
  'FAILED',
] as const;
export type OrchestrationStatus = (typeof ORCHESTRATION_STATUS_VALUES)[number];

export interface OrchestrationRunHistoryEntry {
  status: OrchestrationStatus;
  at: number;
  note?: string;
}

/** Part 2/5 — one row per `StartFactory()` invocation. Wraps (never
 * duplicates) a `ProductionSession` — `sessionId` is the only link,
 * `plan`/`outcome`/decision fields all still live on the
 * `ProductionSession` record itself. */
export interface OrchestrationRun {
  id: string;
  status: OrchestrationStatus;
  sessionId: string | null;
  batchId: string | null;
  history: OrchestrationRunHistoryEntry[];
  waitingOwnerApprovalSince: number | null;
  ownerRespondedAt: number | null;
  blockedReason: string | null;
  failureReason: string | null;
  archiveId: string | null;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
}
export const ORCHESTRATION_RUN_SCHEMA_VERSION = 1;

/** Part 3 — the shared execution context every orchestrator function
 * reads from and writes back to, so no two functions in one run ever
 * recompute the same real data twice (Part 11's "avoid duplicate
 * calculations"). Built once per run by `executionContext.ts`'s
 * `buildFactoryExecutionContext`, refreshed only when the underlying
 * stores actually change. */
export interface FactoryExecutionContext {
  runId: string;
  session: ProductionSession | null;
  decisionIds: string[];
  policyIds: string[];
  evidenceIds: string[];
  timeline: FactoryTimelineEntry[];
  queue: FactoryTask[];
  factoryKpis: FactoryHealth | null;
  businessOutcome: BusinessOutcomeScore | null;
  ownerDecisions: OwnerDecisionRecord[];
  improvementReferences: string[];
  computedAt: number;
}

/** Part 7 — every engine call the orchestrator makes returns one of
 * these two shapes; a thrown exception from a subsystem is always
 * caught and turned into an `OrchestrationError`, never left to
 * propagate silently. */
export const ORCHESTRATION_ERROR_KIND_VALUES = ['BLOCKED', 'RETRYABLE', 'ROLLBACK', 'FAILED'] as const;
export type OrchestrationErrorKind = (typeof ORCHESTRATION_ERROR_KIND_VALUES)[number];

export interface OrchestrationError {
  kind: OrchestrationErrorKind;
  message: string;
  source: string;
  occurredAt: number;
}

export type OrchestrationResult<T> = { ok: true; value: T } | { ok: false; error: OrchestrationError };

/** Part 6 — Owner Interaction Layer. Reuses
 * `productionAutopilot/ownerDecision.ts`'s real, timestamped
 * `OwnerDecisionRecord`s and `DAILY_OWNER_DECISION_TARGET` — this is a
 * summary view over that same data, not a second decision-tracking
 * system. `waitingTimeMs` is the real elapsed time between
 * `OrchestrationRun.waitingOwnerApprovalSince` and
 * `.ownerRespondedAt` — `null` until both timestamps exist. */
export interface OwnerInteractionSummary {
  decisionsToday: number;
  withinDailyTarget: boolean;
  waitingTimeMs: number | null;
  overrideCount: number;
  approvalCount: number;
  computedAt: number;
}

/** Part 8 — Recovery. Rebuilding state after a crash/reload never
 * invents anything: every field here is re-read from the same durable
 * stores (`factoryOrchestrationRuns`, `factoryProductionSessions`,
 * `factoryQueue`, `factoryTimeline`) that were already being written to
 * during the interrupted run. */
export interface FactoryRecoveryResult {
  recovered: boolean;
  run: OrchestrationRun | null;
  context: FactoryExecutionContext | null;
  notes: string[];
}

/** Part 9 — Production Session Archive. One row per completed/cancelled
 * run, composed entirely from already-real records — no field is
 * recomputed a second time for the archive. */
export interface ProductionSessionArchive {
  id: string;
  runId: string;
  sessionId: string | null;
  batchId: string | null;
  executionTimeline: FactoryTimelineEntry[];
  decisionTimeline: DecisionTimelineEntry[];
  factoryKpis: FactoryHealth | null;
  businessOutcome: BusinessOutcomeScore | null;
  improvementHistory: FactoryEvolutionEntry[];
  ownerDecisions: OwnerDecisionRecord[];
  finalStatus: OrchestrationStatus;
  archivedAt: number;
  schemaVersion: number;
}
export const PRODUCTION_SESSION_ARCHIVE_SCHEMA_VERSION = 1;

/** Part 10 — Commercial Readiness Gate. Refuses commercial completion
 * unless all three real authorities agree — this composes
 * `createFactoryReview` (Factory Intelligence), `explainBlockedTasks`
 * (Factory Controller), and the run's own real `DecisionTrace`
 * (Decision OS), never a fourth scoring model. */
export interface CommercialReadinessGateResult {
  allAgree: boolean;
  decisionOSAgrees: boolean;
  factoryControllerAgrees: boolean;
  factoryIntelligenceAgrees: boolean;
  reasons: string[];
  computedAt: number;
}

/** Part 1 — `StartFactory()`'s full traceable result: one row per stage
 * of the unified workflow, so every step remains individually
 * inspectable even though the whole chain runs as one call. */
export interface StartFactoryResult {
  run: OrchestrationRun;
  context: FactoryExecutionContext;
  plan: ProductionSessionPlan | null;
  decisionTrace: DecisionTrace | null;
  requiresOwnerApproval: true;
  computedAt: number;
}
