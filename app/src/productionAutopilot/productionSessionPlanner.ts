import type { FactoryTask, FactoryTimelineEntry } from '../factory/domain/types';
import type { FactoryReview } from '../factoryIntelligence/domain/types';
import type { BusinessImpact } from '../decisionOS/domain/types';
import { computeFactoryIntelligenceMetrics } from '../factoryIntelligence/metricsEngine';
import { computeBusinessOutcomeScore } from '../factoryIntelligence/businessOutcomeScore';
import type { PreflightValidationResult } from './domain/types';
import type { ProductionSessionPlan } from './domain/types';

// Mission 4, Part 1 — Production Session Planner. Every field is either
// a real derived number from Factory Intelligence (Build 032) / Decision
// OS (Build 031B) or an honest `null` — `targetPackages` counts real,
// already-existing work close to completion (READY package/export
// tasks), never a fabricated goal. `decisionTrace`/`policyIds`/
// `evidenceIds`/`confidence`/`businessImpact` are lifted directly from
// Part 3's real Preflight Decision OS evaluation — the plan is never a
// second, independent decision.

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function planProductionSession(tasks: FactoryTask[], timeline: FactoryTimelineEntry[], recentReviews: FactoryReview[], preflight: PreflightValidationResult, now: number = Date.now()): ProductionSessionPlan {
  const metrics = computeFactoryIntelligenceMetrics(tasks, timeline, now);
  const outcome = computeBusinessOutcomeScore(tasks, timeline, now);

  const readyPackageTasks = tasks.filter((t) => t.type === 'package' && t.status === 'READY');
  const readyExportTasks = tasks.filter((t) => t.type === 'exportValidation' && t.status === 'READY');
  const targetAssetIds = new Set([...readyPackageTasks, ...readyExportTasks].map((t) => t.assetId).filter((id): id is string => id !== null));
  const targetPackages = targetAssetIds.size;

  const productionGoal =
    targetPackages > 0
      ? `Finish ${targetPackages} Commercial Package(s) already in progress.`
      : preflight.shouldGenerate
        ? 'Generate new production-ready patterns — no existing work is currently close to completion.'
        : 'No packages are close to completion and Decision OS does not currently recommend generating — review the Preflight checks.';

  return {
    productionGoal,
    targetPackages,
    estimatedDurationMs: metrics.averageBatchTimeMs,
    expectedReadyPackages: average(recentReviews.map((r) => r.commercialReady)),
    expectedReview: average(recentReviews.map((r) => r.review)),
    expectedRepair: average(recentReviews.map((r) => r.repairCount)),
    expectedFactoryEfficiency: metrics.factoryEfficiency,
    businessOutcomeScore: outcome.score,
    decisionTrace: preflight.decisionTrace,
    policyIds: preflight.decisionTrace.policyIds,
    evidenceIds: preflight.decisionTrace.evidenceIds,
    confidence: preflight.decisionTrace.confidenceBand,
    // `DecisionTrace.businessImpact` is typed as a bare `string` in
    // `aiCeo/domain/types.ts` even though `decisionTraceFrom` always
    // copies it straight from a real `Decision.businessImpact`
    // (`decisionOS/domain/types.ts`'s own `BusinessImpact` union) — this
    // asserts the already-real value's actual type, it does not invent one.
    businessImpact: preflight.decisionTrace.businessImpact as BusinessImpact,
  };
}
