import type { FactoryTask, FactoryTaskType } from './domain/types';
import { transitionFactoryTask, reblockFactoryTask } from './domain/factoryTask';

// Build 031C, Part 2 — Task Dependency Engine. Pure: given the current
// queue, resolves every WAITING/BLOCKED task's real status from its own
// `dependsOnTaskIds` — never reorders by priority (that's the Priority
// Engine's job, Part 3) and never executes anything (that's the
// Scheduler's, Part 5). A BLOCKED task's `blockedReason` always names the
// specific missing/failed dependency, per the spec's explicit requirement.

/** The type-level ordering rules named in the spec (Part 2's own
 * examples): when the Batch Controller wires up a package's task chain,
 * a task of type X automatically depends on the batch's task of type Y
 * for the same asset/collection. This is advisory metadata for
 * `batchController.ts` to consult when building `dependsOnTaskIds` — the
 * Dependency Engine itself only ever reads the resulting task-id edges,
 * never this table, so a manually-constructed dependency graph (e.g. a
 * user-inserted ad hoc task) is resolved identically. */
export const FACTORY_TASK_TYPE_DEPENDENCIES: Partial<Record<FactoryTaskType, FactoryTaskType[]>> = {
  qa: ['generate'],
  repair: ['qa'],
  seo: ['qa'],
  package: ['seo'],
  exportValidation: ['package'],
  collectionCompletion: ['generate'],
  portfolioUpdate: ['qa'],
};

export interface DependencyResolution {
  tasks: FactoryTask[];
  changedTaskIds: string[];
}

export function resolveTaskDependencies(tasks: FactoryTask[], now: number = Date.now()): DependencyResolution {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const changedTaskIds: string[] = [];

  const resolved = tasks.map((task) => {
    if (task.status !== 'WAITING' && task.status !== 'BLOCKED') return task;

    if (task.dependsOnTaskIds.length === 0) {
      if (task.status === 'WAITING') {
        changedTaskIds.push(task.id);
        return transitionFactoryTask(task, 'READY', now);
      }
      return task;
    }

    const missingIds = task.dependsOnTaskIds.filter((id) => !byId.has(id));
    const deps = task.dependsOnTaskIds.map((id) => byId.get(id)).filter((d): d is FactoryTask => d !== undefined);
    const cancelledDep = deps.find((d) => d.status === 'CANCELLED');

    let blockReason: string | null = null;
    if (missingIds.length > 0) {
      blockReason = `Missing dependency task(s): ${missingIds.join(', ')}.`;
    } else if (cancelledDep) {
      blockReason = `Dependency ${cancelledDep.id} (${cancelledDep.type}) was cancelled.`;
    }

    if (blockReason) {
      if (task.status === 'BLOCKED') {
        const next = reblockFactoryTask(task, blockReason, now);
        if (next !== task) changedTaskIds.push(task.id);
        return next;
      }
      changedTaskIds.push(task.id);
      return transitionFactoryTask(task, 'BLOCKED', now, blockReason);
    }

    const allCompleted = deps.length === task.dependsOnTaskIds.length && deps.every((d) => d.status === 'COMPLETED');
    if (allCompleted) {
      changedTaskIds.push(task.id);
      return transitionFactoryTask(task, 'READY', now);
    }

    if (task.status === 'BLOCKED') {
      changedTaskIds.push(task.id);
      return transitionFactoryTask(task, 'WAITING', now);
    }
    return task;
  });

  return { tasks: resolved, changedTaskIds };
}

export interface BlockedTaskExplanation {
  taskId: string;
  type: FactoryTaskType;
  reason: string;
}

/** Every currently BLOCKED task with its explanation — the direct answer
 * to "which dependency is missing," surfaced for the UI without
 * re-deriving it. */
export function explainBlockedTasks(tasks: FactoryTask[]): BlockedTaskExplanation[] {
  return tasks
    .filter((t) => t.status === 'BLOCKED')
    .map((t) => ({ taskId: t.id, type: t.type, reason: t.blockedReason ?? 'Blocked for an unspecified reason.' }));
}
