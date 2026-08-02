import type { FactoryTask, FactoryTimelineEntry } from '../factory/domain/types';
import { computeFactoryIntelligenceMetrics } from '../factoryIntelligence/metricsEngine';
import type { FactoryIntelligenceMetrics } from '../factoryIntelligence/domain/types';
import type { FactoryExperiment, OptimizationScenario } from './domain/types';
import { FACTORY_EXPERIMENT_SCHEMA_VERSION } from './domain/types';

// Mission 3, Part 6 — Factory Experiments. A real, bounded, one-batch
// trial: `startFactoryExperiment` snapshots real live metrics as the
// "Before" baseline; `concludeFactoryExperiment` only accepts a snapshot
// once the target batch is fully terminal (the same gate
// `factoryReview.ts` uses) and compares Before vs After using the same
// disclosed 2% dead-zone `factoryIntelligence/trendEngine.ts` already
// uses, so Success/Neutral/Failed is never a fabricated verdict. Nothing
// here ever changes what the Scheduler runs or what Decision OS
// recommends — an experiment is a read-only measurement wrapped around
// real production data, not a second execution path.

const STABLE_DEADZONE_PERCENT = 2; // matches factoryIntelligence/trendEngine.ts's own disclosed dead-zone policy

function pad(n: number, len: number): string {
  return String(n).padStart(len, '0');
}
function dateStamp(now: number): string {
  const d = new Date(now);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1, 2)}${pad(d.getUTCDate(), 2)}`;
}
function randomSuffix(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
export function generateFactoryExperimentId(now: number = Date.now()): string {
  return `FEXP-${dateStamp(now)}-${randomSuffix()}`;
}

const SCENARIO_DESCRIPTIONS: Record<OptimizationScenario, string> = {
  REPAIR_FIRST: 'Move Repair before Generation for this batch',
  QUEUE_IMPROVEMENT: 'Prioritize reducing queue wait time for this batch',
  PACKAGING_EARLIER: "Move Packaging earlier in this batch's pipeline",
  COLLECTION_COMPLETION_FIRST: "Prioritize Collection Completion before other work in this batch",
};

const SCENARIO_PRIMARY_METRIC: Record<OptimizationScenario, { key: keyof FactoryIntelligenceMetrics; higherIsBetter: boolean }> = {
  REPAIR_FIRST: { key: 'repairRatio', higherIsBetter: false },
  QUEUE_IMPROVEMENT: { key: 'averageQueueTimeMs', higherIsBetter: false },
  PACKAGING_EARLIER: { key: 'averagePackagingTimeMs', higherIsBetter: false },
  COLLECTION_COMPLETION_FIRST: { key: 'commercialReadyRatio', higherIsBetter: true },
};

export function startFactoryExperiment(scenario: OptimizationScenario, targetBatchId: string, tasks: FactoryTask[], timeline: FactoryTimelineEntry[], now: number = Date.now()): FactoryExperiment {
  return {
    id: generateFactoryExperimentId(now),
    scenario,
    description: SCENARIO_DESCRIPTIONS[scenario],
    targetBatchId,
    beforeMetrics: computeFactoryIntelligenceMetrics(tasks, timeline, now),
    afterMetrics: null,
    status: 'RUNNING',
    result: null,
    resultExplanation: [],
    startedAt: now,
    concludedAt: null,
    schemaVersion: FACTORY_EXPERIMENT_SCHEMA_VERSION,
  };
}

/** Returns `null` (not yet concludable) unless every task in the target
 * batch has reached a terminal state — an in-progress batch has nothing
 * real to compare yet. */
export function concludeFactoryExperiment(experiment: FactoryExperiment, allTasks: FactoryTask[], allTimeline: FactoryTimelineEntry[], now: number = Date.now()): FactoryExperiment | null {
  const batchTasks = allTasks.filter((t) => t.batchId === experiment.targetBatchId);
  if (batchTasks.length === 0) return null;
  const allTerminal = batchTasks.every((t) => t.status === 'COMPLETED' || t.status === 'CANCELLED');
  if (!allTerminal) return null;

  const afterMetrics = computeFactoryIntelligenceMetrics(allTasks, allTimeline, now);
  const { key, higherIsBetter } = SCENARIO_PRIMARY_METRIC[experiment.scenario];
  const before = experiment.beforeMetrics[key];
  const after = afterMetrics[key];

  let result: FactoryExperiment['result'];
  let resultExplanation: string[];
  if (before === null || after === null) {
    result = 'UNKNOWN';
    resultExplanation = [`Not enough data to compare ${String(key)} before and after — before=${before ?? 'null'}, after=${after ?? 'null'}.`];
  } else {
    const base = Math.max(Math.abs(before), 1);
    const percentChange = ((after - before) / base) * 100;
    if (Math.abs(percentChange) <= STABLE_DEADZONE_PERCENT) {
      result = 'NEUTRAL';
      resultExplanation = [`${String(key)} changed by ${percentChange.toFixed(1)}% — within the ${STABLE_DEADZONE_PERCENT}% stable dead-zone.`];
    } else {
      const improved = higherIsBetter ? after > before : after < before;
      result = improved ? 'SUCCESS' : 'FAILED';
      resultExplanation = [`${String(key)} went from ${before} to ${after} (${percentChange.toFixed(1)}%), which is ${improved ? 'an improvement' : 'a decline'} for this metric.`];
    }
  }

  return { ...experiment, afterMetrics, status: 'CONCLUDED', result, resultExplanation, concludedAt: now };
}
