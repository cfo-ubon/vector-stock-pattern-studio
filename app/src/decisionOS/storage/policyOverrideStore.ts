import { createGenericStore } from '../../aiCeo/storage/genericStore';
import { DECISION_POLICY_OVERRIDES_STORE } from '../../storage/db';
import { isValidPolicyOverride, type PolicyOverride } from '../domain/types';

// Build 031B, Part 9 — Policy Management, invisible backend only (no UI).
// One row per policy that has ever been overridden away from its code
// default — most policies never appear here at all.

const store = createGenericStore<PolicyOverride>(DECISION_POLICY_OVERRIDES_STORE, 'Decision Policy Overrides', isValidPolicyOverride);

export async function savePolicyOverride(override: PolicyOverride): Promise<void> {
  await store.put(override);
}

export async function loadPolicyOverrides(): Promise<PolicyOverride[]> {
  return store.loadAll();
}

export async function deletePolicyOverride(policyId: string): Promise<void> {
  await store.remove(policyId);
}

export async function clearPolicyOverridesForTest(): Promise<void> {
  await store.clear();
}
