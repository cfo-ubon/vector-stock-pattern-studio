import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { buildAppBackup } from './appBackupBuilder';
import { applyAppBackupRestore } from './appBackupRestore';
import { APP_BACKUP_STORE_NAMES } from './appBackupFormat';
import { FACTORY_QUEUE_STORE, FACTORY_TIMELINE_STORE, FACTORY_SCHEDULER_STATE_STORE } from '../storage/db';
import { createFactoryTask } from '../factory/domain/factoryTask';
import { putFactoryTask, loadFactoryTasks, clearFactoryQueueForTest } from '../factory/storage/factoryQueueStore';
import { putFactoryTimelineEntry, loadFactoryTimeline, clearFactoryTimelineForTest } from '../factory/storage/factoryTimelineStore';
import { putFactorySchedulerState, loadFactorySchedulerState, clearFactorySchedulerStateForTest } from '../factory/storage/factorySchedulerStateStore';

// Build 031C — .vspsb backup coverage for the 3 new Factory Controller
// stores (`factoryQueue`, `factoryTimeline`, `factorySchedulerState`),
// following the exact template `appBackup031BStores.test.ts` established.

const originalBlob = globalThis.Blob;
beforeEach(async () => {
  globalThis.Blob = NodeBlob as unknown as typeof Blob;
  await Promise.all([clearFactoryQueueForTest(), clearFactoryTimelineForTest(), clearFactorySchedulerStateForTest()]);
});
afterEach(() => {
  globalThis.Blob = originalBlob;
});

describe('.vspsb coverage — all 3 Build 031C stores are registered', () => {
  it('APP_BACKUP_STORE_NAMES includes factoryQueue, factoryTimeline, factorySchedulerState', () => {
    for (const store of [FACTORY_QUEUE_STORE, FACTORY_TIMELINE_STORE, FACTORY_SCHEDULER_STATE_STORE]) {
      expect(APP_BACKUP_STORE_NAMES).toContain(store);
    }
  });
});

describe('.vspsb — non-empty round trip across all 3 stores', () => {
  it('backs up and restores real records from every store, including the task history embedded in each FactoryTask', async () => {
    const task = createFactoryTask({ type: 'qa', reason: 'confirm QA', assetId: 'A-1', now: 1000 });
    await putFactoryTask(task);
    await putFactoryTimelineEntry({
      id: 'FTL-1',
      taskId: task.id,
      taskType: 'qa',
      batchId: null,
      event: 'STARTED',
      note: 'confirm QA',
      durationMs: null,
      decisionId: null,
      policyIds: [],
      evidenceIds: [],
      confidenceScore: null,
      confidenceBand: null,
      at: 1000,
    });
    await putFactorySchedulerState({ id: 'scheduler', running: true, pausedReason: null, lastScheduledAt: 1000, lastReplanAt: null, activeTaskId: null, updatedAt: 1000 });

    const backup = await buildAppBackup();
    expect(backup.manifest.stats.storeRecordCounts[FACTORY_QUEUE_STORE]).toBe(1);
    expect(backup.manifest.stats.storeRecordCounts[FACTORY_TIMELINE_STORE]).toBe(1);
    expect(backup.manifest.stats.storeRecordCounts[FACTORY_SCHEDULER_STATE_STORE]).toBe(1);

    await Promise.all([clearFactoryQueueForTest(), clearFactoryTimelineForTest(), clearFactorySchedulerStateForTest()]);

    const result = await applyAppBackupRestore(backup.blob);
    expect(result.storeRecordCounts[FACTORY_QUEUE_STORE]).toBe(1);
    expect(result.storeRecordCounts[FACTORY_TIMELINE_STORE]).toBe(1);
    expect(result.storeRecordCounts[FACTORY_SCHEDULER_STATE_STORE]).toBe(1);

    const restoredTasks = await loadFactoryTasks();
    expect(restoredTasks).toHaveLength(1);
    expect(restoredTasks[0].history).toEqual(task.history);
    expect(await loadFactoryTimeline()).toHaveLength(1);
    const restoredState = await loadFactorySchedulerState();
    expect(restoredState.running).toBe(true);
  });
});

describe('.vspsb — empty-store behavior', () => {
  it('builds and restores cleanly when every new store is empty', async () => {
    const backup = await buildAppBackup();
    for (const store of [FACTORY_QUEUE_STORE, FACTORY_TIMELINE_STORE, FACTORY_SCHEDULER_STATE_STORE]) {
      expect(backup.manifest.stats.storeRecordCounts[store]).toBe(0);
    }
    const result = await applyAppBackupRestore(backup.blob);
    for (const store of [FACTORY_QUEUE_STORE, FACTORY_TIMELINE_STORE, FACTORY_SCHEDULER_STATE_STORE]) {
      expect(result.storeRecordCounts[store]).toBe(0);
    }
  });
});
