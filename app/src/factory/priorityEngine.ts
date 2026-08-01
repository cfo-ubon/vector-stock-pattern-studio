import { runDecisionSync, recordDecision } from '../decisionOS';
import { decisionTraceFrom } from '../aiCeo/decisionTrace';
import type { DecisionTrace } from '../aiCeo/domain/types';
import {
  factoryPriorityRepairContext,
  factoryPriorityPackagingContext,
  factoryPriorityExportValidationContext,
  factoryPriorityCollectionCompletionContext,
  FACTORY_PRIORITY_REPAIR_SOURCES,
  FACTORY_PRIORITY_PACKAGING_SOURCES,
  FACTORY_PRIORITY_EXPORT_VALIDATION_SOURCES,
  FACTORY_PRIORITY_COLLECTION_COMPLETION_SOURCES,
} from '../decisionOS/adapters/factoryPriorityAdapter';
import type { FactoryTask, FactoryTaskType } from './domain/types';

// Build 031C, Part 3 — Dynamic Priority. Decision OS decides whether each
// of the 4 named signals (high REVIEW rate, large READY backlog, export
// blocked, collection near complete) currently applies; this module only
// translates a `true` signal into a lower `priority` number (runs sooner)
// on the matching task type, always stamping the real Decision ID that
// caused it — the Scheduler never reorders on its own judgment.

const PRIORITY_BOOST_AMOUNT = 50;

export interface FactoryPriorityInputs {
  reviewCount: number;
  rejectCount: number;
  totalEvaluated: number;
  readyBacklogCount: number;
  exportBlockedCount: number;
  collectionsNearCompletion: { collectionId: string; missingRoles: string[] }[];
}

export interface FactoryPriorityBoost {
  taskType: FactoryTaskType;
  decisionId: string;
  decisionTrace: DecisionTrace;
  reason: string;
}

export function evaluateFactoryPriorityBoosts(inputs: FactoryPriorityInputs, now: number = Date.now()): FactoryPriorityBoost[] {
  const boosts: FactoryPriorityBoost[] = [];

  const repairDecision = runDecisionSync(factoryPriorityRepairContext(inputs.reviewCount, inputs.rejectCount, inputs.totalEvaluated, now), FACTORY_PRIORITY_REPAIR_SOURCES);
  void recordDecision(repairDecision).catch(() => {});
  if (repairDecision.recommendedAction === 'boostRepairPriority') {
    boosts.push({ taskType: 'repair', decisionId: repairDecision.id, decisionTrace: decisionTraceFrom(repairDecision), reason: repairDecision.explanation[0] ?? 'High REVIEW/REJECT rate.' });
  }

  const packagingDecision = runDecisionSync(factoryPriorityPackagingContext(inputs.readyBacklogCount, now), FACTORY_PRIORITY_PACKAGING_SOURCES);
  void recordDecision(packagingDecision).catch(() => {});
  if (packagingDecision.recommendedAction === 'boostPackagingPriority') {
    boosts.push({ taskType: 'package', decisionId: packagingDecision.id, decisionTrace: decisionTraceFrom(packagingDecision), reason: packagingDecision.explanation[0] ?? 'Large READY backlog.' });
  }

  const exportDecision = runDecisionSync(factoryPriorityExportValidationContext(inputs.exportBlockedCount, now), FACTORY_PRIORITY_EXPORT_VALIDATION_SOURCES);
  void recordDecision(exportDecision).catch(() => {});
  if (exportDecision.recommendedAction === 'boostExportValidationPriority') {
    boosts.push({ taskType: 'exportValidation', decisionId: exportDecision.id, decisionTrace: decisionTraceFrom(exportDecision), reason: exportDecision.explanation[0] ?? 'A package is export-blocked.' });
  }

  for (const collection of inputs.collectionsNearCompletion) {
    const decision = runDecisionSync(factoryPriorityCollectionCompletionContext(collection.collectionId, collection.missingRoles, now), FACTORY_PRIORITY_COLLECTION_COMPLETION_SOURCES);
    void recordDecision(decision).catch(() => {});
    if (decision.recommendedAction === 'boostCollectionCompletionPriority') {
      boosts.push({ taskType: 'collectionCompletion', decisionId: decision.id, decisionTrace: decisionTraceFrom(decision), reason: decision.explanation[0] ?? 'Collection is nearly complete.' });
    }
  }

  return boosts;
}

/** Pure. Applies boosts to matching non-terminal, non-RUNNING tasks —
 * never reorders a task already executing. A task keeps its boosted
 * priority reversible: `basePriority` is untouched, so a future
 * replan with no boosts (Part 8) can be computed from `basePriority`
 * again rather than accumulating drift. */
export function applyPriorityBoosts(tasks: FactoryTask[], boosts: FactoryPriorityBoost[], now: number = Date.now()): FactoryTask[] {
  if (boosts.length === 0) return tasks;
  const boostByType = new Map<FactoryTaskType, FactoryPriorityBoost>();
  for (const b of boosts) if (!boostByType.has(b.taskType)) boostByType.set(b.taskType, b);

  return tasks.map((task) => {
    if (task.status === 'RUNNING' || task.status === 'COMPLETED' || task.status === 'CANCELLED') return task;
    const boost = boostByType.get(task.type);
    if (!boost) {
      if (task.priority === task.basePriority) return task;
      return { ...task, priority: task.basePriority, updatedAt: now };
    }
    const nextPriority = Math.max(0, task.basePriority - PRIORITY_BOOST_AMOUNT);
    if (task.priority === nextPriority && task.sourceDecisionId === boost.decisionId) return task;
    return {
      ...task,
      priority: nextPriority,
      sourceDecisionId: boost.decisionId,
      decisionTrace: boost.decisionTrace,
      updatedAt: now,
      history: [...task.history, { status: task.status, at: now, note: `Reprioritized: ${boost.reason}` }],
    };
  });
}
