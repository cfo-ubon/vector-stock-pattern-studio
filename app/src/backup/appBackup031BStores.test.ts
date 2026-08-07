import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { buildAppBackup } from './appBackupBuilder';
import { applyAppBackupRestore } from './appBackupRestore';
import { APP_BACKUP_STORE_NAMES } from './appBackupFormat';
import { COMMERCIAL_PACKAGE_HISTORY_STORE, DECISION_TIMELINE_STORE, DECISION_POLICY_OVERRIDES_STORE } from '../storage/db';
import { recordCommercialPackageBuilt, clearCommercialPackageHistory, loadCommercialPackageHistory } from '../commercial/storage/commercialPackageHistoryStore';
import { recordDecisionTimelineEntry, clearDecisionTimelineForTest, loadDecisionTimeline } from '../decisionOS/storage/decisionTimelineStore';
import { savePolicyOverride, clearPolicyOverridesForTest, loadPolicyOverrides } from '../decisionOS/storage/policyOverrideStore';

// Build 031B — .vspsb backup coverage for `commercialPackageHistory` (a
// Build 031A gap this build closes) plus the two Decision OS stores
// (`decisionTimeline` Part 8, `decisionPolicyOverrides` Part 9), following
// the exact template `appBackup030Part2Stores.test.ts` established.

const originalBlob = globalThis.Blob;
beforeEach(async () => {
  globalThis.Blob = NodeBlob as unknown as typeof Blob;
  await Promise.all([clearCommercialPackageHistory(), clearDecisionTimelineForTest(), clearPolicyOverridesForTest()]);
});
afterEach(() => {
  globalThis.Blob = originalBlob;
});

describe('.vspsb coverage — all 3 Build 031B stores are registered', () => {
  it('APP_BACKUP_STORE_NAMES includes commercialPackageHistory, decisionTimeline, decisionPolicyOverrides', () => {
    for (const store of [COMMERCIAL_PACKAGE_HISTORY_STORE, DECISION_TIMELINE_STORE, DECISION_POLICY_OVERRIDES_STORE]) {
      expect(APP_BACKUP_STORE_NAMES).toContain(store);
    }
  });
});

describe('.vspsb — non-empty round trip across all 3 stores', () => {
  it('backs up and restores real records from every store', async () => {
    await recordCommercialPackageBuilt({ assetId: 'ASSET-1', marketplaceId: 'etsy', status: 'BUILT', readinessScore: 96, now: 1000 });
    await recordDecisionTimelineEntry({
      id: 'DEC-1',
      decisionId: 'DEC-1',
      domain: 'factory',
      requestedAction: null,
      recommendedAction: 'doThing',
      businessImpact: 'MEDIUM',
      confidenceScore: 80,
      confidenceBand: 'high',
      policyIds: ['factory.qaBeforeExport'],
      evidenceIds: ['qa:assetQaStatus'],
      blockedReasons: [],
      warnings: [],
      explanation: ['recommended'],
      createdAt: 1000,
    });
    await savePolicyOverride({ id: 'factory.qaBeforeExport', policyId: 'factory.qaBeforeExport', status: 'DISABLED', priority: null, updatedAt: 1000 });

    const backup = await buildAppBackup();
    expect(backup.manifest.stats.storeRecordCounts[COMMERCIAL_PACKAGE_HISTORY_STORE]).toBe(1);
    expect(backup.manifest.stats.storeRecordCounts[DECISION_TIMELINE_STORE]).toBe(1);
    expect(backup.manifest.stats.storeRecordCounts[DECISION_POLICY_OVERRIDES_STORE]).toBe(1);

    await Promise.all([clearCommercialPackageHistory(), clearDecisionTimelineForTest(), clearPolicyOverridesForTest()]);

    const result = await applyAppBackupRestore(backup.blob);
    expect(result.storeRecordCounts[COMMERCIAL_PACKAGE_HISTORY_STORE]).toBe(1);
    expect(result.storeRecordCounts[DECISION_TIMELINE_STORE]).toBe(1);
    expect(result.storeRecordCounts[DECISION_POLICY_OVERRIDES_STORE]).toBe(1);

    expect(await loadCommercialPackageHistory()).toHaveLength(1);
    expect(await loadDecisionTimeline()).toHaveLength(1);
    expect(await loadPolicyOverrides()).toHaveLength(1);
  });
});

describe('.vspsb — empty-store behavior', () => {
  it('builds and restores cleanly when every new store is empty', async () => {
    const backup = await buildAppBackup();
    for (const store of [COMMERCIAL_PACKAGE_HISTORY_STORE, DECISION_TIMELINE_STORE, DECISION_POLICY_OVERRIDES_STORE]) {
      expect(backup.manifest.stats.storeRecordCounts[store]).toBe(0);
    }
    const result = await applyAppBackupRestore(backup.blob);
    for (const store of [COMMERCIAL_PACKAGE_HISTORY_STORE, DECISION_TIMELINE_STORE, DECISION_POLICY_OVERRIDES_STORE]) {
      expect(result.storeRecordCounts[store]).toBe(0);
    }
  });
});
