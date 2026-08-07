import type { FactoryTask, FactoryTimelineEntry, FactoryTaskType } from '../factory/domain/types';
import { computeFactoryHealth, computeFactoryKpi } from '../factory/factoryMetrics';
import type { FactoryIntelligenceMetrics } from './domain/types';

// Mission 2, Part 1 — Factory Metrics Engine. Every per-stage average
// reuses Build 031C's own `computeFactoryHealth`/`computeFactoryKpi` for
// the metrics they already compute correctly (factoryEfficiency,
// queueEfficiency, commercialThroughput, repairRatio, blockedTaskRatio,
// ownerWaitingTimeMs) rather than recomputing them a second, possibly
// drifting way — this module only adds the metrics Build 031C did not
// need: per-stage average durations, queue wait time, batch completion
// time, and Commercial Ready Ratio. Every average is `null` until at
// least one real terminal (FINISHED) Timeline entry of that kind exists.

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function averageDurationForType(timeline: FactoryTimelineEntry[], type: FactoryTaskType): number | null {
  const durations = timeline.filter((e) => e.event === 'FINISHED' && e.taskType === type && e.durationMs !== null).map((e) => e.durationMs as number);
  return average(durations);
}

/** Queue wait time — the real gap between a task being created (queued)
 * and actually starting to run. Only tasks that have started contribute;
 * a task still waiting has no real wait duration to report yet. */
export function computeAverageQueueTimeMs(tasks: FactoryTask[]): number | null {
  const waits = tasks.filter((t) => t.startedAt !== null).map((t) => (t.startedAt as number) - t.createdAt);
  return average(waits);
}

export interface BatchDuration {
  batchId: string;
  startedAt: number;
  completedAt: number;
  durationMs: number;
}

/** Part 1/4/11 — one entry per batch that has fully finished (every task
 * sharing that `batchId` is terminal: COMPLETED or CANCELLED). An
 * in-progress batch contributes nothing yet, rather than an estimate.
 * `startedAt` is the batch's `generate` task's `createdAt`; `completedAt`
 * is the latest `completedAt`/`updatedAt` across every task in the batch. */
export function computeBatchDurations(tasks: FactoryTask[]): BatchDuration[] {
  const byBatch = new Map<string, FactoryTask[]>();
  for (const task of tasks) {
    if (!task.batchId) continue;
    const list = byBatch.get(task.batchId) ?? [];
    list.push(task);
    byBatch.set(task.batchId, list);
  }

  const results: BatchDuration[] = [];
  for (const [batchId, batchTasks] of byBatch) {
    const allTerminal = batchTasks.every((t) => t.status === 'COMPLETED' || t.status === 'CANCELLED');
    if (!allTerminal) continue;
    const generateTask = batchTasks.find((t) => t.type === 'generate');
    if (!generateTask) continue;
    const startedAt = generateTask.createdAt;
    const completedAt = Math.max(...batchTasks.map((t) => t.completedAt ?? t.updatedAt));
    if (completedAt <= startedAt) continue;
    results.push({ batchId, startedAt, completedAt, durationMs: completedAt - startedAt });
  }
  return results;
}

/** Commercial Ready Ratio — of every `exportValidation` task that has
 * actually been resolved (COMPLETED or BLOCKED, i.e. attempted), the
 * share that COMPLETED (passed the safety threshold). `null` until at
 * least one has been resolved. */
function computeCommercialReadyRatio(tasks: FactoryTask[]): number | null {
  const resolved = tasks.filter((t) => t.type === 'exportValidation' && (t.status === 'COMPLETED' || t.status === 'BLOCKED'));
  if (resolved.length === 0) return null;
  const ready = resolved.filter((t) => t.status === 'COMPLETED').length;
  return Math.round((ready / resolved.length) * 100);
}

export function computeFactoryIntelligenceMetrics(tasks: FactoryTask[], timeline: FactoryTimelineEntry[], now: number = Date.now()): FactoryIntelligenceMetrics {
  const health = computeFactoryHealth(tasks, timeline, now);
  const kpi = computeFactoryKpi(tasks, timeline, now);
  const batchDurations = computeBatchDurations(tasks);

  return {
    computedAt: now,
    factoryEfficiency: kpi.factoryEfficiency,
    queueEfficiency: kpi.queueEfficiency,
    commercialThroughput: health.commercialThroughput,
    averageBatchTimeMs: average(batchDurations.map((b) => b.durationMs)),
    averageQueueTimeMs: computeAverageQueueTimeMs(tasks),
    averageRepairTimeMs: averageDurationForType(timeline, 'repair'),
    averageQaTimeMs: averageDurationForType(timeline, 'qa'),
    averageSeoTimeMs: averageDurationForType(timeline, 'seo'),
    averagePackagingTimeMs: averageDurationForType(timeline, 'package'),
    averageExportPreparationTimeMs: averageDurationForType(timeline, 'exportValidation'),
    blockedTaskRatio: kpi.blockedRatio,
    repairRatio: kpi.repairRatio,
    commercialReadyRatio: computeCommercialReadyRatio(tasks),
    ownerWaitingTimeMs: kpi.ownerWaitingTimeMs,
  };
}
