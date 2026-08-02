import { loadFactoryTasks } from '../factory/storage/factoryQueueStore';
import { loadFactoryTimeline } from '../factory/storage/factoryTimelineStore';
import { loadFactoryReviews } from '../factoryIntelligence/storage/factoryReviewStore';
import { loadPortfolioAssets } from '../catalog/storage/portfolioStore';
import { loadQualitySnapshots } from '../catalog/quality/qualitySnapshotStore';
import { loadAutonomousDesignRuns } from '../autopilot/storage/autonomousDesignRunStore';
import { loadOwnerDecisionRecords } from '../productionAutopilot/storage/ownerDecisionStore';
import { putProductionSession } from '../productionAutopilot/storage/productionSessionStore';
import { loadImprovementBacklog } from '../factoryImprovement/storage/improvementBacklogStore';
import { startFactoryWorkflow } from '../productionAutopilot/factoryWorkflow';
import { createProductionSession } from '../productionAutopilot/productionSession';
import { createOrchestrationRun, transitionOrchestrationRun } from './orchestrationRun';
import { prepareFactoryRun, validateFactoryRun, planFactoryRun } from './productionLifecycle';
import { buildFactoryExecutionContext } from './executionContext';
import { putOrchestrationRun } from './storage/orchestrationRunStore';
import type { StartFactoryResult } from './domain/types';

// Mission 5, Part 1 — Unified Factory Workflow. `StartFactory()` is the
// ONLY production entry point: every step below is traceable via the
// returned `OrchestrationRun.history` (Part 2) and the real
// `DecisionTrace`/`policyIds`/`evidenceIds` carried on the resulting
// `ProductionSession.plan`.
//
//   StartFactory()
//     v
//   Decision OS         -> reused via `startFactoryWorkflow`'s Preflight
//                           stage (`runPreflightValidation` -> the real
//                           `evaluateGenerationGate`, Build 031B)
//     v
//   Factory Controller   -> reused via `startFactoryWorkflow`'s Queue/
//                           Dependency stages (`reviewProductionQueue`,
//                           `explainBlockedTasks`, Build 031C)
//     v
//   Factory Intelligence  -> reused via `startFactoryWorkflow`'s Queue
//                           Validation (`analyzeBottleneck`,
//                           `computeFactoryIntelligenceMetrics`, Mission 2)
//     v
//   Continuous Improvement -> reused via `startFactoryWorkflow`'s
//                           Improvement Validation (`identifyImprovementCandidates`,
//                           Mission 3)
//     v
//   Production Autopilot  -> `startFactoryWorkflow` itself (Mission 4) —
//                           builds the real `ProductionSessionPlan` and
//                           `ProductionRecommendation`
//     v
//   Production Session     -> `createProductionSession` (Mission 4,
//                           unchanged) wraps the plan; this orchestrator
//                           only creates it, never re-plans it
//     v
//   Commercial Package Ready -> gated later by `completeFactoryRun` +
//                           the real Commercial Readiness Gate (Part 10),
//                           never assumed here
//
// No step above is reimplemented — every arrow is a real function call
// into an already-existing module.

export async function StartFactory(now: number = Date.now()): Promise<StartFactoryResult> {
  const [tasks, timeline, recentReviews, portfolioAssets, qualitySnapshots, autonomousRuns, ownerDecisionRecords, improvementBacklog] = await Promise.all([
    loadFactoryTasks(),
    loadFactoryTimeline(),
    loadFactoryReviews(),
    loadPortfolioAssets(),
    loadQualitySnapshots(),
    loadAutonomousDesignRuns(),
    loadOwnerDecisionRecords(),
    loadImprovementBacklog(),
  ]);

  let run = createOrchestrationRun(now);
  const prepared = prepareFactoryRun(run, now);
  run = prepared.ok ? prepared.value : run;

  const workflow = startFactoryWorkflow(tasks, timeline, recentReviews, portfolioAssets, qualitySnapshots, autonomousRuns, now);

  const validated = validateFactoryRun(run, workflow.decisionReview, now);
  run = validated.ok ? validated.value : transitionOrchestrationRun(run, 'FAILED', now, validated.error.message);

  if (run.status === 'BLOCKED' || run.status === 'FAILED') {
    await putOrchestrationRun(run);
    const context = buildFactoryExecutionContext(run.id, tasks, timeline, ownerDecisionRecords, improvementBacklog, null, now);
    return { run, context, plan: null, decisionTrace: workflow.decisionReview.decisionTrace, requiresOwnerApproval: true, computedAt: now };
  }

  const session = createProductionSession(workflow.productionPlan, now);
  const planned = planFactoryRun(run, session.id, now);
  run = planned.ok ? planned.value : run;

  await Promise.all([putOrchestrationRun(run), putProductionSession(session)]);

  const context = buildFactoryExecutionContext(run.id, tasks, timeline, ownerDecisionRecords, improvementBacklog, session, now);

  return { run, context, plan: workflow.productionPlan, decisionTrace: workflow.decisionReview.decisionTrace, requiresOwnerApproval: true, computedAt: now };
}
