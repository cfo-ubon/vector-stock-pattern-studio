import { FACTORY_QUEUE_STORE } from '../../storage/db';
import { createGenericStore } from '../../aiCeo/storage/genericStore';
import type { FactoryTask } from '../domain/types';
import { isValidFactoryTask } from '../domain/factoryTask';

// Build 031C, Part 1 — Factory Queue storage. Every `FactoryTask` (live
// and terminal) lives here, keyed by `id`, following the same
// `createGenericStore` pattern every store since Build 030 uses.

const store = createGenericStore<FactoryTask>(FACTORY_QUEUE_STORE, 'Factory Queue', isValidFactoryTask);

export async function loadFactoryTasks(): Promise<FactoryTask[]> {
  return store.loadAll();
}
export async function getFactoryTask(id: string): Promise<FactoryTask | undefined> {
  return store.get(id);
}
export async function putFactoryTask(task: FactoryTask): Promise<void> {
  await store.put(task);
}
export async function putFactoryTasks(tasks: FactoryTask[]): Promise<void> {
  await Promise.all(tasks.map((t) => store.put(t)));
}
export async function deleteFactoryTask(id: string): Promise<void> {
  await store.remove(id);
}
export async function clearFactoryQueueForTest(): Promise<void> {
  await store.clear();
}
