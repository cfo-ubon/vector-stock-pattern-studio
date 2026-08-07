import type { FactoryTask } from '../factory/domain/types';
import { findOpportunities } from '../factoryIntelligence/opportunityFinder';
import type { PreflightValidationResult } from './domain/types';
import type { ProductionRecommendation, ProductionActionType } from './domain/types';

// Mission 4, Part 4 — Production Recommendation. Priority order mirrors
// the real policy sequence Decision OS already encodes
// (`decisionOS/policies/factoryPolicies.ts`'s `repairBeforeGenerate` /
// `seoBeforePackaging` / `packagingBeforeExport` / `completeExistingWorkFirst`)
// — not a new invented ordering. `GENERATE` is reachable only as the
// final fallback, and only when Part 3's real Decision OS gate
// (`shouldGenerate`) actually allows it — this file never recommends
// generation on its own authority.

const OPPORTUNITY_TO_ACTION: Record<string, ProductionActionType> = {
  REPAIR_READY_ITEMS: 'REPAIR',
  FINISH_SEO: 'SEO',
  PACKAGE_EXISTING_WORK: 'PACKAGE',
  EXPORT_READY_PACKAGES: 'EXPORT',
  COMPLETE_COLLECTION: 'FINISH_COLLECTION',
}; // deliberately ordered to match this codebase's own repair -> SEO -> package -> export -> collection priority

const ACTION_PRIORITY: ProductionActionType[] = ['REPAIR', 'SEO', 'PACKAGE', 'EXPORT', 'FINISH_COLLECTION'];

function findUnfinishedBatchId(tasks: FactoryTask[]): string | null {
  const byBatch = new Map<string, FactoryTask[]>();
  for (const task of tasks) {
    if (!task.batchId) continue;
    const list = byBatch.get(task.batchId) ?? [];
    list.push(task);
    byBatch.set(task.batchId, list);
  }
  for (const [batchId, batchTasks] of byBatch) {
    const hasActive = batchTasks.some((t) => t.status === 'RUNNING' || t.status === 'READY' || t.status === 'BLOCKED' || t.status === 'WAITING');
    if (hasActive) return batchId;
  }
  return null;
}

export function recommendProductionAction(tasks: FactoryTask[], preflight: PreflightValidationResult, _now: number = Date.now()): ProductionRecommendation {
  const unfinishedBatchId = findUnfinishedBatchId(tasks);
  if (unfinishedBatchId) {
    const batchTasks = tasks.filter((t) => t.batchId === unfinishedBatchId);
    return {
      action: 'CONTINUE_PREVIOUS_BATCH',
      reason: `Batch ${unfinishedBatchId} has ${batchTasks.length} task(s) still in progress.`,
      evidence: [`${batchTasks.length} task(s) in batch ${unfinishedBatchId} are not yet terminal`],
      sourceTaskIds: batchTasks.map((t) => t.id),
      decisionTrace: null,
    };
  }

  const opportunities = findOpportunities(tasks);
  const byAction = new Map(opportunities.map((o) => [OPPORTUNITY_TO_ACTION[o.type], o]));
  for (const action of ACTION_PRIORITY) {
    const opp = byAction.get(action);
    if (!opp) continue;
    return { action, reason: opp.reason, evidence: [`${opp.count} task(s) ready: ${opp.taskIds.slice(0, 5).join(', ')}`], sourceTaskIds: opp.taskIds, decisionTrace: null };
  }

  if (preflight.shouldGenerate) {
    return {
      action: 'GENERATE',
      reason: 'No unfinished work exists and Decision OS raised no objection to generating new patterns.',
      evidence: ['Decision OS generation gate: recommendGenerate=true'],
      sourceTaskIds: [],
      decisionTrace: preflight.decisionTrace,
    };
  }

  return {
    action: 'CONTINUE_PREVIOUS_BATCH',
    reason: preflight.generateBlockedReason ?? 'No READY work exists and Decision OS does not currently recommend generating.',
    evidence: [],
    sourceTaskIds: [],
    decisionTrace: preflight.decisionTrace,
  };
}
