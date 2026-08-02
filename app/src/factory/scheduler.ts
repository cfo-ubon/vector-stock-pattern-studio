import type { FactoryTask } from './domain/types';
import { transitionFactoryTask } from './domain/factoryTask';
import { resolveTaskDependencies } from './dependencyEngine';
import { evaluateFactoryPriorityBoosts, applyPriorityBoosts, type FactoryPriorityInputs } from './priorityEngine';
import { loadFactoryTasks, putFactoryTasks } from './storage/factoryQueueStore';
import { putFactoryTimelineEntry } from './storage/factoryTimelineStore';
import { loadFactorySchedulerState, putFactorySchedulerState } from './storage/factorySchedulerStateStore';
import { generateFactoryTimelineEntryId } from './domain/factoryTask';
import {
  executeQaTask,
  executeRepairTask,
  executeSeoTask,
  executePackageTask,
  executeExportValidationTask,
  executeCollectionCompletionTask,
  executePortfolioUpdateTask,
} from './taskExecutors';

// Build 031C, Part 5/8 — Factory Scheduler + Automatic Replanning. Picks
// the next runnable task (READY, lowest `priority` number, oldest
// `createdAt` as tiebreaker) and runs it via `taskExecutors.ts`. Never
// auto-runs a `generate` task (Part 9 — user approval required before
// generation) and never runs more than one task at a time (Part 5 — "No
// parallel execution unless already supported," and none of the reused
// Autopilot/batch functions support it). `replan()` recomputes
// dependencies + priority boosts from scratch every time it's called —
// there is no separate persisted "plan" to drift from real task state.

function nextRunnableTask(tasks: FactoryTask[]): FactoryTask | null {
  const runnable = tasks.filter((t) => t.status === 'READY' && t.type !== 'generate');
  if (runnable.length === 0) return null;
  return [...runnable].sort((a, b) => (a.priority !== b.priority ? a.priority - b.priority : a.createdAt - b.createdAt))[0];
}

async function appendTimelineEvent(task: FactoryTask, event: 'STARTED' | 'FINISHED' | 'BLOCKED' | 'CANCELLED', note: string, durationMs: number | null, now: number): Promise<void> {
  await putFactoryTimelineEntry({
    id: generateFactoryTimelineEntryId(now),
    taskId: task.id,
    taskType: task.type,
    batchId: task.batchId,
    event,
    note,
    durationMs,
    decisionId: task.sourceDecisionId,
    policyIds: task.decisionTrace?.policyIds ?? [],
    evidenceIds: task.decisionTrace?.evidenceIds ?? [],
    confidenceScore: task.decisionTrace?.confidenceScore ?? null,
    confidenceBand: task.decisionTrace?.confidenceBand ?? null,
    at: now,
  });
}

async function runExecutorFor(task: FactoryTask): Promise<{ ok: boolean; detail: string }> {
  switch (task.type) {
    case 'qa':
      return executeQaTask(task.assetId ?? '');
    case 'repair':
      return executeRepairTask(task.assetId ?? '');
    case 'seo':
      return executeSeoTask(task.assetId ?? '', task.targetMarketplace ?? 'shutterstock');
    case 'package':
      return executePackageTask(task.assetId ?? '', task.targetMarketplace ?? 'shutterstock');
    case 'exportValidation':
      return executeExportValidationTask(task.assetId ?? '');
    case 'collectionCompletion':
      return executeCollectionCompletionTask(task.collectionId ?? '');
    case 'portfolioUpdate':
      return executePortfolioUpdateTask(task.assetId ?? '');
    case 'generate':
      return { ok: false, detail: 'Generate tasks require explicit user approval and are never auto-run by the Scheduler.' };
  }
}

export interface SchedulerRunResult {
  ranTaskId: string | null;
  ok: boolean;
  detail: string;
}

/** Runs at most one READY task, in dependency+priority order. Returns
 * `ranTaskId: null` when the queue has nothing runnable (all WAITING/
 * BLOCKED/terminal), which is a normal, expected state, not an error. */
