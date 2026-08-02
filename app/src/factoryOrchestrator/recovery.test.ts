import { describe, it, expect, beforeEach } from 'vitest';
import { recoverQueue, recoverTimeline, recoverFactoryState, resumeInterruptedFactoryRun } from './recovery';
import { createOrchestrationRun, transitionOrchestrationRun } from './orchestrationRun';
import { putOrchestrationRun, clearOrchestrationRunsForTest } from './storage/orchestrationRunStore';
import { createFactoryTask } from '../factory/domain/factoryTask';
import { putFactoryTask, clearFactoryQueueForTest } from '../factory/storage/factoryQueueStore';
import { clearFactoryTimelineForTest } from '../factory/storage/factoryTimelineStore';
import { clearFactorySchedulerStateForTest } from '../factory/storage/factorySchedulerStateStore';
import { clearOwnerDecisionRecordsForTest } from '../productionAutopilot/storage/ownerDecisionStore';
import { clearImprovementBacklogForTest } from '../factoryImprovement/storage/improvementBacklogStore';
import { putProductionSession, clearProductionSessionsForTest } from '../productionAutopilot/storage/productionSessionStore';
import { runPreflightValidation } from '../productionAutopilot/preflightValidation';
import { planProductionSession } from '../productionAutopilot/productionSessionPlanner';
import { createProductionSession } from '../productionAutopilot/productionSession';

const NOW = 1_700_000_000_000;

beforeEach(async () => {
  await Promise.all([clearOrchestrationRunsForTest(), clearFactoryQueueForTest(), clearFactoryTimelineForTest(), clearFactorySchedulerStateForTest(), clearOwnerDecisionRecordsForTest(), clearImprovementBacklogForTest(), clearProductionSessionsForTest()]);
});

describe('recoverQueue / recoverTimeline / recoverFactoryState', () => {
  it('re-read the real, already-durable stores — never invent state', async () => {
    const task = createFactoryTask({ type: 'seo', reason: 'x', assetId: 'A-1', now: NOW });
    await putFactoryTask(task);
    const tasks = await recoverQueue();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe(task.id);

    const timeline = await recoverTimeline();
    expect(timeline).toEqual([]);

    const state = await recoverFactoryState();
    expect(state.id).toBe('scheduler');
  });
});

describe('resumeInterruptedFactoryRun', () => {
  it('reports recovered: false honestly when there is nothing to resume', async () => {
    const result = await resumeInterruptedFactoryRun(NOW);
    expect(result.recovered).toBe(false);
    expect(result.run).toBeNull();
    expect(result.context).toBeNull();
  });

  it('rebuilds a real FactoryExecutionContext for the most recent non-terminal run', async () => {
    const preflight = runPreflightValidation([], [], [], [], NOW);
    const plan = planProductionSession([], [], [], preflight, NOW);
    const session = createProductionSession(plan, NOW);
    await putProductionSession(session);

    let run = createOrchestrationRun(NOW);
    run = transitionOrchestrationRun(run, 'PREPARING', NOW + 1);
    run = { ...run, sessionId: session.id };
    await putOrchestrationRun(run);

    const result = await resumeInterruptedFactoryRun(NOW + 100);
    expect(result.recovered).toBe(true);
    expect(result.run?.id).toBe(run.id);
    expect(result.context?.session?.id).toBe(session.id);
  });

  it('never resumes a COMPLETED or CANCELLED run', async () => {
    let run = createOrchestrationRun(NOW);
    run = transitionOrchestrationRun(run, 'PREPARING', NOW + 1);
    run = transitionOrchestrationRun(run, 'CANCELLED', NOW + 2);
    await putOrchestrationRun(run);

    const result = await resumeInterruptedFactoryRun(NOW + 100);
    expect(result.recovered).toBe(false);
  });

  it('warns honestly (does not crash) when the run references a session that no longer exists', async () => {
    let run = createOrchestrationRun(NOW);
    run = transitionOrchestrationRun(run, 'PREPARING', NOW + 1);
    run = { ...run, sessionId: 'FSESS-MISSING' };
    await putOrchestrationRun(run);

    const result = await resumeInterruptedFactoryRun(NOW + 100);
    expect(result.recovered).toBe(true);
    expect(result.context?.session).toBeNull();
    expect(result.notes.some((n) => n.includes('FSESS-MISSING'))).toBe(true);
  });
});
