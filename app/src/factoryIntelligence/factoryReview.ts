import type { FactoryTask, FactoryTimelineEntry } from '../factory/domain/types';
import { MANUAL_MINUTES_PER_PACKAGE_BASELINE } from '../commercial/businessMetrics';
import { computeFactoryIntelligenceMetrics, computeBatchDurations, computeAverageQueueTimeMs } from './metricsEngine';
import { analyzeBottleneck } from './bottleneckAnalyzer';
import type { FactoryReview } from './domain/types';
import { FACTORY_REVIEW_SCHEMA_VERSION } from './domain/types';

// Mission 2, Part 4 — Factory Review. Built strictly from the real tasks
// and Timeline entries that share one `batchId` — never from the whole
// factory's history — and only once every task in that batch has reached
// a terminal state (COMPLETED/CANCELLED). An in-progress batch has
// nothing to review yet, so `createFactoryReview` returns `null` rather
// than an estimate.

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
export function generateFactoryReviewId(now: number = Date.now()): string {
  return `FREV-${dateStamp(now)}-${randomSuffix()}`;
}

export function createFactoryReview(batchId: string, allTasks: FactoryTask[], allTimeline: FactoryTimelineEntry[], now: number = Date.now()): FactoryReview | null {
  const batchTasks = allTasks.filter((t) => t.batchId === batchId);
  if (batchTasks.length === 0) return null;

  const allTerminal = batchTasks.every((t) => t.status === 'COMPLETED' || t.status === 'CANCELLED');
  if (!allTerminal) return null;

  const batchTaskIds = new Set(batchTasks.map((t) => t.id));
  const batchTimeline = allTimeline.filter((e) => batchTaskIds.has(e.taskId));

  const packagesProduced = batchTasks.filter((t) => t.type === 'package' && t.status === 'COMPLETED').length;
  const commercialReady = batchTasks.filter((t) => t.type === 'exportValidation' && t.status === 'COMPLETED').length;

  const qaFinished = batchTimeline.filter((e) => e.event === 'FINISHED' && e.taskType === 'qa');
  const review = qaFinished.filter((e) => e.note.endsWith(': REVIEW.')).length;
  const rejected = qaFinished.filter((e) => e.note.endsWith(': REJECT.')).length;

  const repairCount = batchTasks.filter((t) => t.type === 'repair').length;

  const batchDuration = computeBatchDurations(batchTasks).find((b) => b.batchId === batchId);
  const queueDelaysMs = computeAverageQueueTimeMs(batchTasks);
  const metrics = computeFactoryIntelligenceMetrics(batchTasks, batchTimeline, now);
  const bottleneck = analyzeBottleneck(batchTasks, batchTimeline, now);

  return {
    id: generateFactoryReviewId(now),
    batchId,
    packagesProduced,
    commercialReady,
    review,
    rejected,
    averageCompletionTimeMs: batchDuration?.durationMs ?? null,
    repairCount,
    queueDelaysMs,
    factoryEfficiency: metrics.factoryEfficiency,
    ownerTimeSavedMinutes: packagesProduced * MANUAL_MINUTES_PER_PACKAGE_BASELINE,
    topBottleneckStage: bottleneck.stage,
    topRecommendation: bottleneck.recommendedImprovement,
    createdAt: now,
    schemaVersion: FACTORY_REVIEW_SCHEMA_VERSION,
  };
}
