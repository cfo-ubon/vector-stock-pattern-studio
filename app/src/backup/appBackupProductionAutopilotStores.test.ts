import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { buildAppBackup } from './appBackupBuilder';
import { applyAppBackupRestore } from './appBackupRestore';
import { APP_BACKUP_STORE_NAMES } from './appBackupFormat';
import { FACTORY_PRODUCTION_SESSIONS_STORE, FACTORY_OWNER_DECISIONS_STORE, FACTORY_PRODUCTION_AUTOPILOT_STATE_STORE } from '../storage/db';
import { putProductionSession, loadProductionSessions, clearProductionSessionsForTest } from '../productionAutopilot/storage/productionSessionStore';
import { putOwnerDecisionRecord, loadOwnerDecisionRecords, clearOwnerDecisionRecordsForTest } from '../productionAutopilot/storage/ownerDecisionStore';
import { putProductionAutopilotState, loadProductionAutopilotState, clearProductionAutopilotStateForTest } from '../productionAutopilot/storage/productionAutopilotStateStore';
import { createProductionSession } from '../productionAutopilot/productionSession';
import { runPreflightValidation } from '../productionAutopilot/preflightValidation';
import { planProductionSession } from '../productionAutopilot/productionSessionPlanner';

// Mission 4 (Production Autopilot) — .vspsb backup coverage for the 3 new
// stores (`factoryProductionSessions`, `factoryOwnerDecisions`,
// `factoryProductionAutopilotState`), following the exact template
// `appBackup031CStores.test.ts` / `appBackupFactoryImprovementStores.test.ts`
// established.

const originalBlob = globalThis.Blob;
beforeEach(async () => {
  globalThis.Blob = NodeBlob as unknown as typeof Blob;
  await Promise.all([clearProductionSessionsForTest(), clearOwnerDecisionRecordsForTest(), clearProductionAutopilotStateForTest()]);
});
afterEach(() => {
  globalThis.Blob = originalBlob;
});

describe('.vspsb coverage — all 3 Mission 4 stores are registered', () => {
  it('APP_BACKUP_STORE_NAMES includes every new Production Autopilot store', () => {
    for (const store of [FACTORY_PRODUCTION_SESSIONS_STORE, FACTORY_OWNER_DECISIONS_STORE, FACTORY_PRODUCTION_AUTOPILOT_STATE_STORE]) {
      expect(APP_BACKUP_STORE_NAMES).toContain(store);
    }
  });
});

describe('.vspsb — non-empty round trip across all 3 stores', () => {
  it('backs up and restores real records from every store, including a session\'s embedded history', async () => {
    const preflight = runPreflightValidation([], [], [], [], 1000);
    const plan = planProductionSession([], [], [], preflight, 1000);
    const session = createProductionSession(plan, 1000);
    await putProductionSession(session);

    await putOwnerDecisionRecord({ id: 'FODEC-1', sessionId: session.id, type: 'APPROVE_SESSION', decidedAt: 1000, durationMs: 4000, note: null });

    await putProductionAutopilotState({ id: 'productionAutopilot', lastSessionId: session.id, lastSessionStatus: 'PLANNED', updatedAt: 1000 });

    const backup = await buildAppBackup();
    expect(backup.manifest.stats.storeRecordCounts[FACTORY_PRODUCTION_SESSIONS_STORE]).toBe(1);
    expect(backup.manifest.stats.storeRecordCounts[FACTORY_OWNER_DECISIONS_STORE]).toBe(1);
    expect(backup.manifest.stats.storeRecordCounts[FACTORY_PRODUCTION_AUTOPILOT_STATE_STORE]).toBe(1);

    await Promise.all([clearProductionSessionsForTest(), clearOwnerDecisionRecordsForTest(), clearProductionAutopilotStateForTest()]);

    const result = await applyAppBackupRestore(backup.blob);
    expect(result.storeRecordCounts[FACTORY_PRODUCTION_SESSIONS_STORE]).toBe(1);
    expect(result.storeRecordCounts[FACTORY_OWNER_DECISIONS_STORE]).toBe(1);
    expect(result.storeRecordCounts[FACTORY_PRODUCTION_AUTOPILOT_STATE_STORE]).toBe(1);

    const restoredSessions = await loadProductionSessions();
    expect(restoredSessions).toHaveLength(1);
    expect(restoredSessions[0].history).toEqual(session.history);
    expect(await loadOwnerDecisionRecords()).toHaveLength(1);
    const restoredState = await loadProductionAutopilotState();
    expect(restoredState.lastSessionId).toBe(session.id);
  });
});

describe('.vspsb — empty-store behavior', () => {
  it('builds and restores cleanly when every new store is empty', async () => {
    const backup = await buildAppBackup();
    for (const store of [FACTORY_PRODUCTION_SESSIONS_STORE, FACTORY_OWNER_DECISIONS_STORE, FACTORY_PRODUCTION_AUTOPILOT_STATE_STORE]) {
      expect(backup.manifest.stats.storeRecordCounts[store]).toBe(0);
    }
    const result = await applyAppBackupRestore(backup.blob);
    for (const store of [FACTORY_PRODUCTION_SESSIONS_STORE, FACTORY_OWNER_DECISIONS_STORE, FACTORY_PRODUCTION_AUTOPILOT_STATE_STORE]) {
      expect(result.storeRecordCounts[store]).toBe(0);
    }
  });
});
