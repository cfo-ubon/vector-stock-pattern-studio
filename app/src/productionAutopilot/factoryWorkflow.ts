import type { FactoryTask, FactoryTimelineEntry } from '../factory/domain/types';
import type { FactoryReview } from '../factoryIntelligence/domain/types';
import type { PortfolioAsset } from '../catalog/domain/types';
import type { QualitySnapshot } from '../catalog/quality/qualitySnapshotStore';
import type { AutonomousDesignRun } from '../autopilot/domain/autonomousDesignRun';
import { explainBlockedTasks } from '../factory/dependencyEngine';
import { identifyImprovementCandidates } from '../factoryImprovement/improvementEngine';
import { runPreflightValidation } from './preflightValidation';
import { reviewProductionQueue } from './productionQueueReview';
import { planProductionSession } from './productionSessionPlanner';
import { recommendProductionAction } from './productionRecommendation';
import type { FactoryWorkflowResult } from './domain/types';

// Mission 4, Part 2 — Start Factory Workflow. The ONE production
// workflow: Decision Review -> Queue Validation -> Dependency
// Validation -> Improvement Validation -> Production Plan -> (Owner
// Approval, outside this function) -> Execution (outside this function,
// driven by the Factory Controller's own Scheduler once approved). No
// duplicated workflow: every stage below calls exactly one existing
// engine, never a second parallel implementation. `requiresOwnerApproval`
// is always `true` — this function only ever plans, it never executes
// or auto-approves (Part 11's export gate depends on this).

export function startFactoryWorkflow(
  tasks: FactoryTask[],
  timeline: FactoryTimelineEntry[],
  recentReviews: FactoryReview[],
  portfolioAssets: PortfolioAsset[],
  qualitySnapshots: QualitySnapshot[],
  autonomousRuns: AutonomousDesignRun[],
  now: number = Date.now(),
): FactoryWorkflowResult {
  // Stage 1 — Decision Review (Part 3's real Decision OS gate).
  const decisionReview = runPreflightValidation(tasks, portfolioAssets, qualitySnapshots, autonomousRuns, now);

  // Stage 2 — Queue Validation (Part 6's real Bottleneck/Optimization reuse).
  const queueValidation = reviewProductionQueue(tasks, timeline, now);

  // Stage 3 — Dependency Validation (real dependency graph, Build 031C's `dependencyEngine.ts`).
  const dependencyIssues = explainBlockedTasks(tasks).map((b) => b.reason);

  // Stage 4 — Improvement Validation (Build 033's real Improvement Engine — surfaces real candidates, invents none).
  const improvementCandidates = identifyImprovementCandidates(tasks, timeline, [], now);
  const improvementNotices = improvementCandidates.map((c) => `${c.title}: ${c.reason}`);

  // Stage 5 — Production Plan (Part 1).
  const productionPlan = planProductionSession(tasks, timeline, recentReviews, decisionReview, now);

  // Recommendation (Part 4) — informs what Owner Approval will actually be approving.
  const recommendation = recommendProductionAction(tasks, decisionReview, now);

  return {
    decisionReview,
    queueValidation,
    dependencyIssues,
    improvementNotices,
    productionPlan,
    recommendation,
    requiresOwnerApproval: true,
    computedAt: now,
  };
}
