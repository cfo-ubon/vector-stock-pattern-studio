import type { FactoryTask, FactoryTimelineEntry, FactoryTaskType } from '../factory/domain/types';
import { computeAverageQueueTimeMs } from './metricsEngine';
import type { BottleneckReport, FactoryStage } from './domain/types';

// Mission 2, Part 2 — Bottleneck Analyzer. Never invents a cause: the
// reported stage is always backed by a real, counted fact (the most
// BLOCKED tasks of any stage, or — if nothing is blocked — the stage
// with the highest real average completion time). If neither signal has
// any data yet, `stage` is `null`, not a guess.

const HIGH_IMPACT_STAGES: ReadonlySet<FactoryTaskType> = new Set(['repair', 'qa', 'seo', 'package', 'exportValidation']);

/** Static, disclosed recommendation text per stage — operational advice
 * grounded in what that stage's real executor/dependency behavior is
 * (`taskExecutors.ts`/`dependencyEngine.ts`), never a fabricated
 * business fact. */
const RECOMMENDATIONS: Record<FactoryStage, string> = {
  generate: 'Review generation parameters — repeated regeneration usually means a Style DNA or parameter issue, not an unlucky seed.',
  qa: 'Review recent REVIEW/REJECT reasons — a high QA-blocked count suggests a systemic quality issue rather than isolated failures.',
  repair: 'Investigate why repairs are not resolving on the first attempt — this usually means the underlying generation parameters need adjustment, not another repair pass.',
  seo: 'Check for missing generation-parameter sidecars — SEO tasks block when the original generation parameters cannot be recovered for an asset.',
  package: 'Review the specific blockedReason on stuck package tasks — commercial package builds fail per (asset, marketplace) target for named reasons.',
  exportValidation: 'Review the safety threshold configuration and each asset\'s readiness score — most export blocks trace back to a readiness score below the configured minimum.',
  collectionCompletion: 'Assign missing role tags (hero/secondary/blender/coordinate/stripe/texture/colorway) to existing collection members instead of generating new assets.',
  portfolioUpdate: 'Portfolio Update rarely blocks — check the specific blockedReason on the affected task(s).',
  queue: 'Tasks are waiting longer than usual to start — check whether the Scheduler is paused, or whether dependency chains are longer than necessary.',
};

function businessImpactFor(stage: FactoryStage): 'HIGH' | 'MEDIUM' {
  return HIGH_IMPACT_STAGES.has(stage as FactoryTaskType) ? 'HIGH' : 'MEDIUM';
}

const QUEUE_WAIT_BOTTLENECK_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes — a disclosed default, not a measured baseline.

export function analyzeBottleneck(tasks: FactoryTask[], timeline: FactoryTimelineEntry[], now: number = Date.now()): BottleneckReport {
  const base = { computedAt: now };

  const blockedByType = new Map<FactoryTaskType, FactoryTask[]>();
  for (const task of tasks) {
    if (task.status !== 'BLOCKED') continue;
    const list = blockedByType.get(task.type) ?? [];
    list.push(task);
    blockedByType.set(task.type, list);
  }
  const rankedBlocked = [...blockedByType.entries()].sort((a, b) => b[1].length - a[1].length);
  if (rankedBlocked.length > 0 && rankedBlocked[0][1].length > 0) {
    const [stage, blockedTasks] = rankedBlocked[0];
    const sampleReasons = [...new Set(blockedTasks.map((t) => t.blockedReason).filter((r): r is string => !!r))].slice(0, 3);
    return {
      ...base,
      stage,
      reason: `${blockedTasks.length} ${stage} task(s) are currently BLOCKED — more than any other stage.`,
      evidence: [`${blockedTasks.length} BLOCKED ${stage} task(s)`, ...sampleReasons],
      businessImpact: businessImpactFor(stage),
      recommendedImprovement: RECOMMENDATIONS[stage],
      sourceTaskIds: blockedTasks.map((t) => t.id),
    };
  }

  const finishedDurationsByType = new Map<FactoryTaskType, { taskId: string; durationMs: number }[]>();
  for (const entry of timeline) {
    if (entry.event !== 'FINISHED' || entry.durationMs === null) continue;
    const list = finishedDurationsByType.get(entry.taskType) ?? [];
    list.push({ taskId: entry.taskId, durationMs: entry.durationMs });
    finishedDurationsByType.set(entry.taskType, list);
  }
  const rankedDurations = [...finishedDurationsByType.entries()]
    .map(([stage, entries]) => ({ stage, avgMs: entries.reduce((s, e) => s + e.durationMs, 0) / entries.length, taskIds: entries.map((e) => e.taskId) }))
    .sort((a, b) => b.avgMs - a.avgMs);
  if (rankedDurations.length > 0) {
    const top = rankedDurations[0];
    return {
      ...base,
      stage: top.stage,
      reason: `${top.stage} has the highest average completion time among all stages: ${Math.round(top.avgMs / 1000)}s.`,
      evidence: [`Average ${top.stage} completion time: ${Math.round(top.avgMs / 1000)}s across ${finishedDurationsByType.get(top.stage)!.length} finished task(s)`],
      businessImpact: businessImpactFor(top.stage),
      recommendedImprovement: RECOMMENDATIONS[top.stage],
      sourceTaskIds: top.taskIds,
    };
  }

  const avgQueueMs = computeAverageQueueTimeMs(tasks);
  if (avgQueueMs !== null && avgQueueMs > QUEUE_WAIT_BOTTLENECK_THRESHOLD_MS) {
    const startedTaskIds = tasks.filter((t) => t.startedAt !== null).map((t) => t.id);
    return {
      ...base,
      stage: 'queue',
      reason: `Average queue wait time (${Math.round(avgQueueMs / 60000)} min) exceeds the ${QUEUE_WAIT_BOTTLENECK_THRESHOLD_MS / 60000}-minute threshold.`,
      evidence: [`Average queue wait: ${Math.round(avgQueueMs / 60000)} minute(s) across ${startedTaskIds.length} started task(s)`],
      businessImpact: 'MEDIUM',
      recommendedImprovement: RECOMMENDATIONS.queue,
      sourceTaskIds: startedTaskIds,
    };
  }

  return { ...base, stage: null, reason: null, evidence: [], businessImpact: null, recommendedImprovement: null, sourceTaskIds: [] };
}
