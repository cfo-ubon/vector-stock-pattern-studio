import { FACTORY_IMPROVEMENT_BACKLOG_STORE } from '../../storage/db';
import { createGenericStore } from '../../aiCeo/storage/genericStore';
import type { ImprovementBacklogTask } from '../domain/types';

// Mission 3, Part 2/12 — Improvement Backlog storage. One row per
// backlog task, keyed by `id`.

function isValidImprovementBacklogTask(value: unknown): value is ImprovementBacklogTask {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.category === 'string' && typeof v.status === 'string' && typeof v.createdAt === 'number';
}

const store = createGenericStore<ImprovementBacklogTask>(FACTORY_IMPROVEMENT_BACKLOG_STORE, 'Improvement Backlog', isValidImprovementBacklogTask);

export async function loadImprovementBacklog(): Promise<ImprovementBacklogTask[]> {
  const all = await store.loadAll();
  return [...all].sort((a, b) => b.createdAt - a.createdAt);
}
export async function putImprovementBacklogTask(task: ImprovementBacklogTask): Promise<void> {
  await store.put(task);
}
export async function clearImprovementBacklogForTest(): Promise<void> {
  await store.clear();
}