export async function runNextFactoryTask(now: number = Date.now()): Promise<SchedulerRunResult> {
  const scheduler = await loadFactorySchedulerState();
  if (scheduler.pausedReason) {
    return { ranTaskId: null, ok: false, detail: `Scheduler is paused: ${scheduler.pausedReason}` };
  }
  const tasks = await loadFactoryTasks();
  const task = nextRunnableTask(tasks);
  if (!task) return { ranTaskId: null, ok: true, detail: 'No runnable tasks in the queue.' };

  const running = transitionFactoryTask(task, 'RUNNING', now);
  await putFactoryTasks([running]);
  await appendTimelineEvent(running, 'STARTED', running.reason, null, now);
  await putFactorySchedulerState({ ...scheduler, activeTaskId: running.id, lastScheduledAt: now, updatedAt: now });

  const result = await runExecutorFor(running);
  const finishedAt = Date.now();
  const finalStatus = result.ok ? 'COMPLETED' : 'BLOCKED';
  const finished = result.ok
    ? transitionFactoryTask(running, 'COMPLETED', finishedAt, result.detail)
    : transitionFactoryTask(running, 'BLOCKED', finishedAt, result.detail);
  await putFactoryTasks([finished]);
  await appendTimelineEvent(finished, result.ok ? 'FINISHED' : 'BLOCKED', result.detail, finishedAt - now, finishedAt);
  await putFactorySchedulerState({ ...scheduler, activeTaskId: null, updatedAt: finishedAt });

  return { ranTaskId: task.id, ok: result.ok, detail: `${finalStatus}: ${result.detail}` };
}

export interface ReplanInputs extends FactoryPriorityInputs {}

/** Part 8 — Automatic Replanning. Recomputes dependency-derived
 * status (WAITING/READY/BLOCKED) and priority boosts for the whole
 * queue from scratch, then persists only the tasks that actually
 * changed. Safe to call as often as needed (e.g. after every queue
 * mutation) — it never touches a RUNNING task's status. */
export async function replanFactoryQueue(inputs: ReplanInputs, now: number = Date.now()): Promise<{ changedCount: number }> {
  const tasks = await loadFactoryTasks();
  const { tasks: dependencyResolved, changedTaskIds: depChanged } = resolveTaskDependencies(tasks, now);
  const boosts = evaluateFactoryPriorityBoosts(inputs, now);
  const prioritized = applyPriorityBoosts(dependencyResolved, boosts, now);

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const changed = prioritized.filter((t) => {
    const original = byId.get(t.id);
    return !original || original.status !== t.status || original.priority !== t.priority || original.blockedReason !== t.blockedReason;
  });
  if (changed.length > 0) await putFactoryTasks(changed);

  const state = await loadFactorySchedulerState();
  await putFactorySchedulerState({ ...state, lastReplanAt: now, updatedAt: now });

  return { changedCount: new Set([...depChanged, ...changed.map((t) => t.id)]).size };
}

export async function pauseFactoryScheduler(reason: string, now: number = Date.now()): Promise<void> {
  const state = await loadFactorySchedulerState();
  await putFactorySchedulerState({ ...state, running: false, pausedReason: reason, updatedAt: now });
}

export async function resumeFactoryScheduler(now: number = Date.now()): Promise<void> {
  const state = await loadFactorySchedulerState();
  await putFactorySchedulerState({ ...state, running: true, pausedReason: null, updatedAt: now });
}

/** Part 8's "repair spike -> pause generation" example — a caller-facing
 * helper the UI/orchestrating code can invoke when the repair ratio KPI
 * crosses a threshold. Since `generate` tasks already always require
 * explicit manual approval (Part 9) and are never auto-run by
 * `runNextFactoryTask`, this pauses the whole Scheduler (no queued task
 * auto-runs while paused) — a real, attributable, reversible action, not
 * a no-op relabeled as "pausing generation." Never called automatically
 * by the Scheduler itself. */
