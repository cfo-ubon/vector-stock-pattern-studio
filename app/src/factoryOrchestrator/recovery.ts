import { loadFactoryTasks } from '../factory/storage/factoryQueueStore';
import { loadFactoryTimeline } from '../factory/storage/factoryTimelineStore';
import { loadFactorySchedulerState } from '../factory/storage/factorySchedulerStateStore';
import type { FactorySchedulerState, FactoryTask, FactoryTimelineEntry } from '../factory/domain/types';
import { loadOwnerDecisionRecords } from '../productionAutopilot/storage/ownerDecisionStore';
import { getProductionSession } from '../productionAutopilot/storage/productionSessionStore';
import { loadImprovementBacklog } from '../factoryImprovement/storage/improvementBacklogStore';
import { loadResumableOrchestrationRuns } from './storage/orchestrationRunStore';
import { buildFactoryExecutionContext } from './executionContext';
import type { FactoryRecoveryResult } from './domain/types';

// Mission 5, Part 8 — Recovery. Every function here re-reads an
// already-durable store (`factoryQueue`, `factoryTimeline`,
// `factorySchedulerState`, `factoryProductionSessions`,
// `factoryOrchestrationRuns`) — recovery never invents state, it only
// reloads what was already being persisted while the run was in
// progress, then rebuilds the same `FactoryExecutionContext` shape any
// live run would have (Part 3), so downstream code cannot tell the
// difference between a freshly-built context and a recovered one.

/** Recover Queue. */
export async function recoverQueue(): Promise<FactoryTask[]> {
  return loadFactoryTasks();
}

/** Recover Timeline. */
export async function recoverTimeline(): Promise<FactoryTimelineEntry[]> {
  return loadFactoryTimeline();
}

/** Recover Factory State. */
export async function recoverFactoryState(): Promise<FactorySchedulerState> {
  return loadFactorySchedulerState();
}

/** Resume Interrupted Session — finds the most recently updated
 * non-terminal `OrchestrationRun` (if any) and rebuilds its
 * `FactoryExecutionContext` from real, already-persisted data. Returns
 * `recovered: false` (never a fabricated run) when nothing was
 * interrupted. */
export async function resumeInterruptedFactoryRun(now: number = Date.now()): Promise<FactoryRecoveryResult> {
  const resumable = await loadResumableOrchestrationRuns();
  if (resumable.length === 0) {
    return { recovered: false, run: null, context: null, notes: ['No interrupted Orchestration Run found.'] };
  }

  const run = resumable[0];
  const notes: string[] = [`Recovered Orchestration Run ${run.id} in status ${run.status}.`];

  const session = run.sessionId ? await getProductionSession(run.sessionId) : undefined;
  if (run.sessionId && !session) {
    notes.push(`Production Session ${run.sessionId} referenced by this run was not found — continuing with a null session.`);
  }

  const [tasks, timeline, ownerDecisions, improvementBacklog] = await Promise.all([recoverQueue(), recoverTimeline(), loadOwnerDecisionRecords(), loadImprovementBacklog()]);

  const context = buildFactoryExecutionContext(run.id, tasks, timeline, ownerDecisions, improvementBacklog, session ?? null, now);

  return { recovered: true, run, context, notes };
}
