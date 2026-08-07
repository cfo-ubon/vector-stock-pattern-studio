import type { FactoryTask, FactoryTimelineEntry } from './domain/types';

// Build 031C, Parts 7/10 — Factory Health + Factory KPI. Both read only
// the real `FactoryTask[]`/`FactoryTimelineEntry[]` already in the queue/
// timeline — no invented metric, and every rate that has no real
// denominator yet reports `null` ("not enough data"), matching this
// repo's own `commercial/businessMetrics.ts` convention, rather than a
// guessed 0 or 100.

export interface FactoryHealth {
  queueHealth: number | null;
  blockedTaskCount: number;
  idleTimeMs: number | null;
  repairRatio: number | null;
  completionRate: number | null;
  commercialThroughput: number;
  ownerWaitingTaskCount: number;
}

export interface FactoryKpi {
  factoryEfficiency: number | null;
  queueEfficiency: number | null;
  averageTaskTimeMs: number | null;
  blockedRatio: number | null;
  repairRatio: number | null;
  commercialThroughput: number;
  ownerWaitingTimeMs: number | null;
}

function completedDurations(timeline: FactoryTimelineEntry[]): number[] {
  return timeline.filter((e) => e.event === 'FINISHED' && e.durationMs !== null).map((e) => e.durationMs as number);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Part 7. `queueHealth` is the unweighted average of `completionRate`
 * and `100 - blockedShare`, the same "average of named 0-100 components"
 * convention `portfolioHealthCalculator.ts` uses — `null` when the queue
 * is empty (unscored at its floor, not assumed healthy or at risk). */
export function computeFactoryHealth(tasks: FactoryTask[], timeline: FactoryTimelineEntry[], now: number = Date.now()): FactoryHealth {
  const nonCancelled = tasks.filter((t) => t.status !== 'CANCELLED');
  const blockedTaskCount = tasks.filter((t) => t.status === 'BLOCKED').length;
  const completedCount = tasks.filter((t) => t.status === 'COMPLETED').length;
  const repairTasks = tasks.filter((t) => t.type === 'repair');
  const completedRepair = repairTasks.filter((t) => t.status === 'COMPLETED').length;

  const repairRatio = nonCancelled.length > 0 ? (repairTasks.length / nonCancelled.length) * 100 : null;
  const completionRate = nonCancelled.length > 0 ? (completedCount / nonCancelled.length) * 100 : null;
  const blockedShare = nonCancelled.length > 0 ? (blockedTaskCount / nonCancelled.length) * 100 : null;
  const queueHealth = completionRate === null || blockedShare === null ? null : Math.round((completionRate + (100 - blockedShare)) / 2);

  const running = tasks.find((t) => t.status === 'RUNNING');
  const readyWaiting = tasks.filter((t) => t.status === 'READY');
  const idleTimeMs = !running && readyWaiting.length > 0 ? now - Math.min(...readyWaiting.map((t) => t.updatedAt)) : running ? 0 : null;

  const commercialThroughput = tasks.filter((t) => t.type === 'package' && t.status === 'COMPLETED').length;
  const ownerWaitingTaskCount = tasks.filter((t) => t.status === 'BLOCKED' || (t.status === 'READY' && t.type === 'generate')).length;

  void completedRepair;
  void timeline;
  return { queueHealth, blockedTaskCount, idleTimeMs, repairRatio, completionRate, commercialThroughput, ownerWaitingTaskCount };
}

/** Part 10. Reuses the same underlying counts as `computeFactoryHealth`
 * (never a second, possibly-drifting computation of "repair ratio" or
 * "commercial throughput") but reports them shaped for the KPI surface —
 * `factoryEfficiency`/`queueEfficiency` derived from the real Timeline's
 * completed-task durations, never a fabricated velocity number. */
export function computeFactoryKpi(tasks: FactoryTask[], timeline: FactoryTimelineEntry[], now: number = Date.now()): FactoryKpi {
  const health = computeFactoryHealth(tasks, timeline, now);
  const durations = completedDurations(timeline);
  const averageTaskTimeMs = average(durations);
  const nonCancelled = tasks.filter((t) => t.status !== 'CANCELLED');
  const blockedRatio = nonCancelled.length > 0 ? (health.blockedTaskCount / nonCancelled.length) * 100 : null;

  const finishedEvents = timeline.filter((e) => e.event === 'FINISHED');
  const successCount = finishedEvents.filter((e) => !e.note.startsWith('BLOCKED')).length;
  const factoryEfficiency = finishedEvents.length > 0 ? (successCount / finishedEvents.length) * 100 : null;
  const queueEfficiency = health.completionRate;

  const blockedTasks = tasks.filter((t) => t.status === 'BLOCKED');
  const ownerWaitingTimeMs = blockedTasks.length > 0 ? average(blockedTasks.map((t) => now - t.updatedAt)) : null;

  return {
    factoryEfficiency,
    queueEfficiency,
    averageTaskTimeMs,
    blockedRatio,
    repairRatio: health.repairRatio,
    commercialThroughput: health.commercialThroughput,
    ownerWaitingTimeMs,
  };
}
