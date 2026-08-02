import type { FactoryTask, FactoryTimelineEntry } from '../factory/domain/types';
import type { OwnerDecisionRecord } from './domain/types';
import { generateDailyBrief } from '../factoryIntelligence/dailyBrief';
import { computeFactoryHealth } from '../factory/factoryMetrics';
import { computeBusinessOutcomeScore } from '../factoryIntelligence/businessOutcomeScore';
import { runPreflightValidation } from './preflightValidation';
import { recommendProductionAction } from './productionRecommendation';
import { countOwnerDecisionsToday, isWithinDailyDecisionTarget } from './ownerDecision';
import type { PortfolioAsset } from '../catalog/domain/types';
import type { QualitySnapshot } from '../catalog/quality/qualitySnapshotStore';
import type { AutonomousDesignRun } from '../autopilot/domain/autonomousDesignRun';
import type { ProductionDailyBrief } from './domain/types';

// Mission 4, Part 10 — Daily Factory Brief, shown when the application
// opens. Composes Build 032's own `generateDailyBrief` + this module's
// Part 4 recommendation + Part 5's real Owner Decision count + Build
// 032's Business Outcome Score — no second evidence-gathering pass, no
// invented field.

function factoryStatusFrom(queueHealth: number | null): string {
  if (queueHealth === null) return 'No factory activity yet.';
  if (queueHealth >= 80) return 'Running smoothly.';
  if (queueHealth >= 50) return 'Attention needed.';
  return 'Blocked — review the Factory Queue.';
}

export function generateProductionDailyBrief(
  tasks: FactoryTask[],
  timeline: FactoryTimelineEntry[],
  ownerDecisionRecords: OwnerDecisionRecord[],
  portfolioAssets: PortfolioAsset[],
  qualitySnapshots: QualitySnapshot[],
  autonomousRuns: AutonomousDesignRun[],
  now: number = Date.now(),
): ProductionDailyBrief {
  const baseBrief = generateDailyBrief(tasks, timeline, now);
  const health = computeFactoryHealth(tasks, timeline, now);
  const outcome = computeBusinessOutcomeScore(tasks, timeline, now);
  const preflight = runPreflightValidation(tasks, portfolioAssets, qualitySnapshots, autonomousRuns, now);
  const recommendation = recommendProductionAction(tasks, preflight, now);
  const decisionsToday = countOwnerDecisionsToday(ownerDecisionRecords, now);

  return {
    todaysMission: recommendation.reason,
    factoryStatus: factoryStatusFrom(health.queueHealth),
    commercialPackagesReady: baseBrief.commercialPackagesReady,
    estimatedOwnerTimeMinutes: baseBrief.estimatedOwnerTimeSavedMinutes,
    ownerDecisionsToday: decisionsToday,
    withinDailyDecisionTarget: isWithinDailyDecisionTarget(decisionsToday),
    topRecommendation: recommendation,
    businessOutcomeScore: outcome.score,
    generatedAt: now,
  };
}
