import type { PolicyDefinition, PolicyDomain, PolicyOverride, PolicyStatus } from './domain/types';
import { loadPolicyOverrides, savePolicyOverride, deletePolicyOverride } from './storage/policyOverrideStore';

// Build 031B, Part 1 & 9 — Policy Engine + Policy Management. One
// in-memory registry every `policies/*.ts` file registers into at module
// load time (mirrors `knowledge/rules`'s own registry-of-data-driven-rules
// pattern from earlier builds), plus a tiny persisted override layer so
// enabling/disabling a policy or changing its priority never requires
// editing source code. Deliberately no UI: Part 9 is explicit that Policy
// Management is "invisible backend only".

class DuplicatePolicyIdError extends Error {
  constructor(id: string) {
    super(`A policy with id "${id}" is already registered.`);
    this.name = 'DuplicatePolicyIdError';
  }
}

const REGISTRY = new Map<string, PolicyDefinition>();

/** Every `policies/*.ts` module calls this once per policy at import time.
 * Throws on a duplicate id rather than silently overwriting — two
 * policies accidentally sharing an id would otherwise make Decision
 * Timeline entries ambiguous about which policy actually fired. */
export function registerPolicy(policy: PolicyDefinition): void {
  if (REGISTRY.has(policy.id)) throw new DuplicatePolicyIdError(policy.id);
  REGISTRY.set(policy.id, policy);
}

export function registerPolicies(policies: PolicyDefinition[]): void {
  for (const p of policies) registerPolicy(p);
}

/** Test-only: lets a test suite reset the registry between runs so
 * `registerPolicy`'s duplicate guard doesn't fire across independent test
 * files that each import the same policy modules — mirrors this
 * repo's existing `resetSubmissionStoreForTest`-style test helpers. */
export function resetPolicyRegistryForTest(): void {
  REGISTRY.clear();
}

export function getPolicy(id: string): PolicyDefinition | undefined {
  return REGISTRY.get(id);
}

export function listAllPolicies(): PolicyDefinition[] {
  return [...REGISTRY.values()];
}

export function listPoliciesByDomain(domain: PolicyDomain): PolicyDefinition[] {
  return listAllPolicies().filter((p) => p.domain === domain);
}

export interface EffectivePolicy {
  definition: PolicyDefinition;
  status: PolicyStatus;
  priority: number;
  overridden: boolean;
}

function applyOverride(definition: PolicyDefinition, override: PolicyOverride | undefined): EffectivePolicy {
  const status = override?.status ?? definition.defaultStatus;
  const priority = override?.priority ?? definition.defaultPriority;
  return { definition, status, priority, overridden: !!override };
}

/** Pure — combines the code-defined registry with an already-loaded set
 * of overrides, sorted by effective priority (ascending). Kept separate
 * from `loadEffectivePolicies` (below) so `decisionEngine.ts`'s core
 * `evaluateDecision` can be tested with a fixed override list, no
 * IndexedDB required. */
export function effectivePoliciesFor(domain: PolicyDomain, overrides: PolicyOverride[]): EffectivePolicy[] {
  const overrideById = new Map(overrides.map((o) => [o.policyId, o] as const));
  return listPoliciesByDomain(domain)
    .map((definition) => applyOverride(definition, overrideById.get(definition.id)))
    .sort((a, b) => a.priority - b.priority);
}

export function enabledEffectivePoliciesFor(domain: PolicyDomain, overrides: PolicyOverride[]): EffectivePolicy[] {
  return effectivePoliciesFor(domain, overrides).filter((p) => p.status === 'ENABLED');
}

/** Async convenience — loads real overrides from storage. */
export async function loadEffectivePolicies(domain: PolicyDomain): Promise<EffectivePolicy[]> {
  const overrides = await loadPolicyOverrides();
  return effectivePoliciesFor(domain, overrides);
}

export async function setPolicyStatus(policyId: string, status: PolicyStatus, now: number = Date.now()): Promise<void> {
  const existing = (await loadPolicyOverrides()).find((o) => o.policyId === policyId);
  await savePolicyOverride({ id: policyId, policyId, status, priority: existing?.priority ?? null, updatedAt: now });
}

export async function setPolicyPriority(policyId: string, priority: number, now: number = Date.now()): Promise<void> {
  const existing = (await loadPolicyOverrides()).find((o) => o.policyId === policyId);
  await savePolicyOverride({ id: policyId, policyId, status: existing?.status ?? null, priority, updatedAt: now });
}

export async function clearPolicyOverride(policyId: string): Promise<void> {
  await deletePolicyOverride(policyId);
}
