import { FACTORY_EXPERIMENTS_STORE } from '../../storage/db';
import { createGenericStore } from '../../aiCeo/storage/genericStore';
import type { FactoryExperiment } from '../domain/types';

// Mission 3, Part 6/12 — Factory Experiments storage. One row per
// experiment (RUNNING or CONCLUDED), keyed by `id`.

function isValidFactoryExperiment(value: unknown): value is FactoryExperiment {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.targetBatchId === 'string' && typeof v.status === 'string' && typeof v.startedAt === 'number';
}

const store = createGenericStore<FactoryExperiment>(FACTORY_EXPERIMENTS_STORE, 'Factory Experiment', isValidFactoryExperiment);

export async function loadFactoryExperiments(): Promise<FactoryExperiment[]> {
  const all = await store.loadAll();
  return [...all].sort((a, b) => b.startedAt - a.startedAt);
}
export async function putFactoryExperiment(experiment: FactoryExperiment): Promise<void> {
  await store.put(experiment);
}
export async function clearFactoryExperimentsForTest(): Promise<void> {
  await store.clear();
}
