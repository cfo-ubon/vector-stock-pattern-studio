import type { FactoryTask } from '../factory/domain/types';
import type { ContinueYesterdayCheck } from './domain/types';

// Mission 4, Part 8 — Continue Yesterday, applied to Factory Controller
// batches. Same "pick the real unfinished batch, never invent one"
// philosophy as `aiCeo/continueYesterday.ts`'s own
// `findContinueYesterdayAction` — a distinct function because it reads a
// different domain (real `FactoryTask.batchId` groupings, not
// `AiCeoRecommendation`s), not a duplicate of that logic.

export function checkContinueYesterday(tasks: FactoryTask[]): ContinueYesterdayCheck {
  const byBatch = new Map<string, FactoryTask[]>();
  for (const task of tasks) {
    if (!task.batchId) continue;
    const list = byBatch.get(task.batchId) ?? [];
    list.push(task);
    byBatch.set(task.batchId, list);
  }

  for (const [batchId, batchTasks] of byBatch) {
    const incomplete = batchTasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
    if (incomplete.length === 0) continue;
    return {
      hasUnfinishedWork: true,
      batchId,
      reason: `Batch ${batchId} has ${incomplete.length} of ${batchTasks.length} task(s) not yet finished.`,
      incompleteTaskCount: incomplete.length,
    };
  }

  return { hasUnfinishedWork: false, batchId: null, reason: null, incompleteTaskCount: 0 };
}
