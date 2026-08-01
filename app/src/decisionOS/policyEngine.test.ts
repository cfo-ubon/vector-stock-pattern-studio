import { describe, it, expect, beforeEach } from 'vitest';
import type { PolicyDefinition, PolicyEvaluation } from './domain/types';
import { registerPolicy, resetPolicyRegistryForTest, listPoliciesByDomain, effectivePoliciesFor, enabledEffectivePoliciesFor } from './policyEngine';

function makePolicy(id: string, priority: number, status: 'ENABLED' | 'DISABLED' = 'ENABLED'): PolicyDefinition {
  return {
    id,
    name: id,
    description: 'test policy',
    domain: 'factory',
    version: 1,
    defaultPriority: priority,
    defaultStatus: status,
    requiredEvidence: [],
    expectedOutcome: 'test',
    impactWhenApplies: 'LOW',
    examples: [],
    evaluate: (): PolicyEvaluation => ({ policyId: id, policyName: id, domain: 'factory', applies: false, action: null, blockedReason: null, warning: null, detail: 'n/a', evidenceIds: [] }),
  };
}

describe('policyEngine', () => {
  beforeEach(() => {
    resetPolicyRegistryForTest();
  });

  it('registers a policy and rejects a duplicate id', () => {
    registerPolicy(makePolicy('a', 1));
    expect(() => registerPolicy(makePolicy('a', 2))).toThrow(/already registered/);
  });

  it('lists policies scoped to a domain', () => {
    registerPolicy(makePolicy('a', 1));
    expect(listPoliciesByDomain('factory')).toHaveLength(1);
    expect(listPoliciesByDomain('portfolio')).toHaveLength(0);
  });

  it('sorts effective policies by priority ascending', () => {
    registerPolicy(makePolicy('low-priority', 30));
    registerPolicy(makePolicy('high-priority', 5));
    const effective = effectivePoliciesFor('factory', []);
    expect(effective.map((p) => p.definition.id)).toEqual(['high-priority', 'low-priority']);
  });

  it('an override changes effective status/priority without mutating the definition', () => {
    registerPolicy(makePolicy('a', 10, 'ENABLED'));
    const overridden = effectivePoliciesFor('factory', [{ id: 'a', policyId: 'a', status: 'DISABLED', priority: 1, updatedAt: 1 }]);
    expect(overridden[0].status).toBe('DISABLED');
    expect(overridden[0].priority).toBe(1);
    expect(overridden[0].overridden).toBe(true);
    expect(overridden[0].definition.defaultStatus).toBe('ENABLED');
  });

  it('enabledEffectivePoliciesFor excludes disabled policies (including via override)', () => {
    registerPolicy(makePolicy('a', 1, 'ENABLED'));
    registerPolicy(makePolicy('b', 2, 'DISABLED'));
    const enabled = enabledEffectivePoliciesFor('factory', [{ id: 'a', policyId: 'a', status: 'DISABLED', priority: null, updatedAt: 1 }]);
    expect(enabled).toHaveLength(0);
  });
});
