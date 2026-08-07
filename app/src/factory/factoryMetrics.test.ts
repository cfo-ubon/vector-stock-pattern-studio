import { describe, it, expect } from 'vitest';
import { computeFactoryHealth, computeFactoryKpi } from './factoryMetrics';
import { createFactoryTask, transitionFactoryTask } from './domain/factoryTask';
import type { FactoryTimelineEntry } from './domain/types';

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

describe('computeFactoryHealth', () => {
  it('reports null (not enough data), never 0, for an empty queue', () => {
    const health = computeFactoryHealth([], [], 1000);
    expect(health.queueHealth).toBeNull();
    expect(health.completionRate).toBeNull();
    expect(health.repairRatio).toBeNull();
    expect(health.idleTimeMs).toBeNull();
    expect(health.blockedTaskCount).toBe(0);
    expect(health.commercialThroughput).toBe(0);
  });

  it('computes completionRate/blockedTaskCount/commercialThroughput from real tasks', () => {
    let completed = createFactoryTask({ type: 'package', reason: 'x', now: 1000 });
    completed = transitionFactoryTask(completed, 'RUNNING', 1100);
    completed = transitionFactoryTask(completed, 'COMPLETED', 1200);
    const blocked = transitionFactoryTask(transitionFactoryTask(createFactoryTask({ type: 'seo', reason: 'y', now: 1000 }), 'RUNNING', 1100), 'BLOCKED', 1200, 'missing sidecar');
    const health = computeFactoryHealth([completed, blocked], [], 2000);
    expect(health.blockedTaskCount).toBe(1);
    expect(health.completionRate).toBe(50);
    expect(health.commercialThroughput).toBe(1);
  });

  it('excludes CANCELLED tasks from every ratio denominator', () => {
    const cancelled = transitionFactoryTask(createFactoryTask({ type: 'qa', reason: 'x', now: 1000 }), 'CANCELLED', 1100);
    const health = computeFactoryHealth([cancelled], [], 2000);
    expect(health.completionRate).toBeNull();
  });

  it('reports idleTimeMs of 0 while a task is RUNNING', () => {
    const running = transitionFactoryTask(createFactoryTask({ type: 'qa', reason: 'x', now: 1000 }), 'RUNNING', 1500);
    const health = computeFactoryHealth([running], [], 2000);
    expect(health.idleTimeMs).toBe(0);
  });
});

describe('computeFactoryKpi', () => {
  it('reports null averageTaskTimeMs when the Timeline has no FINISHED entries yet', () => {
    const kpi = computeFactoryKpi([], [], 1000);
    expect(kpi.averageTaskTimeMs).toBeNull();
    expect(kpi.factoryEfficiency).toBeNull();
  });

  it('derives averageTaskTimeMs from real FINISHED Timeline durations', () => {
    const timeline = [timelineEntry({ durationMs: 1000 }), timelineEntry({ durationMs: 3000 })];
    const kpi = computeFactoryKpi([], timeline, 5000);
    expect(kpi.averageTaskTimeMs).toBe(2000);
  });

  it('factoryEfficiency counts a BLOCKED-noted FINISHED event as unsuccessful', () => {
    const timeline = [timelineEntry({ note: 'ok' }), timelineEntry({ note: 'BLOCKED: no sidecar' })];
    const kpi = computeFactoryKpi([], timeline, 5000);
    expect(kpi.factoryEfficiency).toBe(50);
  });

  it('reuses computeFactoryHealth counts rather than recomputing them independently', () => {
    let completed = createFactoryTask({ type: 'package', reason: 'x', now: 1000 });
    completed = transitionFactoryTask(completed, 'RUNNING', 1100);
    completed = transitionFactoryTask(completed, 'COMPLETED', 1200);
    const kpi = computeFactoryKpi([completed], [], 2000);
    expect(kpi.commercialThroughput).toBe(1);
  });
});
