import type { FactoryTask, FactoryTimelineEntry } from '../factory/domain/types';
import { explainBlockedTasks } from '../factory/dependencyEngine';
import { createFactoryReview } from '../factoryIntelligence/factoryReview';
import type { DecisionTrace } from '../aiCeo/domain/types';
import type { CommercialReadinessGateResult } from './domain/types';

// Mission 5, Part 10 — Commercial Readiness Gate. Refuses commercial
// completion unless all three real authorities agree — this composes
// three already-real checks, never a fourth scoring model:
//   - Factory Controller agrees: no task in this batch is BLOCKED
//     (`explainBlockedTasks`, Build 031C).
//   - Factory Intelligence agrees: `createFactoryReview` (Build 032)
//     returns a real, non-null review — which itself already requires
//     every task in the batch to have reached a terminal state.
//   - Decision OS agrees: the run's own real `DecisionTrace` (produced by
//     Production Autopilot's Preflight, Build 031B's `evaluateGenerationGate`
//     chain) raised no blocked reasons.
// If evidence for any authority is missing, that authority's agreement
// is honestly `false` with a real reason — never assumed `true`.

export function checkCommercialReadinessGate(batchId: string | null, tasks: FactoryTask[], timeline: FactoryTimelineEntry[], decisionTrace: DecisionTrace | null, now: number = Date.now()): CommercialReadinessGateResult {
  const reasons: string[] = [];

  if (!batchId) {
    reasons.push('No batch is attached to this run yet — nothing to complete.');
    return { allAgree: false, decisionOSAgrees: false, factoryControllerAgrees: false, factoryIntelligenceAgrees: false, reasons, computedAt: now };
  }

  const blockedInBatch = explainBlockedTasks(tasks).filter((b) => tasks.find((t) => t.id === b.taskId)?.batchId === batchId);
  const factoryControllerAgrees = blockedInBatch.length === 0;
  if (!factoryControllerAgrees) {
    reasons.push(`Factory Controller: ${blockedInBatch.length} task(s) in this batch are still BLOCKED.`);
  }

  const review = createFactoryReview(batchId, tasks, timeline, now);
  const factoryIntelligenceAgrees = review !== null;
  if (!factoryIntelligenceAgrees) {
    reasons.push('Factory Intelligence: this batch is not yet fully terminal — no real review exists.');
  }

  const decisionOSAgrees = decisionTrace !== null && decisionTrace.blockedReasons.length === 0;
  if (!decisionOSAgrees) {
    reasons.push(decisionTrace === null ? 'Decision OS: no real decision trace exists for this run.' : `Decision OS: ${decisionTrace.blockedReasons.join('; ')}`);
  }

  const allAgree = factoryControllerAgrees && factoryIntelligenceAgrees && decisionOSAgrees;
  return { allAgree, decisionOSAgrees, factoryControllerAgrees, factoryIntelligenceAgrees, reasons, computedAt: now };
}
