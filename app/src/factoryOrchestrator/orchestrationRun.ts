import type { OrchestrationRun, OrchestrationStatus } from './domain/types';
import { ORCHESTRATION_RUN_SCHEMA_VERSION } from './domain/types';

// Mission 5, Part 2 — Factory State Machine. Mirrors
// `productionAutopilot/productionSession.ts`'s own `VALID_TRANSITIONS`/
// `transitionX`/named-error-class shape exactly — the same convention
// this codebase already uses for every long-lived workflow record
// (`factory/domain/factoryTask.ts`, `autopilot/domain/autonomousDesignRun.ts`,
// `catalog/queue/productionQueue.ts`, `catalog/submission/submissionStatus.ts`).
//
// State-to-state mapping against `StartFactory()`'s unified workflow
// (Part 1) and `ProductionSession`'s own 5-state machine (unchanged):
//   IDLE                    no run yet
//   PREPARING               building FactoryExecutionContext (Part 3)
//   PREFLIGHT                running the real Decision OS preflight check
//   PLANNING                running Production Autopilot's `startFactoryWorkflow`
//                            (Decision Review -> Queue -> Dependency ->
//                            Improvement -> Production Plan)
//   WAITING_OWNER_APPROVAL  ProductionSession created, status PLANNED
//   RUNNING                 owner approved; ProductionSession APPROVED->RUNNING
//   PAUSED                  Factory Scheduler paused mid-run
//   BLOCKED                 Preflight/Dependency check blocked
//   COMPLETED               ProductionSession COMPLETED
//   CANCELLED               owner or system cancelled
//   FAILED                  an engine call raised an unrecoverable error

const VALID_TRANSITIONS: Record<OrchestrationStatus, OrchestrationStatus[]> = {
  IDLE: ['PREPARING'],
  PREPARING: ['PREFLIGHT', 'FAILED', 'CANCELLED'],
  PREFLIGHT: ['PLANNING', 'BLOCKED', 'FAILED', 'CANCELLED'],
  PLANNING: ['WAITING_OWNER_APPROVAL', 'BLOCKED', 'FAILED', 'CANCELLED'],
  WAITING_OWNER_APPROVAL: ['RUNNING', 'CANCELLED'],
  RUNNING: ['PAUSED', 'COMPLETED', 'BLOCKED', 'FAILED', 'CANCELLED'],
  PAUSED: ['RUNNING', 'CANCELLED'],
  BLOCKED: ['PREPARING', 'CANCELLED', 'FAILED'],
  COMPLETED: [],
  CANCELLED: [],
  FAILED: ['PREPARING', 'CANCELLED'],
};

export function canTransitionOrchestrationRun(from: OrchestrationStatus, to: OrchestrationStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export class InvalidOrchestrationTransitionError extends Error {
  constructor(from: OrchestrationStatus, to: OrchestrationStatus) {
    super(`Cannot transition Orchestration Run from ${from} to ${to}.`);
    this.name = 'InvalidOrchestrationTransitionError';
  }
}

function pad(n: number, len: number): string {
  return String(n).padStart(len, '0');
}
function dateStamp(now: number): string {
  const d = new Date(now);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1, 2)}${pad(d.getUTCDate(), 2)}`;
}
function randomSuffix(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
export function generateOrchestrationRunId(now: number = Date.now()): string {
  return `FORCH-${dateStamp(now)}-${randomSuffix()}`;
}

export function createOrchestrationRun(now: number = Date.now()): OrchestrationRun {
  return {
    id: generateOrchestrationRunId(now),
    status: 'IDLE',
    sessionId: null,
    batchId: null,
    history: [{ status: 'IDLE', at: now }],
    waitingOwnerApprovalSince: null,
    ownerRespondedAt: null,
    blockedReason: null,
    failureReason: null,
    archiveId: null,
    createdAt: now,
    updatedAt: now,
    schemaVersion: ORCHESTRATION_RUN_SCHEMA_VERSION,
  };
}

export function transitionOrchestrationRun(run: OrchestrationRun, to: OrchestrationStatus, now: number = Date.now(), note?: string): OrchestrationRun {
  if (!canTransitionOrchestrationRun(run.status, to)) {
    throw new InvalidOrchestrationTransitionError(run.status, to);
  }
  return {
    ...run,
    status: to,
    waitingOwnerApprovalSince: to === 'WAITING_OWNER_APPROVAL' && run.waitingOwnerApprovalSince === null ? now : run.waitingOwnerApprovalSince,
    ownerRespondedAt: to === 'RUNNING' && run.waitingOwnerApprovalSince !== null && run.ownerRespondedAt === null ? now : run.ownerRespondedAt,
    blockedReason: to === 'BLOCKED' ? (note ?? run.blockedReason ?? 'Blocked.') : to === 'PREPARING' ? null : run.blockedReason,
    failureReason: to === 'FAILED' ? (note ?? run.failureReason ?? 'Failed.') : to === 'PREPARING' ? null : run.failureReason,
    history: [...run.history, { status: to, at: now, note }],
    updatedAt: now,
  };
}

export function attachOrchestrationRunSession(run: OrchestrationRun, sessionId: string, now: number = Date.now()): OrchestrationRun {
  return { ...run, sessionId, updatedAt: now };
}

export function attachOrchestrationRunBatch(run: OrchestrationRun, batchId: string, now: number = Date.now()): OrchestrationRun {
  return { ...run, batchId, updatedAt: now };
}

export function attachOrchestrationRunArchive(run: OrchestrationRun, archiveId: string, now: number = Date.now()): OrchestrationRun {
  return { ...run, archiveId, updatedAt: now };
}

export function isValidOrchestrationRun(value: unknown): value is OrchestrationRun {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.status === 'string' && typeof v.createdAt === 'number' && Array.isArray(v.history);
}
