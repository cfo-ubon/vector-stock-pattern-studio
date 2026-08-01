import type { DecisionTrace } from '../../aiCeo/domain/types';

// Build 031C — Factory Controller. Decision OS (Build 031B) decides WHAT
// should happen; the Factory Controller decides WHEN/HOW/IN WHICH ORDER,
// using the existing Autopilot/Commercial Pipeline/Decision OS modules —
// this file is the one shared vocabulary every factory module imports,
// mirroring this repo's own per-subsystem `domain/types.ts` convention.

export const FACTORY_TASK_TYPE_VALUES = ['generate', 'repair', 'qa', 'seo', 'package', 'exportValidation', 'collectionCompletion', 'portfolioUpdate'] as const;
export type FactoryTaskType = (typeof FACTORY_TASK_TYPE_VALUES)[number];

export const FACTORY_TASK_STATUS_VALUES = ['WAITING', 'READY', 'RUNNING', 'BLOCKED', 'COMPLETED', 'CANCELLED'] as const;
export type FactoryTaskStatus = (typeof FACTORY_TASK_STATUS_VALUES)[number];

export interface FactoryTaskHistoryEntry {
  status: FactoryTaskStatus;
  at: number;
  note?: string;
}

/** One unit of production work. `dependsOnTaskIds` is the real dependency
 * graph edge list (Part 2) — a task is never runnable until every id in
 * this list resolves to a COMPLETED task; `blockedReason` is always
 * non-null while `status === 'BLOCKED'` and always names the specific
 * missing/failed dependency, per the spec's "Blocked tasks must explain
 * which dependency is missing." `priority` is the live, possibly-boosted
 * value the Scheduler sorts on; `basePriority` is the value before any
 * dynamic boost, kept so replanning is reversible and auditable rather
 * than accumulating drift. */
export interface FactoryTask {
  id: string;
  type: FactoryTaskType;
  status: FactoryTaskStatus;
  priority: number;
  basePriority: number;
  reason: string;
  /** The Decision OS `Decision.id` that created or last reprioritized this
   * task — Part 9's "every automatic action must reference a Decision
   * ID." `null` only for a task the user created directly (e.g. a manual
   * Generate request), never for anything the Scheduler/Priority Engine
   * touched on its own. */
  sourceDecisionId: string | null;
  decisionTrace: DecisionTrace | null;
  dependsOnTaskIds: string[];
  blockedReason: string | null;
  estimatedWorkMinutes: number;
  batchId: string | null;
  assetId: string | null;
  collectionId: string | null;
  collectionPlanItemId: string | null;
  targetMarketplace: string | null;
  attempts: number;
  startedAt: number | null;
  completedAt: number | null;
  errors: string[];
  history: FactoryTaskHistoryEntry[];
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
}

/** Part 6 — Factory Timeline. One append-only entry per real lifecycle
 * event (created/started/finished/blocked/resumed/cancelled) across every
 * task, carrying the same Decision OS trace fields a `Decision` and
 * `DecisionTimelineEntry` already carry, so the Timeline is explainable
 * without a second lookup. */
export const FACTORY_TIMELINE_EVENT_VALUES = ['CREATED', 'STARTED', 'FINISHED', 'BLOCKED', 'RESUMED', 'CANCELLED', 'REPRIORITIZED'] as const;
export type FactoryTimelineEvent = (typeof FACTORY_TIMELINE_EVENT_VALUES)[number];

export interface FactoryTimelineEntry {
  id: string;
  taskId: string;
  taskType: FactoryTaskType;
  batchId: string | null;
  event: FactoryTimelineEvent;
  note: string;
  durationMs: number | null;
  decisionId: string | null;
  policyIds: string[];
  evidenceIds: string[];
  confidenceScore: number | null;
  confidenceBand: string | null;
  at: number;
}

/** Part 1 (Scheduler State backup entry) — a single row describing
 * whether the Scheduler is currently allowed to auto-run READY tasks, and
 * why, so a pause (e.g. "repair spike" from Part 8's replanning) survives
 * a reload. Always exactly one row, id `'scheduler'`. */
export interface FactorySchedulerState {
  id: 'scheduler';
  running: boolean;
  pausedReason: string | null;
  lastScheduledAt: number | null;
  lastReplanAt: number | null;
  activeTaskId: string | null;
  updatedAt: number;
}

export const FACTORY_TASK_SCHEMA_VERSION = 1;
export const FACTORY_TIMELINE_SCHEMA_VERSION = 1;
