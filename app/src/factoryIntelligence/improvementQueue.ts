import type { BottleneckReport, RootCauseAnalysis, ImprovementTask, ImprovementCategory, FactoryStage } from './domain/types';
import { IMPROVEMENT_TASK_SCHEMA_VERSION } from './domain/types';

// Mission 2, Part 9 — Continuous Improvement Queue. Recommendation-only:
// nothing in Decision OS, the Scheduler, or any policy ever reads these
// tasks, so generating/dismissing/completing one can never change
// automated behavior. Every task is generated deterministically from
// Part 2's Bottleneck Analyzer and Part 3's Root Cause chains — never a
// standalone invented suggestion.

const STAGE_TO_CATEGORY: Partial<Record<FactoryStage, ImprovementCategory>> = {
  repair: 'REDUCE_REPAIR_TIME',
  qa: 'IMPROVE_QA',
  package: 'IMPROVE_PACKAGING',
  exportValidation: 'IMPROVE_PACKAGING',
  queue: 'REDUCE_QUEUE_DELAY',
  collectionCompletion: 'IMPROVE_COLLECTION_COMPLETION',
};

const KPI_TO_CATEGORY: Record<string, ImprovementCategory> = {
  repairRatio: 'REDUCE_REPAIR_TIME',
  blockedTaskRatio: 'REDUCE_QUEUE_DELAY',
  commercialThroughput: 'IMPROVE_PACKAGING',
};

const CATEGORY_TITLES: Record<ImprovementCategory, string> = {
  REDUCE_REPAIR_TIME: 'Reduce Repair Time',
  IMPROVE_QA: 'Improve QA',
  IMPROVE_PACKAGING: 'Improve Packaging',
  REDUCE_QUEUE_DELAY: 'Reduce Queue Delay',
  IMPROVE_COLLECTION_COMPLETION: 'Improve Collection Completion',
};

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
export function generateImprovementTaskId(now: number = Date.now()): string {
  return `FIMP-${dateStamp(now)}-${randomSuffix()}`;
}

function makeTask(category: ImprovementCategory, reason: string, evidence: string[], now: number): ImprovementTask {
  return {
    id: generateImprovementTaskId(now),
    category,
    title: CATEGORY_TITLES[category],
    reason,
    evidence,
    status: 'OPEN',
    createdAt: now,
    updatedAt: now,
    schemaVersion: IMPROVEMENT_TASK_SCHEMA_VERSION,
  };
}

/** Deterministic — same bottleneck + root causes always produce the same
 * (deduplicated-by-category) set of recommendations. Callers are
 * responsible for not re-inserting a task whose category already has an
 * OPEN entry in the persisted queue (Part 9's own store handles that). */
export function generateImprovementTasks(bottleneck: BottleneckReport, rootCauses: RootCauseAnalysis[], now: number = Date.now()): ImprovementTask[] {
  const seen = new Set<ImprovementCategory>();
  const tasks: ImprovementTask[] = [];

  if (bottleneck.stage !== null) {
    const category = STAGE_TO_CATEGORY[bottleneck.stage];
    if (category && !seen.has(category)) {
      seen.add(category);
      tasks.push(makeTask(category, bottleneck.reason ?? '', bottleneck.evidence, now));
    }
  }

  for (const analysis of rootCauses) {
    const category = KPI_TO_CATEGORY[analysis.kpi];
    if (!category || seen.has(category)) continue;
    seen.add(category);
    tasks.push(makeTask(category, analysis.chain[0]?.evidence ?? analysis.kpi, analysis.chain.map((s) => s.evidence), now));
  }

  return tasks;
}
