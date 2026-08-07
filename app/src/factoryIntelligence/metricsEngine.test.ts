import { describe, it, expect } from 'vitest';
import { computeFactoryIntelligenceMetrics, computeAverageQueueTimeMs, computeBatchDurations } from './metricsEngine';
import { createFactoryTask, transitionFactoryTask } from '../factory/domain/factoryTask';
import type { FactoryTimelineEntry } from '../factory/domain/types';

function timelineEntry(overrides: Partial<FactoryTimelineEntry>): FactoryTimelineEntry {
  return {
    id: `FTL-${Math.random()}`,
    taskId: 'FTASK-1',
    taskType: 'qa',
    batchId: null,
    event: 'FINISHED',
    note: 'ok',
    durationMs: 1000,
    decisionId: null,
    policyIds: [],
    evidenceIds: [],
    confidenceScore: null,
    confidenceBand: null,
    at: 1000,
    ...overrides,
  };
}

describe('computeAverageQueueTimeMs', () => {
  it('is null when no task has started yet', () => {
    const task = createFactoryTask({ type: 'qa', reason: 'x', now: 1000 });
    expect(computeAverageQueueTimeMs([task])).toBeNull();
  });

  it('averages startedAt - createdAt across started tasks', () => {
    let a = createFactoryTask({ type: 'qa', reason: 'x', now: 1000 });
    a = transitionFactoryTask(a, 'RUNNING', 3000);
    let b = createFactoryTask({ type: 'qa', reason: 'y', now: 1000 });
    b = transitionFactoryTask(b, 'RUNNING', 5000);
    expect(computeAverageQueueTimeMs([a, b])).toBe(3000);
  });
});

describe('computeBatchDurations', () => {
  it('only includes batches where every task is terminal', () => {
    const generate = { ...createFactoryTask({ type: 'generate', reason: 'batch', now: 1000, batchId: 'B1' }) };
    const completedGenerate = transitionFactoryTask(transitionFactoryTask(generate, 'RUNNING', 1500), 'COMPLETED', 2000);
    const qa = createFactoryTask({ type: 'qa', reason: 'x', batchId: 'B1', assetId: 'A-1', now: 1000 });
    const runningQa = transitionFactoryTask(qa, 'RUNNING', 2500);
    expect(computeBatchDurations([completedGenerate, runningQa])).toEqual([]);

    const completedQa = transitionFactoryTask(runningQa, 'COMPLETED', 4000);
    const durations = computeBatchDurations([completedGenerate, completedQa]);
    expect(durations).toHaveLength(1);
    expect(durations[0]).toEqual({ batchId: 'B1', startedAt: 1000, completedAt: 4000, durationMs: 3000 });
  });

  it('excludes tasks with no batchId', () => {
    const task = createFactoryTask({ type: 'qa', reason: 'x', now: 1000 });
    expect(computeBatchDurations([task])).toEqual([]);
  });
});

describe('computeFactoryIntelligenceMetrics', () => {
  it('reports null for every average on an empty queue, never 0', () => {
    const metrics = computeFactoryIntelligenceMetrics([], [], 1000);
    expect(metrics.averageBatchTimeMs).toBeNull();
    expect(metrics.averageQueueTimeMs).toBeNull();
    expect(metrics.averageRepairTimeMs).toBeNull();
    expect(metrics.averageQaTimeMs).toBeNull();
    expect(metrics.averageSeoTimeMs).toBeNull();
    expect(metrics.averagePackagingTimeMs).toBeNull();
    expect(metrics.averageExportPreparationTimeMs).toBeNull();
    expect(metrics.commercialReadyRatio).toBeNull();
    expect(metrics.commercialThroughput).toBe(0);
  });

  it('computes per-stage average durations only from real FINISHED Timeline entries of that type', () => {
    const timeline = [timelineEntry({ taskType: 'repair', durationMs: 2000 }), timelineEntry({ taskType: 'repair', durationMs: 4000 }), timelineEntry({ taskType: 'qa', durationMs: 500 })];
    const metrics = computeFactoryIntelligenceMetrics([], timeline, 5000);
    expect(metrics.averageRepairTimeMs).toBe(3000);
    expect(metrics.averageQaTimeMs).toBe(500);
    expect(metrics.averageSeoTimeMs).toBeNull();
  });

  it('computes commercialReadyRatio only from resolved (COMPLETED or BLOCKED) exportValidation tasks', () => {
    let ready = createFactoryTask({ type: 'exportValidation', reason: 'x', assetId: 'A-1', now: 1000 });
    ready = transitionFactoryTask(transitionFactoryTask(ready, 'RUNNING', 1500), 'COMPLETED', 2000);
    let blocked = createFactoryTask({ type: 'exportValidation', reason: 'y', assetId: 'A-2', now: 1000 });
    blocked = transitionFactoryTask(transitionFactoryTask(blocked, 'RUNNING', 1500), 'BLOCKED', 2000, 'readiness too low');
    const metrics = computeFactoryIntelligenceMetrics([ready, blocked], [], 3000);
    expect(metrics.commercialReadyRatio).toBe(50);
  });

  it('reuses factory/factoryMetrics.ts for factoryEfficiency/queueEfficiency/blockedTaskRatio/repairRatio/ownerWaitingTimeMs rather than recomputing them', () => {
    const metrics = computeFactoryIntelligenceMetrics([], [], 1000);
    expect(metrics.factoryEfficiency).toBeNull();
    expect(metrics.queueEfficiency).toBeNull();
    expect(metrics.blockedTaskRatio).toBeNull();
    expect(metrics.repairRatio).toBeNull();
    expect(metrics.ownerWaitingTimeMs).toBeNull();
  });
});
