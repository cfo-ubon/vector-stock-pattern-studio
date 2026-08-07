import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { buildAppBackup } from './appBackupBuilder';
import { applyAppBackupRestore } from './appBackupRestore';
import { APP_BACKUP_STORE_NAMES } from './appBackupFormat';
import { FACTORY_ORCHESTRATION_RUNS_STORE, FACTORY_ORCHESTRATION_ARCHIVES_STORE } from '../storage/db';
import { putOrchestrationRun, loadOrchestrationRuns, clearOrchestrationRunsForTest } from '../factoryOrchestrator/storage/orchestrationRunStore';
import { putProductionSessionArchive, loadProductionSessionArchives, clearProductionSessionArchivesForTest } from '../factoryOrchestrator/storage/sessionArchiveStore';
import { createOrchestrationRun, transitionOrchestrationRun } from '../factoryOrchestrator/orchestrationRun';
import { buildFactoryExecutionContext } from '../factoryOrchestrator/executionContext';
import { buildProductionSessionArchive } from '../factoryOrchestrator/sessionArchive';

// Mission 5 (Factory Orchestrator) — .vspsb backup coverage for the 2 new
// stores (`factoryOrchestrationRuns`, `factoryOrchestrationArchives`),
// following the exact template `appBackupProductionAutopilotStores.test.ts`
// established in Mission 4.

const originalBlob = globalThis.Blob;
beforeEach(async () => {
  globalThis.Blob = NodeBlob as unknown as typeof Blob;
  await Promise.all([clearOrchestrationRunsForTest(), clearProductionSessionArchivesForTest()]);
});
afterEach(() => {
  globalThis.Blob = originalBlob;
});

describe('.vspsb coverage — both Mission 5 stores are registered', () => {
  it('APP_BACKUP_STORE_NAMES includes every new Factory Orchestrator store', () => {
    for (const store of [FACTORY_ORCHESTRATION_RUNS_STORE, FACTORY_ORCHESTRATION_ARCHIVES_STORE]) {
      expect(APP_BACKUP_STORE_NAMES).toContain(store);
    }
  });
});

describe('.vspsb — non-empty round trip across both stores', () => {
  it('backs up and restores real records from both stores, including a run\'s embedded history', async () => {
    let run = createOrchestrationRun(1000);
    run = transitionOrchestrationRun(run, 'PREPARING', 1001);
    await putOrchestrationRun(run);

    const context = buildFactoryExecutionContext(run.id, [], [], [], [], null, 1000);
    const archive = buildProductionSessionArchive(run, context, [], [], [], [], 2000);
    await putProductionSessionArchive(archive);

    const backup = await buildAppBackup();
    expect(backup.manifest.stats.storeRecordCounts[FACTORY_ORCHESTRATION_RUNS_STORE]).toBe(1);
    expect(backup.manifest.stats.storeRecordCounts[FACTORY_ORCHESTRATION_ARCHIVES_STORE]).toBe(1);

    await Promise.all([clearOrchestrationRunsForTest(), clearProductionSessionArchivesForTest()]);

    const result = await applyAppBackupRestore(backup.blob);
    expect(result.storeRecordCounts[FACTORY_ORCHESTRATION_RUNS_STORE]).toBe(1);
    expect(result.storeRecordCounts[FACTORY_ORCHESTRATION_ARCHIVES_STORE]).toBe(1);

    const restoredRuns = await loadOrchestrationRuns();
    expect(restoredRuns).toHaveLength(1);
    expect(restoredRuns[0].history).toEqual(run.history);

    const restoredArchives = await loadProductionSessionArchives();
    expect(restoredArchives).toHaveLength(1);
    expect(restoredArchives[0].id).toBe(archive.id);
  });
});

describe('.vspsb — empty-store behavior', () => {
  it('builds and restores cleanly when both new stores are empty', async () => {
    const backup = await buildAppBackup();
    for (const store of [FACTORY_ORCHESTRATION_RUNS_STORE, FACTORY_ORCHESTRATION_ARCHIVES_STORE]) {
      expect(backup.manifest.stats.storeRecordCounts[store]).toBe(0);
    }
    const result = await applyAppBackupRestore(backup.blob);
    for (const store of [FACTORY_ORCHESTRATION_RUNS_STORE, FACTORY_ORCHESTRATION_ARCHIVES_STORE]) {
      expect(result.storeRecordCounts[store]).toBe(0);
    }
  });
});
