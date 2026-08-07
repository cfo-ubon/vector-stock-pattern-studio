import { describe, it, expect } from 'vitest';
import { prepareFactoryRun, validateFactoryRun, planFactoryRun, approveFactoryRun, executeFactoryRun, pauseFactoryRun, resumeFactoryRun, cancelFactoryRun, completeFactoryRun, archiveFactoryRun } from './productionLifecycle';
import { createOrchestrationRun } from './orchestrationRun';
import { runPreflightValidation } from '../productionAutopilot/preflightValidation';
import { planProductionSession } from '../productionAutopilot/productionSessionPlanner';
import { createProductionSession, transitionProductionSession } from '../productionAutopilot/productionSession';
import { createFactoryTask, transitionFactoryTask } from '../factory/domain/factoryTask';
import type { ProductionCompletionReview } from '../productionAutopilot/domain/types';

const NOW = 1_700_000_000_000;

function cleanPreflight() {
  return runPreflightValidation([], [], [], [], NOW);
}

function completedBatch() {
  let generate = createFactoryTask({ type: 'generate', reason: 'batch', now: NOW, batchId: 'B1' });
  generate = transitionFactoryTask(transitionFactoryTask(generate, 'RUNNING', NOW + 500), 'COMPLETED', NOW + 1000);
  let pkg = createFactoryTask({ type: 'package', reason: 'x', assetId: 'A-1', batchId: 'B1', now: NOW });
  pkg = transitionFactoryTask(transitionFactoryTask(pkg, 'RUNNING', NOW + 1500), 'COMPLETED', NOW + 2000);
  return [generate, pkg];
}

describe('prepareFactoryRun', () => {
  it('moves IDLE -> PREPARING', () => {
    const run = createOrchestrationRun(NOW);
    const result = prepareFactoryRun(run, NOW + 1);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.status).toBe('PREPARING');
  });

  it('returns a typed FAILED error (never throws) for an invalid transition', () => {
    const run = createOrchestrationRun(NOW);
    const preparing = prepareFactoryRun(run, NOW + 1);
    if (!preparing.ok) throw new Error('setup failed');
    // Already PREPARING — calling prepareFactoryRun again is an invalid IDLE-only transition.
    const result = prepareFactoryRun(preparing.value, NOW + 2);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('FAILED');
  });
});

describe('validateFactoryRun', () => {
  it('moves PREPARING -> PREFLIGHT -> PLANNING when no check is BLOCKED', () => {
    const run = createOrchestrationRun(NOW);
    const preparing = prepareFactoryRun(run, NOW + 1);
    if (!preparing.ok) throw new Error('setup failed');
    const result = validateFactoryRun(preparing.value, cleanPreflight(), NOW + 2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.status).toBe('PLANNING');
  });

  it('moves to BLOCKED with a real reason when a check is BLOCKED', () => {
    const run = createOrchestrationRun(NOW);
    const preparing = prepareFactoryRun(run, NOW + 1);
    if (!preparing.ok) throw new Error('setup failed');
    const blockedPreflight = { ...cleanPreflight(), checks: [{ name: 'Export Queue', status: 'BLOCKED' as const, count: 5, detail: 'Export queue has 5 stuck items.' }] };
    const result = validateFactoryRun(preparing.value, blockedPreflight, NOW + 2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('BLOCKED');
      expect(result.value.blockedReason).toBe('Export queue has 5 stuck items.');
    }
  });
});

describe('planFactoryRun / approveFactoryRun / executeFactoryRun', () => {
  it('walks PLANNING -> WAITING_OWNER_APPROVAL -> (session APPROVED) -> RUNNING together', () => {
    const preflight = cleanPreflight();
    const plan = planProductionSession([], [], [], preflight, NOW);
    const session = createProductionSession(plan, NOW);

    const run = createOrchestrationRun(NOW);
    const preparing = prepareFactoryRun(run, NOW + 1);
    if (!preparing.ok) throw new Error('setup failed');
    const validated = validateFactoryRun(preparing.value, preflight, NOW + 2);
    if (!validated.ok) throw new Error('setup failed');

    const planned = planFactoryRun(validated.value, session.id, NOW + 3);
    expect(planned.ok).toBe(true);
    if (!planned.ok) throw new Error('setup failed');
    expect(planned.value.status).toBe('WAITING_OWNER_APPROVAL');
    expect(planned.value.sessionId).toBe(session.id);

    const approved = approveFactoryRun(planned.value, session, NOW + 4);
    expect(approved.ok).toBe(true);
    if (!approved.ok) throw new Error('setup failed');
    expect(approved.value.session.status).toBe('APPROVED');
    expect(approved.value.run.status).toBe('WAITING_OWNER_APPROVAL');

    const executed = executeFactoryRun(approved.value.run, approved.value.session, NOW + 5);
    expect(executed.ok).toBe(true);
    if (executed.ok) {
      expect(executed.value.run.status).toBe('RUNNING');
      expect(executed.value.session.status).toBe('RUNNING');
    }
  });
});