export async function pauseGenerationOnRepairSpike(repairRatio: number, thresholdPercent: number, now: number = Date.now()): Promise<boolean> {
  if (repairRatio < thresholdPercent) return false;
  await pauseFactoryScheduler(`Repair ratio ${repairRatio.toFixed(1)}% exceeds the ${thresholdPercent}% threshold — Scheduler paused until repairs catch up.`, now);
  return true;
}

export interface DrainFactoryQueueResult {
  ranTaskIds: string[];
}

// Mission 7 (Release Candidate hardening) — completes the wiring Build
// 031C's own report explicitly deferred: "every call in this build is a
// function a future caller (UI button, scheduled job) must invoke
// explicitly." `runNextFactoryTask` runs one task; `resolveTaskDependencies`
// promotes newly-unblocked WAITING tasks to READY. Neither loops on its
// own, so without a caller like this one, an approved run's queue never
// advances past its first task. This composes only those two already-real,
// already-tested functions — no new execution logic, no priority-boost
// fabrication (that needs real `FactoryPriorityInputs` a caller must
// supply itself; skipping it here only means priority *ordering* stays
// default, never that a runnable task goes unrun). Still never touches a
// `generate` task (Part 9) — it stops the moment nothing else is
// runnable, exactly like calling `runNextFactoryTask` by hand would.
//
// Performance (measured, Mission 7 Part 4/7 — see
// RELEASE_CANDIDATE_REPORT.md): both `runNextFactoryTask` and this loop's
// own dependency-resolve step do a full `loadFactoryTasks()` read, so
// draining N tasks is O(N) full-queue reads — real cost that only shows
// up at hundreds of tasks or more; changing it would mean redesigning the
// Scheduler's one-task-per-call contract (Build 031C's explicit "no
// parallel execution" guarantee), which is out of this mission's "no
// architecture changes" scope. Disclosed as a known limitation, not
// silently accepted.
// Mission 7.5 (Production Certification) Part 3/6 — a task can end up
// BLOCKED for two different reasons that `FactoryTask.status` doesn't
// distinguish: a missing/cancelled *dependency* (which really can resolve
// itself once the dependency finishes) or a *content* failure the task
// hit while actually running (e.g. `executePackageTask`'s Commercial
// Readiness threshold gate). `resolveTaskDependencies` only ever looks at
// dependency edges, so once a content-failed task's dependencies are all
// COMPLETED, it keeps proposing the identical BLOCKED->READY promotion on
// every call — and since nothing about a content failure changes on
// retry, the Scheduler re-runs the exact same doomed task every
// iteration, burning the whole `maxIterations` budget without the queue
// ever reaching a terminal state (found via Mission 7.5's real
// end-to-end Generate Now certification run, Part 1 Case A). `resolveTaskDependencies`
// itself stays untouched (it's pure and reused elsewhere); this only
// stops *this* loop from persisting that one specific resurrection once a
// task has already been run and failed within the same drain call — the
// task stays honestly BLOCKED for a human to act on, exactly like a
// genuine dependency-blocked task the owner hasn't resolved yet.
export async function drainFactoryQueue(now: number = Date.now(), maxIterations = 10000): Promise<DrainFactoryQueueResult> {
  const ranTaskIds: string[] = [];
  const failedTaskIds = new Set<string>();
  for (let i = 0; i < maxIterations; i++) {
    const tasks = await loadFactoryTasks();
    const { tasks: resolved, changedTaskIds: rawChangedTaskIds } = resolveTaskDependencies(tasks, now);
    const changedTaskIds = rawChangedTaskIds.filter((id) => !failedTaskIds.has(id));
    if (changedTaskIds.length > 0) {
      const resolvedById = new Map(resolved.map((t) => [t.id, t]));
      const changed = changedTaskIds.map((id) => resolvedById.get(id)).filter((t): t is FactoryTask => t !== undefined);
      await putFactoryTasks(changed);
    }
    const result = await runNextFactoryTask(now);
    if (result.ranTaskId === null) {
      if (changedTaskIds.length === 0) break;
      continue;
    }
    ranTaskIds.push(result.ranTaskId);
    if (!result.ok) failedTaskIds.add(result.ranTaskId);
  }
  return { ranTaskIds };
}
