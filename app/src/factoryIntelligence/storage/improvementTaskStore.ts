import { FACTORY_IMPROVEMENT_QUEUE_STORE } from '../../storage/db';
import { createGenericStore } from '../../aiCeo/storage/genericStore';
import type { ImprovementTask } from '../domain/types';
import { IMPROVEMENT_TASK_STATUS_VALUES } from '../domain/types';

// Mission 2, Part 9/10 — Continuous Improvement Queue storage.
// Recommendation-only records the user can view/dismiss/complete —
// nothing in Decision OS, the Scheduler, or any policy ever reads this
// store.

function isValidImprovementTask(value: unknown): value is ImprovementTask {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.category === 'string' && IMPROVEMENT_TASK_STATUS_VALUES.includes(v.status as (typeof IMPROVEMENT_TASK_STATUS_VALUES)[number]) && typeof v.createdAt === 'number';
}

const store = createGenericStore<ImprovementTask>(FACTORY_IMPROVEMENT_QUEUE_STORE, 'Factory Improvement Queue', isValidImprovementTask);

export async function loadImprovementTasks(): Promise<ImprovementTask[]> {
  const all = await store.loadAll();
  return [...all].sort((a, b) => b.createdAt - a.createdAt);
}
export async function putImprovementTask(task: ImprovementTask): Promise<void> {
  await store.put(task);
}
export async function clearImprovementTasksForTest(): Promise<void> {
  await store.clear();
}
