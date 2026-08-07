import { describe, it, expect, beforeEach } from 'vitest';
import { runNextFactoryTask, replanFactoryQueue, pauseFactoryScheduler, resumeFactoryScheduler, pauseGenerationOnRepairSpike, drainFactoryQueue } from './scheduler';
import { createFactoryTask } from './domain/factoryTask';
import { clearFactoryQueueForTest, putFactoryTask, loadFactoryTasks } from './storage/factoryQueueStore';
import { clearFactoryTimelineForTest, loadFactoryTimeline } from './storage/factoryTimelineStore';
import { clearFactorySchedulerStateForTest, loadFactorySchedulerState } from './storage/factorySchedulerStateStore';
import { clearQualitySnapshots, putQualitySnapshot, createQualitySnapshot } from '../catalog/quality/qualitySnapshotStore';
import { clearCollectionsStore, putCollectionRecord } from '../catalog/storage/collectionStore';
import { createCollection } from '../catalog/domain/collection';
import { clearPortfolioStores, putPortfolioAsset } from '../catalog/storage/portfolioStore';
import { createPortfolioAsset } from '../catalog/domain/asset';

const NO_SIGNALS = { reviewCount: 0, rejectCount: 0, totalEvaluated: 0, readyBacklogCount: 0, exportBlockedCount: 0, collectionsNearCompletion: [] };

beforeEach(async () => {
  await clearFactoryQueueForTest();
  await clearFactoryTimelineForTest();
  await clearFactorySchedulerStateForTest();
  await clearQualitySnapshots();
  await clearCollectionsStore();
  await clearPortfolioStores();
});

describe('runNextFactoryTask', () => {
  it('reports no runnable tasks on an empty queue without error', async () => {
    const result = await runNextFactoryTask(1000);
    expect(result).toEqual({ ranTaskId: null, ok: true, detail: 'No runnable tasks in the queue.' });
  });

  it('never auto-runs a generate task even when it is the only READY task', async () => {
    const generate = createFactoryTask({ type: 'generate', reason: 'batch', now: 1000 });
    await putFactoryTask(generate);
    const result = await runNextFactoryTask(2000);
    expect(result.ranTaskId).toBeNull();
  });

  it('runs the lowest-priority READY task and appends a Timeline entry', async () => {
    const collection = createCollection({ name: 'Test Collection', now: 1000 });
    await putCollectionRecord(collection);
    const task = createFactoryTask({ type: 'collectionCompletion', reason: 'check', collectionId: collection.id, now: 1000 });
    await putFactoryTask(task);

    const result = await runNextFactoryTask(2000);
    expect(result.ranTaskId).toBe(task.id);

    const tasks = await loadFactoryTasks();
    expect(['COMPLETED', 'BLOCKED']).toContain(tasks[0].status);

    const timeline = await loadFactoryTimeline();
    expect(timeline.some((e) => e.taskId === task.id && e.event === 'STARTED')).toBe(true);
    expect(timeline.some((e) => e.taskId === task.id && (e.event === 'FINISHED' || e.event === 'BLOCKED'))).toBe(true);
  });

  it('does not run anything while the Scheduler is paused', async () => {
    const task = createFactoryTask({ type: 'qa', reason: 'x', assetId: 'A-1', now: 1000 });
    await putFactoryTask(task);
    await pauseFactoryScheduler('Repair ratio too high', 1500);
    const result = await runNextFactoryTask(2000);
    expect(result.ranTaskId).toBeNull();
    expect(result.ok).toBe(false);
  });

  it('resumeFactoryScheduler clears the pause and allows tasks to run again', async () => {
    await pauseFactoryScheduler('paused for a test', 1000);
    await resumeFactoryScheduler(1500);
    const state = await loadFactorySchedulerState();
    expect(state.running).toBe(true);
    expect(state.pausedReason).toBeNull();
  });
});

