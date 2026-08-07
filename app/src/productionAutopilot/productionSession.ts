import type { ProductionSession, ProductionSessionStatus, ProductionSessionPlan, ProductionCompletionReview } from './domain/types';
import { PRODUCTION_SESSION_SCHEMA_VERSION } from './domain/types';

// Mission 4, Part 9 — Production Session lifecycle. Mirrors
// `autopilot/domain/autonomousDesignRun.ts`'s own
// `createAutonomousDesignRun`/`transitionAutonomousDesignRun` pattern
// exactly (a `VALID_TRANSITIONS` map, a pure transition function that
// always appends a history entry, a named error class) — the same
// state-machine shape this codebase already uses for every other
// long-lived workflow record.

const VALID_TRANSITIONS: Record<ProductionSessionStatus, ProductionSessionStatus[]> = {
  PLANNED: ['APPROVED', 'CANCELLED'],
  APPROVED: ['RUNNING', 'CANCELLED'],
  RUNNING: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionProductionSession(from: ProductionSessionStatus, to: ProductionSessionStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export class InvalidProductionSessionTransitionError extends Error {
  constructor(from: ProductionSessionStatus, to: ProductionSessionStatus) {
    super(`Cannot transition Production Session from ${from} to ${to}.`);
    this.name = 'InvalidProductionSessionTransitionError';
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
export function generateProductionSessionId(now: number = Date.now()): string {
  return `FSESS-${dateStamp(now)}-${randomSuffix()}`;
}

export function createProductionSession(plan: ProductionSessionPlan, now: number = Date.now()): ProductionSession {
  return {
    id: generateProductionSessionId(now),
    status: 'PLANNED',
    plan,
    batchId: null,
    outcome: null,
    decisionCount: 0,
    decisionTrace: plan.decisionTrace,
    history: [{ status: 'PLANNED', at: now }],
    startedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    schemaVersion: PRODUCTION_SESSION_SCHEMA_VERSION,
  };
}

export function transitionProductionSession(session: ProductionSession, to: ProductionSessionStatus, now: number = Date.now(), note?: string): ProductionSession {
  if (!canTransitionProductionSession(session.status, to)) {
    throw new InvalidProductionSessionTransitionError(session.status, to);
  }
  return {
    ...session,
    status: to,
    startedAt: to === 'RUNNING' && session.startedAt === null ? now : session.startedAt,
    completedAt: to === 'COMPLETED' ? now : session.completedAt,
    history: [...session.history, { status: to, at: now, note }],
    updatedAt: now,
  };
}

export function recordProductionSessionDecision(session: ProductionSession, now: number = Date.now()): ProductionSession {
  return { ...session, decisionCount: session.decisionCount + 1, updatedAt: now };
}

export function attachProductionSessionBatch(session: ProductionSession, batchId: string, now: number = Date.now()): ProductionSession {
  return { ...session, batchId, updatedAt: now };
}

export function completeProductionSessionOutcome(session: ProductionSession, outcome: ProductionCompletionReview, now: number = Date.now()): ProductionSession {
  return transitionProductionSession({ ...session, outcome, updatedAt: now }, 'COMPLETED', now);
}

export function isValidProductionSession(value: unknown): value is ProductionSession {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.status === 'string' && typeof v.createdAt === 'number' && Array.isArray(v.history);
}
