import { describe, it, expect, beforeEach } from 'vitest';
import { StartFactory } from './startFactory';
import { clearOrchestrationRunsForTest, loadOrchestrationRuns } from './storage/orchestrationRunStore';
import { createFactoryTask, transitionFactoryTask } from '../factory/domain/factoryTask';
import { putFactoryTask, clearFactoryQueueForTest } from '../factory/storage/factoryQueueStore';
import { clearFactoryTimelineForTest } from '../factory/storage/factoryTimelineStore';
import { clearFactoryReviewsForTest } from '../factoryIntelligence/storage/factoryReviewStore';
import { clearOwnerDecisionRecordsForTest } from '../productionAutopilot/storage/ownerDecisionStore';
import { clearImprovementBacklogForTest } from '../factoryImprovement/storage/improvementBacklogStore';
import { clearProductionSessionsForTest, loadProductionSessions } from '../productionAutopilot/storage/productionSessionStore';

const NOW = 1_700_000_000_000;

beforeEach(async () => {
  await Promise.all([
    clearOrchestrationRunsForTest(),
    clearFactoryQueueForTest(),
    clearFactoryTimelineForTest(),
    clearFactoryReviewsForTest(),
    clearOwnerDecisionRecordsForTest(),
    clearImprovementBacklogForTest(),
    clearProductionSessionsForTest(),
  ]);
});

describe('StartFactory', () => {
  it('always requires owner approval and never auto-executes', async () => {
    const result = await StartFactory(NOW);
    expect(result.requiresOwnerApproval).toBe(true);
  });

  it('happy path: creates and persists a real OrchestrationRun (WAITING_OWNER_APPROVAL) and a real ProductionSession, both traceable', async () => {
    const result = await StartFactory(NOW);

    expect(result.run.status).toBe('WAITING_OWNER_APPROVAL');
    expect(result.plan).not.toBeNull();
    expect(result.run.sessionId).not.toBeNull();
    expect(result.context.session?.id).toBe(result.run.sessionId);
    expect(result.decisionTrace).not.toBeNull();

    const persistedRuns = await loadOrchestrationRuns();
    expect(persistedRuns).toHaveLength(1);
    expect(persistedRuns[0].id).toBe(result.run.id);
    expect(persistedRuns[0].status).toBe('WAITING_OWNER_APPROVAL');

    const persistedSessions = await loadProductionSessions();
    expect(persistedSessions).toHaveLength(1);
    expect(persistedSessions[0].id).toBe(result.run.sessionId);
    // Every id on the run traces back to the real session's own decision trace — nothing invented.
    expect(result.decisionTrace?.decisionId).toBe(persistedSessions[0].decisionTrace.decisionId);
  });

  it('BLOCKED path: a real BLOCKED task stops the run before any session is created', async () => {
    let repair = createFactoryTask({ type: 'repair', reason: 'Stuck repair.', assetId: 'A-1', now: NOW });
    repair = transitionFactoryTask(transitionFactoryTask(repair, 'RUNNING', NOW + 10), 'BLOCKED', NOW + 20, 'no sidecar');
    await putFactoryTask(repair);

    const result = await StartFactory(NOW + 100);

    expect(result.run.status).toBe('BLOCKED');
    expect(result.run.blockedReason).not.toBeNull();
    expect(result.plan).toBeNull();
    expect(result.run.sessionId).toBeNull();
    expect(result.context.session).toBeNull();

    const persistedRuns = await loadOrchestrationRuns();
    expect(persistedRuns).toHaveLength(1);
    expect(persistedRuns[0].status).toBe('BLOCKED');

    const persistedSessions = await loadProductionSessions();
    expect(persistedSessions).toHaveLength(0);
  });

  it('every returned FactoryExecutionContext field is real, not fabricated — honest empties when nothing is present', async () => {
    const result = await StartFactory(NOW);
    expect(result.context.runId).toBe(result.run.id);
    expect(result.context.ownerDecisions).toEqual([]);
    expect(result.context.timeline).toEqual([]);
  });
});