describe('pauseFactoryRun / resumeFactoryRun', () => {
  it('round-trips RUNNING -> PAUSED -> RUNNING with a real reason recorded', () => {
    const run = { ...createOrchestrationRun(NOW), status: 'RUNNING' as const };
    const paused = pauseFactoryRun(run, 'Owner requested a pause.', NOW + 10);
    expect(paused.ok).toBe(true);
    if (!paused.ok) throw new Error('setup failed');
    expect(paused.value.status).toBe('PAUSED');
    expect(paused.value.blockedReason).toBeNull();
    const resumed = resumeFactoryRun(paused.value, NOW + 20);
    expect(resumed.ok).toBe(true);
    if (resumed.ok) expect(resumed.value.status).toBe('RUNNING');
  });
});

describe('cancelFactoryRun', () => {
  it('cancels both the run and (when present) the session', () => {
    const preflight = cleanPreflight();
    const plan = planProductionSession([], [], [], preflight, NOW);
    const session = createProductionSession(plan, NOW);
    const run = createOrchestrationRun(NOW);
    const result = cancelFactoryRun({ ...run, status: 'WAITING_OWNER_APPROVAL' }, session, 'Owner cancelled.', NOW + 1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.run.status).toBe('CANCELLED');
      expect(result.value.session?.status).toBe('CANCELLED');
    }
  });

  it('cancels the run with a null session honestly (no session ever created)', () => {
    const run = createOrchestrationRun(NOW);
    const result = cancelFactoryRun({ ...run, status: 'PREPARING' }, null, 'No plan needed.', NOW + 1);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.session).toBeNull();
  });
});

describe('completeFactoryRun', () => {
  it('refuses completion (BLOCKED, never a thrown error) when the Commercial Readiness Gate does not agree', () => {
    const preflight = cleanPreflight();
    const plan = planProductionSession([], [], [], preflight, NOW);
    const session = createProductionSession(plan, NOW);
    const run = { ...createOrchestrationRun(NOW), status: 'RUNNING' as const, batchId: null };
    const outcome: ProductionCompletionReview = { batchId: 'B1', packagesProduced: 1, commercialReady: 1, review: 0, repair: 0, rejected: 0, businessOutcomeScore: 80, factoryEfficiency: 90, ownerTimeSavedMinutes: 5, improvementTasksCreated: 0, nextRecommendation: { action: 'GENERATE', reason: 'x', evidence: [], sourceTaskIds: [], decisionTrace: null }, createdAt: NOW };
    const result = completeFactoryRun(run, session, outcome, [], [], NOW + 100);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('BLOCKED');
  });

  it('completes both run and session once the gate agrees', () => {
    const preflight = cleanPreflight();
    const plan = planProductionSession([], [], [], preflight, NOW);
    const session = createProductionSession(plan, NOW);
    expect(session.decisionTrace.blockedReasons).toEqual([]);
    const runningSession = transitionProductionSession(transitionProductionSession(session, 'APPROVED', NOW + 1), 'RUNNING', NOW + 2);
    const tasks = completedBatch();
    const run = { ...createOrchestrationRun(NOW), status: 'RUNNING' as const, batchId: 'B1' };
    const outcome: ProductionCompletionReview = { batchId: 'B1', packagesProduced: 1, commercialReady: 1, review: 0, repair: 0, rejected: 0, businessOutcomeScore: 80, factoryEfficiency: 90, ownerTimeSavedMinutes: 5, improvementTasksCreated: 0, nextRecommendation: { action: 'GENERATE', reason: 'x', evidence: [], sourceTaskIds: [], decisionTrace: null }, createdAt: NOW };
    const result = completeFactoryRun(run, runningSession, outcome, tasks, [], NOW + 3000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.run.status).toBe('COMPLETED');
      expect(result.value.session.status).toBe('COMPLETED');
      expect(result.value.session.outcome).toEqual(outcome);
    }
  });
});

describe('archiveFactoryRun', () => {
  it('attaches the real archive id without changing run.status', () => {
    const run = { ...createOrchestrationRun(NOW), status: 'COMPLETED' as const };
    const result = archiveFactoryRun(run, 'FARCH-1', NOW + 1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.archiveId).toBe('FARCH-1');
      expect(result.value.status).toBe('COMPLETED');
    }
  });
});
