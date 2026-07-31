import { autonomousDesignRunId } from '../../marketing/domain/id';
import type { AutopilotMode } from './autopilotMode';
import { isValidAutopilotMode } from './autopilotMode';
import type { DesignPlan } from './designPlan';
import type { AutopilotConstraints } from './constraints';

// Build 029 (Autonomous Design Autopilot), Module 10 — the one record
// spanning a whole "ออกแบบให้ฉันวันนี้" run, from the moment a Design Plan
// is frozen through generation/QA/Portfolio. Mirrors
// `design-director/domain/marketingDesignHandoff.ts`'s own "one record
// spans the whole workflow, audit history is append-only" convention from
// Build 028C, applied here to a run instead of a single handoff.

export const AUTONOMOUS_RUN_STATUS_VALUES = [
  'PLAN_DRAFT',
  'PLAN_READY',
  'GENERATING',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
  'FAILED',
] as const;

export type AutonomousRunStatus = (typeof AUTONOMOUS_RUN_STATUS_VALUES)[number];

export function isValidAutonomousRunStatus(value: unknown): value is AutonomousRunStatus {
  return typeof value === 'string' && (AUTONOMOUS_RUN_STATUS_VALUES as readonly string[]).includes(value);
}

export interface AutonomousRunHistoryEntry {
  status: AutonomousRunStatus;
  at: number;
  note?: string;
}

/** One generated item's real, observed lifecycle — created the moment its
 * `GeneratorHandoff` is built, updated as generation/QA/repair/import
 * actually happen. Never fabricated ahead of the real event. */
export interface AutonomousRunItemState {
  collectionItemId: string;
  generatorHandoffId: string | null;
  portfolioAssetId: string | null;
  qualitySnapshotId: string | null;
  decision: 'READY' | 'REVIEW' | 'REJECT' | null;
  repairAttempts: number;
  error: string | null;
  completedAt: number | null;
}

export interface AutonomousDesignRun {
  id: string;
  status: AutonomousRunStatus;
  mode: AutopilotMode;
  requestedCount: number;
  completedCount: number;
  readyCount: number;
  reviewCount: number;
  rejectCount: number;
  /** Real evidence ids the Decision Engine actually read — never a
   * fabricated "based on market trends" placeholder. */
  sourceEvidence: {
    marketSnapshotId: string | null;
    marketOpportunityId: string | null;
    dailyMissionId: string | null;
  };
  /** The frozen `DesignPlan` the user approved — immutable once
   * `PLAN_READY` is reached (Safety Rule #1: user approves before
   * generation; Safety Rule #3: never silently change a locked plan). */
  designPlan: DesignPlan | null;
  constraints: AutopilotConstraints;
  marketingDesignHandoffId: string | null;
  creativeBriefId: string | null;
  collectionPlanId: string | null;
  items: AutonomousRunItemState[];
  history: AutonomousRunHistoryEntry[];
  errors: string[];
  /** Set the moment a user-visible cancel request is honored (Safety Rule
   * #8: never continue generation after a confirmed cancel). */
  cancelledAt: number | null;
  /** The index of the next item to process — what `resume` continues from
   * after a reload or a pause, never re-running an already-completed item. */
  resumeFromIndex: number;
  /** Module 11 (Autopilot History) — an archived run is hidden from the
   * default history list but never deleted, mirroring `PortfolioAsset`'s
   * own `isArchived`/`archivedAt` convention. Optional for backward
   * compatibility with runs persisted before this field existed — always
   * read via `isAutonomousRunArchived()` below, never `run.archived`
   * directly. */
  archived?: boolean;
  archivedAt?: number | null;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
}

/** Safe accessor for `archived` — a run persisted before this field
 * existed reads as "not archived" rather than `undefined`. */
export function isAutonomousRunArchived(run: AutonomousDesignRun): boolean {
  return run.archived === true;
}

export const AUTONOMOUS_DESIGN_RUN_SCHEMA_VERSION = 1;

export class InvalidAutonomousDesignRunInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAutonomousDesignRunInputError';
  }
}

export interface CreateAutonomousDesignRunInput {
  mode: AutopilotMode;
  requestedCount: number;
  sourceEvidence?: Partial<AutonomousDesignRun['sourceEvidence']>;
  constraints?: AutopilotConstraints;
  now?: number;
}

function emptyConstraints(): AutopilotConstraints {
  return {
    excludeCategoryIds: [],
    preferredMarketplace: null,
    preferredPaletteFamily: null,
    avoidedPaletteFamily: null,
    preferredDensity: null,
    preferredStyle: null,
    maxQuantity: null,
    excludedHeroMotifs: [],
    requiredProductTargets: [],
    seasonalPreference: null,
  };
}

