import { FACTORY_POLICY_EXPERIMENTS_STORE } from '../../storage/db';
import { createGenericStore } from '../../aiCeo/storage/genericStore';
import type { PolicyExperiment } from '../domain/types';

// Mission 3, Part 7/12 — Policy Experiments storage. One row per policy
// comparison ever run, keyed by `id`. Never activated — see
// `policyExperiment.ts`'s own header comment.

function isValidPolicyExperiment(value: unknown): value is PolicyExperiment {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.policyName === 'string' && typeof v.createdAt === 'number';
}

const store = createGenericStore<PolicyExperiment>(FACTORY_POLICY_EXPERIMENTS_STORE, 'Policy Experiment', isValidPolicyExperiment);

export async function loadPolicyExperiments(): Promise<PolicyExperiment[]> {
  const all = await store.loadAll();
  return [...all].sort((a, b) => b.createdAt - a.createdAt);
}
export async function putPolicyExperiment(experiment: PolicyExperiment): Promise<void> {
  await store.put(experiment);
}
export async function clearPolicyExperimentsForTest(): Promise<void> {
  await store.clear();
}
