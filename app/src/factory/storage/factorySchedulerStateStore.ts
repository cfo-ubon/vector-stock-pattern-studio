import { FACTORY_SCHEDULER_STATE_STORE } from '../../storage/db';
import { createGenericStore } from '../../aiCeo/storage/genericStore';
import type { FactorySchedulerState } from '../domain/types';

// Build 031C, Part 1/12 — Scheduler State storage. Always exactly one
// row, id `'scheduler'`, so a pause (Part 8 replanning) survives a reload.

function isValidFactorySchedulerState(value: unknown): value is FactorySchedulerState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.id === 'scheduler' && typeof v.running === 'boolean';
}

const store = createGenericStore<FactorySchedulerState>(FACTORY_SCHEDULER_STATE_STORE, 'Factory Scheduler State', isValidFactorySchedulerState);

const DEFAULT_STATE: FactorySchedulerState = {
  id: 'scheduler',
  running: false,
  pausedReason: null,
  lastScheduledAt: null,
  lastReplanAt: null,
  activeTaskId: null,
  updatedAt: 0,
};

export async function loadFactorySchedulerState(): Promise<FactorySchedulerState> {
  const existing = await store.get('scheduler');
  return existing ?? DEFAULT_STATE;
}
export async function putFactorySchedulerState(state: FactorySchedulerState): Promise<void> {
  await store.put(state);
}
export async function clearFactorySchedulerStateForTest(): Promise<void> {
  await store.clear();
}
