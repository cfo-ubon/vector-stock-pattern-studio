import { FACTORY_ORCHESTRATION_RUNS_STORE } from '../../storage/db';
import { createGenericStore } from '../../aiCeo/storage/genericStore';
import { isValidOrchestrationRun } from '../orchestrationRun';
import type { OrchestrationRun } from '../domain/types';

// Mission 5, Part 2/13 — Orchestration Run storage. One row per
// `StartFactory()` invocation, keyed by `id`.

const store = createGenericStore<OrchestrationRun>(FACTORY_ORCHESTRATION_RUNS_STORE, 'Orchestration Run', isValidOrchestrationRun);

export async function loadOrchestrationRuns(): Promise<OrchestrationRun[]> {
  const all = await store.loadAll();
  return [...all].sort((a, b) => b.createdAt - a.createdAt);
}
export async function getOrchestrationRun(id: string): Promise<OrchestrationRun | undefined> {
  return store.get(id);
}
export async function putOrchestrationRun(run: OrchestrationRun): Promise<void> {
  await store.put(run);
}
/** Part 8 — Recovery reads the most recent non-terminal run, if any,
 * without a full-store scan beyond the already-small run list (an
 * `OrchestrationRun` is created once per `StartFactory()` call, not per
 * task, so this stays a bounded read). */
export async function loadResumableOrchestrationRuns(): Promise<OrchestrationRun[]> {
  const all = await loadOrchestrationRuns();
  return all.filter((r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED');
}
export async function clearOrchestrationRunsForTest(): Promise<void> {
  await store.clear();
}
