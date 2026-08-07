import type { FactoryTask, FactoryTimelineEntry } from '../factory/domain/types';
import { createFactoryReview } from '../factoryIntelligence/factoryReview';
import { computeBusinessOutcomeScore } from '../factoryIntelligence/businessOutcomeScore';
import { identifyImprovementCandidatesForCompletedBatch } from '../factoryImprovement/improvementEngine';
import { runPreflightValidation } from './preflightValidation';
import { recommendProductionAction } from './productionRecommendation';
import type { PortfolioAsset } from '../catalog/domain/types';
import type { QualitySnapshot } from '../catalog/quality/qualitySnapshotStore';
import type { AutonomousDesignRun } from '../autopilot/domain/autonomousDesignRun';
import type { ProductionCompletionReview } from './domain/types';

// Mission 4, Part 7 — Production Completion Review. Entirely composed
// from already-real engines: Build 032's `createFactoryReview` +
// `computeBusinessOutcomeScore`, Build 033's
// `identifyImprovementCandidatesForCompletedBatch`, and this module's
// own Part 4 recommendation applied to the live post-batch queue — no
// field is computed a second, duplicate way. Returns `null` for a batch
// that is not yet fully terminal (same gate `createFactoryReview` uses),
// never an estimate for an in-progress batch.

export function reviewProductionCompletion(
  batchId: string,
  allTasks: FactoryTask[],
  allTimeline: FactoryTimelineEntry[],
  portfolioAssets: PortfolioAsset[],
  qualitySnapshots: QualitySnapshot[],
  autonomousRuns: AutonomousDesignRun[],
  now: number = Date.now(),
): ProductionCompletionReview | null {
  const review = createFactoryReview(batchId, allTasks, allTimeline, now);
  if (!review) return null;

  const outcome = computeBusinessOutcomeScore(allTasks, allTimeline, now);
  const improvementCandidates = identifyImprovementCandidatesForCompletedBatch(batchId, allTasks, allTimeline, [], now) ?? [];

  const preflight = runPreflightValidation(allTasks, portfolioAssets, qualitySnapshots, autonomousRuns, now);
  const nextRecommendation = recommendProductionAction(allTasks, preflight, now);

  return {
    batchId,
    packagesProduced: review.packagesProduced,
    commercialReady: review.commercialReady,
    review: review.review,
    repair: review.repairCount,
    rejected: review.rejected,
    businessOutcomeScore: outcome.score,
    factoryEfficiency: review.factoryEfficiency,
    ownerTimeSavedMinutes: review.ownerTimeSavedMinutes,
    improvementTasksCreated: improvementCandidates.length,
    nextRecommendation,
    createdAt: now,
  };
}
