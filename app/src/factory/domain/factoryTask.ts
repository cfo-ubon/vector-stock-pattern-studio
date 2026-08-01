import type { FactoryTask, FactoryTaskHistoryEntry, FactoryTaskStatus, FactoryTaskType } from './types';
import { FACTORY_TASK_SCHEMA_VERSION, FACTORY_TASK_STATUS_VALUES } from './types';
import type { DecisionTrace } from '../../aiCeo/domain/types';

// Build 031C, Part 1 — Factory Task state machine. Mirrors
// `autopilot/domain/autonomousDesignRun.ts`'s own shape exactly: a
// `VALID_TRANSITIONS` map, a pure `transitionFactoryTask` that never
// mutates and always appends a history entry, a named
// `InvalidFactoryTaskTransitionError`, and an `isValidFactoryTask` guard.

const VALID_TRANSITIONS: Record<FactoryTaskStatus, FactoryTaskStatus[]> = {
  WAITING: ['READY', 'BLOCKED', 'CANCELLED'],
  READY: ['RUNNING', 'WAITING', 'BLOCKED', 'CANCELLED'],
  RUNNING: ['COMPLETED', 'BLOCKED', 'CANCELLED', 'WAITING'],
  BLOCKED: ['WAITING', 'READY', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionFactoryTaskStatus(from: FactoryTaskStatus, to: FactoryTaskStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export class InvalidFactoryTaskTransitionError extends Error {
  constructor(from: FactoryTaskStatus, to: FactoryTaskStatus) {
    super(`Cannot transition Factory Task from ${from} to ${to}.`);
    this.name = 'InvalidFactoryTaskTransitionError';
  }
}

export function transitionFactoryTask(task: FactoryTask, to: FactoryTaskStatus, now: number = Date.now(), note?: string): FactoryTask {
  if (!canTransitionFactoryTaskStatus(task.status, to)) {
    throw new InvalidFactoryTaskTransitionError(task.status, to);
  }
  const history: FactoryTaskHistoryEntry[] = [...task.history, { status: to, at: now, note }];
  return {
    ...task,
    status: to,
    blockedReason: to === 'BLOCKED' ? (note ?? task.blockedReason ?? 'Blocked.') : null,
    startedAt: to === 'RUNNING' && task.startedAt === null ? now : task.startedAt,
    completedAt: to === 'COMPLETED' ? now : task.completedAt,
    history,
    updatedAt: now,
  };
}

/** Updates a BLOCKED task's explanation without a status change — used
 * when the missing dependency changes but the task is already blocked, so
 * the Timeline doesn't record a spurious BLOCKED->BLOCKED transition. */
export function reblockFactoryTask(task: FactoryTask, reason: string, now: number = Date.now()): FactoryTask {
  if (task.status !== 'BLOCKED') throw new InvalidFactoryTaskTransitionError(task.status, 'BLOCKED');
  if (task.blockedReason === reason) return task;
  return { ...task, blockedReason: reason, updatedAt: now, history: [...task.history, { status: 'BLOCKED', at: now, note: reason }] };
}

const DEFAULT_ESTIMATED_MINUTES: Record<FactoryTaskType, number> = {
  generate: 3,
  repair: 2,
  qa: 0.5,
  seo: 1,
  package: 1,
  exportValidation: 0.5,
  collectionCompletion: 0.5,
  portfolioUpdate: 0.5,
};

export interface CreateFactoryTaskInput {
  type: FactoryTaskType;
  reason: string;
  priority?: number;
  sourceDecisionId?: string | null;
  decisionTrace?: DecisionTrace | null;
  dependsOnTaskIds?: string[];
  estimatedWorkMinutes?: number;
  batchId?: string | null;
  assetId?: string | null;
  collectionId?: string | null;
  collectionPlanItemId?: string | null;
  targetMarketplace?: string | null;
  now?: number;
}

export function createFactoryTask(input: CreateFactoryTaskInput): FactoryTask {
  const now = input.now ?? Date.now();
  const dependsOnTaskIds = input.dependsOnTaskIds ?? [];
  const status: FactoryTaskStatus = dependsOnTaskIds.length > 0 ? 'WAITING' : 'READY';
  const priority = input.priority ?? 100;
  return {
    id: generateFactoryTaskId(now),
    type: input.type,
    status,
    priority,
    basePriority: priority,
    reason: input.reason,
    sourceDecisionId: input.sourceDecisionId ?? null,
    decisionTrace: input.decisionTrace ?? null,
    dependsOnTaskIds,
    blockedReason: null,
    estimatedWorkMinutes: input.estimatedWorkMinutes ?? DEFAULT_ESTIMATED_MINUTES[input.type],
    batchId: input.batchId ?? null,
    assetId: input.assetId ?? null,
    collectionId: input.collectionId ?? null,
    collectionPlanItemId: input.collectionPlanItemId ?? null,
    targetMarketplace: input.targetMarketplace ?? null,
    attempts: 0,
    startedAt: null,
    completedAt: null,
    errors: [],
    history: [{ status, at: now }],
    createdAt: now,
    updatedAt: now,
    schemaVersion: FACTORY_TASK_SCHEMA_VERSION,
  };
}

export function isValidFactoryTask(value: unknown): value is FactoryTask {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.type === 'string' &&
    FACTORY_TASK_STATUS_VALUES.includes(v.status as FactoryTaskStatus) &&
    Array.isArray(v.dependsOnTaskIds) &&
    Array.isArray(v.history) &&
    typeof v.priority === 'number'
  );
}

function pad(n: number, len: number): string {
  return String(n).padStart(len, '0');
}
function randomSuffix(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
function dateStamp(now: number): string {
  const d = new Date(now);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1, 2)}${pad(d.getUTCDate(), 2)}`;
}

export function generateFactoryTaskId(now: number = Date.now()): string {
  return `FTASK-${dateStamp(now)}-${randomSuffix()}`;
}
export function generateFactoryBatchId(now: number = Date.now()): string {
  return `FBATCH-${dateStamp(now)}-${randomSuffix()}`;
}
export function generateFactoryTimelineEntryId(now: number = Date.now()): string {
  return `FTL-${dateStamp(now)}-${randomSuffix()}`;
}
export function isValidFactoryTaskId(value: unknown): value is string {
  return typeof value === 'string' && /^FTASK-\d{8}-[0-9A-Z]{6}$/.test(value);
}