describe('replanFactoryQueue', () => {
  it('promotes a WAITING task to READY once its dependency completes, and reports it as changed', async () => {
    const generate = createFactoryTask({ type: 'generate', reason: 'batch', now: 1000 });
    const qa = createFactoryTask({ type: 'qa', reason: 'confirm', assetId: 'A-1', dependsOnTaskIds: [generate.id], now: 1000 });
    await putFactoryTask(generate);
    await putFactoryTask(qa);

    const firstPlan = await replanFactoryQueue(NO_SIGNALS, 1500);
    expect(firstPlan.changedCount).toBe(0);
    let tasks = await loadFactoryTasks();
    expect(tasks.find((t) => t.id === qa.id)?.status).toBe('WAITING');

    const completedGenerate = { ...generate, status: 'COMPLETED' as const, completedAt: 2000 };
    await putFactoryTask(completedGenerate);
    const secondPlan = await replanFactoryQueue(NO_SIGNALS, 2500);
    expect(secondPlan.changedCount).toBeGreaterThan(0);

    tasks = await loadFactoryTasks();
    expect(tasks.find((t) => t.id === qa.id)?.status).toBe('READY');
  });

  it('boosts a matching task type priority when a dynamic-priority signal is true', async () => {
    const repair = createFactoryTask({ type: 'repair', reason: 'x', assetId: 'A-1', priority: 100, now: 1000 });
    await putFactoryTask(repair);
    await replanFactoryQueue({ ...NO_SIGNALS, reviewCount: 5, rejectCount: 5, totalEvaluated: 10 }, 2000);
    const tasks = await loadFactoryTasks();
    expect(tasks[0].priority).toBeLessThan(repair.basePriority);
  });

  it('records lastReplanAt on the Scheduler State', async () => {
    await replanFactoryQueue(NO_SIGNALS, 3000);
    const state = await loadFactorySchedulerState();
    expect(state.lastReplanAt).toBe(3000);
  });
});

describe('drainFactoryQueue', () => {
  it('reports no runnable tasks on an empty queue without error', async () => {
    const result = await drainFactoryQueue(1000);
    expect(result.ranTaskIds).toEqual([]);
  });

  it('runs a whole WAITING->READY dependency chain to completion in one call — Mission 7: without this, a task whose dependency just completed stays WAITING forever, because runNextFactoryTask never re-resolves dependencies on its own', async () => {
    const asset = createPortfolioAsset({ displayName: 'A-1', originalFilename: 'a.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
    await putPortfolioAsset(asset);
    const snapshot = createQualitySnapshot({ assetId: asset.assetId, beautyScore: 80, commercialScore: 80, fragmented: false, deadSpace: false, decision: 'READY', generatorVersion: 'v1', now: 1000 });
    await putQualitySnapshot(snapshot);

    const qa = createFactoryTask({ type: 'qa', reason: 'confirm', assetId: asset.assetId, now: 1000 });
    const portfolioUpdate = createFactoryTask({ type: 'portfolioUpdate', reason: 'sync status', assetId: asset.assetId, dependsOnTaskIds: [qa.id], now: 1000 });
    await putFactoryTask(qa);
    await putFactoryTask(portfolioUpdate);

    let tasks = await loadFactoryTasks();
    expect(tasks.find((t) => t.id === portfolioUpdate.id)?.status).toBe('WAITING');

    const result = await drainFactoryQueue(2000);
    expect(result.ranTaskIds).toEqual(expect.arrayContaining([qa.id, portfolioUpdate.id]));

    tasks = await loadFactoryTasks();
    expect(tasks.find((t) => t.id === qa.id)?.status).toBe('COMPLETED');
    expect(tasks.find((t) => t.id === portfolioUpdate.id)?.status).toBe('COMPLETED');
  });

  it('never runs a generate task and stops cleanly once it is the only thing left', async () => {
    const generate = createFactoryTask({ type: 'generate', reason: 'batch', now: 1000 });
    await putFactoryTask(generate);
    const result = await drainFactoryQueue(2000);
    expect(result.ranTaskIds).toEqual([]);
    const tasks = await loadFactoryTasks();
    expect(tasks.find((t) => t.id === generate.id)?.status).toBe('READY');
  });
});

describe('pauseGenerationOnRepairSpike', () => {
  it('pauses the Scheduler when the repair ratio crosses the threshold, and is a no-op below it', async () => {
    const belowThreshold = await pauseGenerationOnRepairSpike(20, 50, 1000);
    expect(belowThreshold).toBe(false);
    let state = await loadFactorySchedulerState();
    expect(state.pausedReason).toBeNull();

    const aboveThreshold = await pauseGenerationOnRepairSpike(60, 50, 2000);
    expect(aboveThreshold).toBe(true);
    state = await loadFactorySchedulerState();
    expect(state.pausedReason).toContain('60.0%');
  });
});