/** Creates a new run at `PLAN_DRAFT` — the Decision Engine has not yet run,
 * or has run but the user has not yet approved the plan. Real history
 * starts here (`PLAN_DRAFT` is the first entry), same "audit trail begins
 * at the true first event" convention `createMarketingDesignHandoff` uses. */
export function createAutonomousDesignRun(input: CreateAutonomousDesignRunInput): AutonomousDesignRun {
  if (!Number.isFinite(input.requestedCount) || input.requestedCount <= 0) {
    throw new InvalidAutonomousDesignRunInputError('requestedCount must be a positive number.');
  }
  if (!isValidAutopilotMode(input.mode)) {
    throw new InvalidAutonomousDesignRunInputError(`Invalid autopilot mode: ${String(input.mode)}`);
  }
  const now = input.now ?? Date.now();
  return {
    id: autonomousDesignRunId.generate(now),
    status: 'PLAN_DRAFT',
    mode: input.mode,
    requestedCount: input.requestedCount,
    completedCount: 0,
    readyCount: 0,
    reviewCount: 0,
    rejectCount: 0,
    sourceEvidence: {
      marketSnapshotId: input.sourceEvidence?.marketSnapshotId ?? null,
      marketOpportunityId: input.sourceEvidence?.marketOpportunityId ?? null,
      dailyMissionId: input.sourceEvidence?.dailyMissionId ?? null,
    },
    designPlan: null,
    constraints: input.constraints ?? emptyConstraints(),
    marketingDesignHandoffId: null,
    creativeBriefId: null,
    collectionPlanId: null,
    items: [],
    history: [{ status: 'PLAN_DRAFT', at: now }],
    errors: [],
    cancelledAt: null,
    resumeFromIndex: 0,
    archived: false,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    schemaVersion: AUTONOMOUS_DESIGN_RUN_SCHEMA_VERSION,
  };
}

const VALID_TRANSITIONS: Record<AutonomousRunStatus, AutonomousRunStatus[]> = {
  PLAN_DRAFT: ['PLAN_READY', 'CANCELLED'],
  PLAN_READY: ['GENERATING', 'CANCELLED'],
  GENERATING: ['PAUSED', 'COMPLETED', 'CANCELLED', 'FAILED'],
  PAUSED: ['GENERATING', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  FAILED: [],
};

export class InvalidAutonomousRunTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAutonomousRunTransitionError';
  }
}

/** Appends a real transition — rejects a jump the run's own state machine
 * doesn't allow (e.g. `COMPLETED` -> `GENERATING`), rather than silently
 * recording an impossible history entry. */
export function transitionAutonomousDesignRun(run: AutonomousDesignRun, status: AutonomousRunStatus, now: number = Date.now(), note?: string): AutonomousDesignRun {
  if (!isValidAutonomousRunStatus(status)) {
    throw new InvalidAutonomousRunTransitionError(`Invalid status: ${String(status)}`);
  }
  if (!VALID_TRANSITIONS[run.status].includes(status)) {
    throw new InvalidAutonomousRunTransitionError(`Cannot transition from ${run.status} to ${status}.`);
  }
  return {
    ...run,
    status,
    history: [...run.history, { status, at: now, note }],
    updatedAt: now,
  };
}

export function currentAutonomousRunStatus(run: AutonomousDesignRun): AutonomousRunStatus {
  return run.status;
}

/** Archives a run — never changes `status`/`history` (archiving is
 * orthogonal to the run's own lifecycle, same separation
 * `PortfolioAsset.isArchived` keeps from `workflowStatus`), so an archived
 * run still honestly reports what actually happened to it. */
export function archiveAutonomousDesignRun(run: AutonomousDesignRun, now: number = Date.now()): AutonomousDesignRun {
  return { ...run, archived: true, archivedAt: now, updatedAt: now };
}

export function unarchiveAutonomousDesignRun(run: AutonomousDesignRun, now: number = Date.now()): AutonomousDesignRun {
  return { ...run, archived: false, archivedAt: null, updatedAt: now };
}

export function isValidAutonomousDesignRun(value: unknown): value is AutonomousDesignRun {
  if (!value || typeof value !== 'object') return false;
  const r = value as Partial<AutonomousDesignRun>;
  return typeof r.id === 'string' && isValidAutonomousRunStatus(r.status) && isValidAutopilotMode(r.mode) && Array.isArray(r.items) && Array.isArray(r.history);
}
