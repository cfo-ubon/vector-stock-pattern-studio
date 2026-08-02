import type { OrchestrationRun, OrchestrationStatus } from '../factoryOrchestrator/domain/types';
import type { FactoryTask } from '../factory/domain/types';

// Mission 6, Part 3 — Production Progress. A pure reshape of the real
// Factory Orchestrator state (Mission 5's `OrchestrationRun.status` +
// the live `FactoryTask` queue) into the 7 named stages the spec asks
// for — never a fabricated animation or a fake percentage. `RUNNING` is
// split into a real `QA`/`PACKAGING` sub-stage only when the batch's own
// tasks are actually active in that stage; otherwise it stays the
// generic `RUNNING` stage — no guessing which stage "should" be active.

export const PRODUCTION_PROGRESS_STAGE_VALUES = ['PREPARING', 'PLANNING', 'WAITING_APPROVAL', 'RUNNING', 'QA', 'PACKAGING', 'COMPLETED'] as const;
export type ProductionProgressStage = (typeof PRODUCTION_PROGRESS_STAGE_VALUES)[number];

export type ProductionProgressStepState = 'DONE' | 'CURRENT' | 'PENDING';

export interface ProductionProgressStep {
  stage: ProductionProgressStage;
  state: ProductionProgressStepState;
}

export type ProductionHaltedStatus = 'PAUSED' | 'BLOCKED' | 'CANCELLED' | 'FAILED';

export interface ProductionProgress {
  steps: ProductionProgressStep[];
  /** Real terminal/paused states the 7-stage stepper can't honestly
   * represent as "in progress" — surfaced separately so the UI never
   * pretends a halted run is still smoothly advancing. */
  haltedStatus: ProductionHaltedStatus | null;
  haltedReason: string | null;
}

const STAGE_ORDER: ProductionProgressStage[] = [...PRODUCTION_PROGRESS_STAGE_VALUES];
const QA_TASK_TYPES = new Set(['qa', 'repair']);
const PACKAGING_TASK_TYPES = new Set(['seo', 'package', 'exportValidation', 'collectionCompletion', 'portfolioUpdate']);
const ACTIVE_TASK_STATUSES = new Set(['WAITING', 'READY', 'RUNNING', 'BLOCKED']);

function activeSubStageFromQueue(batchTasks: FactoryTask[]): 'QA' | 'PACKAGING' | null {
  const active = batchTasks.filter((t) => ACTIVE_TASK_STATUSES.has(t.status));
  if (active.length === 0) return null;
  if (active.some((t) => QA_TASK_TYPES.has(t.type))) return 'QA';
  if (active.some((t) => PACKAGING_TASK_TYPES.has(t.type))) return 'PACKAGING';
  return null;
}

/** The stage a given (non-halted) status maps to. */
function stageForStatus(status: OrchestrationStatus, batchTasks: FactoryTask[]): ProductionProgressStage {
  switch (status) {
    case 'IDLE':
    case 'PREPARING':
      return 'PREPARING';
    case 'PREFLIGHT':
    case 'PLANNING':
      return 'PLANNING';
    case 'WAITING_OWNER_APPROVAL':
      return 'WAITING_APPROVAL';
    case 'RUNNING':
      return activeSubStageFromQueue(batchTasks) ?? 'RUNNING';
    case 'COMPLETED':
      return 'COMPLETED';
    default:
      return 'PREPARING';
  }
}

const HALTED_STATUSES = new Set<OrchestrationStatus>(['PAUSED', 'BLOCKED', 'CANCELLED', 'FAILED']);

/** Real most-recent non-halted status from the run's own history — used
 * to freeze the stepper at the stage the run actually reached before it
 * paused/blocked/cancelled/failed, instead of resetting to Preparing. */
function mostRecentNonHaltedStatus(run: OrchestrationRun): OrchestrationStatus {
  for (let i = run.history.length - 1; i >= 0; i--) {
    const entry = run.history[i];
    if (!HALTED_STATUSES.has(entry.status)) return entry.status;
  }
  return 'IDLE';
}

export function deriveProductionProgress(run: OrchestrationRun, tasks: FactoryTask[]): ProductionProgress {
  const batchTasks = run.batchId ? tasks.filter((t) => t.batchId === run.batchId) : [];

  const halted = HALTED_STATUSES.has(run.status);
  const effectiveStatus = halted ? mostRecentNonHaltedStatus(run) : run.status;
  const currentStage = stageForStatus(effectiveStatus, batchTasks);

  const currentIndex = STAGE_ORDER.indexOf(currentStage);
  const steps: ProductionProgressStep[] = STAGE_ORDER.map((stage, i) => ({
    stage,
    state: i < currentIndex ? 'DONE' : i === currentIndex ? 'CURRENT' : 'PENDING',
  }));

  return {
    steps,
    haltedStatus: halted ? (run.status as ProductionHaltedStatus) : null,
    haltedReason: halted ? (run.blockedReason ?? run.failureReason ?? null) : null,
  };
}

export const PRODUCTION_PROGRESS_STAGE_LABELS: Record<ProductionProgressStage, string> = {
  PREPARING: 'Preparing',
  PLANNING: 'Planning',
  WAITING_APPROVAL: 'Waiting Approval',
  RUNNING: 'Running',
  QA: 'QA',
  PACKAGING: 'Packaging',
  COMPLETED: 'Completed',
};
