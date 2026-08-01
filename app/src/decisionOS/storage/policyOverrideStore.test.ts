import { describe, it, expect, beforeEach } from 'vitest';
import { savePolicyOverride, loadPolicyOverrides, deletePolicyOverride, clearPolicyOverridesForTest } from './policyOverrideStore';
import type { PolicyOverride } from '../domain/types';

const NOW = 1_700_000_000_000;

function override(overrides: Partial<PolicyOverride> = {}): PolicyOverride {
  return { id: 'p1', policyId: 'p1', status: 'DISABLED', priority: null, updatedAt: NOW, ...overrides };
}

beforeEach(async () => {
  await clearPolicyOverridesForTest();
});

describe('policyOverrideStore', () => {
  it('round-trips a saved override through IndexedDB', async () => {
    await savePolicyOverride(override());
    const all = await loadPolicyOverrides();
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe('DISABLED');
  });

  it('savePolicyOverride updates an existing row in place (keyed by policyId/id)', async () => {
    await savePolicyOverride(override({ status: 'DISABLED' }));
    await savePolicyOverride(override({ status: 'ENABLED', priority: 5, updatedAt: NOW + 1 }));
    const all = await loadPolicyOverrides();
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe('ENABLED');
    expect(all[0].priority).toBe(5);
  });

  it('deletePolicyOverride removes just the targeted override, reverting to policy defaults', async () => {
    await savePolicyOverride(override({ id: 'p1', policyId: 'p1' }));
    await savePolicyOverride(override({ id: 'p2', policyId: 'p2' }));
    await deletePolicyOverride('p1');
    const all = await loadPolicyOverrides();
    expect(all.map((o) => o.policyId)).toEqual(['p2']);
  });

  it('clearPolicyOverridesForTest empties the store', async () => {
    await savePolicyOverride(override());
    await clearPolicyOverridesForTest();
    expect(await loadPolicyOverrides()).toHaveLength(0);
  });
});
