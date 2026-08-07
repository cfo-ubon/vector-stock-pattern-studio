import type { MarketOpportunity } from '../marketing/domain/marketOpportunity';
import type { DailyMission } from '../marketing/domain/dailyMission';
import type { SeasonalEvent } from '../marketing/domain/seasonalEvent';
import type { PortfolioAsset } from '../catalog/domain/types';
import type { OfflineSnapshotResult } from '../marketing/snapshot/snapshotService';
import type { QualitySnapshot } from '../catalog/quality/qualitySnapshotStore';
import type { AutonomousDesignRun } from '../autopilot/domain/autonomousDesignRun';
import { selectEvidence, leastCoveredCategory, type DecisionEngineInput } from '../autopilot/decisionEngine';
import { emptyAutopilotConstraints } from '../autopilot/domain/constraints';

// Build 030 ("Top Hero Card") — "today's best opportunity", built entirely
// from real, already-computed data: the exact evidence
// `TODAYS_MISSION`/`FULL_AUTOPILOT` would select (`selectEvidence`, Build
// 029), the exact portfolio-coverage count `PORTFOLIO_GAP` mode reads
// (`leastCoveredCategory`, exported above for this reuse), a real average
// of past `QualitySnapshot.beautyScore` for that same category when the
// Portfolio has any (never a fabricated number), and a real average
// generation-time-per-pattern computed from completed `AutonomousDesignRun`
// history. Every field below is either a real number pulled from existing
// storage, or an honest `null` shown as "not yet available" rather than a
// guess.

export type OpportunityStars = 1 | 2 | 3 | 4 | 5;

export interface HeroOpportunity {
  theme: string;
  marketplace: string;
  stars: OpportunityStars;
  /** The real opportunity/mission score (0-100) — `null` only for the
   * offline evergreen/portfolio-gap fallbacks, which carry no numeric
   * market score by design (Build 029's own "confidence: unknown"
   * convention). */
  estimatedCommercialScore: number | null;
  /** Average `QualitySnapshot.beautyScore` across the Portfolio's existing
   * patterns in this same category, rounded to the nearest whole number —
   * `null` (never a fabricated number) when the Portfolio has no
   * evaluated pattern in this category yet. */
  estimatedBeautyScore: number | null;
  portfolioGap: 'HIGH' | 'MEDIUM' | 'LOW';
  portfolioGapCount: number;
  /** Minutes, derived from the average real duration-per-item across
   * completed Autopilot runs (`AutonomousDesignRun.history`'s
   * GENERATING -> COMPLETED span, divided by `completedCount`) — `null`
   * when there is no completed run yet to measure from. */
  estimatedProductionMinutes: number | null;
  requestedCount: number;
  reasons: string[];
}

function starsFromScore(score: number | null): OpportunityStars {
  if (score === null) return 3;
  if (score >= 85) return 5;
  if (score >= 70) return 4;
  if (score >= 50) return 3;
  if (score >= 30) return 2;
  return 1;
}

function gapBandFromCount(count: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (count <= 0) return 'HIGH';
  if (count <= 3) return 'MEDIUM';
  return 'LOW';
}

/** Real average beauty score for the Portfolio's existing patterns whose
 * `presetId` matches `categoryId` — `null` when none have been evaluated
 * yet, never a fabricated placeholder number. */
export function estimateBeautyScoreForCategory(categoryId: string, assets: PortfolioAsset[], snapshots: QualitySnapshot[]): number | null {
  const assetIds = new Set(assets.filter((a) => a.presetId === categoryId).map((a) => a.assetId));
  if (assetIds.size === 0) return null;
  const matching = snapshots.filter((s) => assetIds.has(s.assetId));
  if (matching.length === 0) return null;
  const total = matching.reduce((sum, s) => sum + s.beautyScore, 0);
  return Math.round(total / matching.length);
}

/** Real average minutes-per-pattern across every COMPLETED Autopilot run,
 * derived from that run's own GENERATING -> COMPLETED history span (never
 * a hardcoded guess) — `null` when no run has completed yet. */
export function estimateAverageMinutesPerPattern(runs: AutonomousDesignRun[]): number | null {
  const perItemMinutes: number[] = [];
  for (const run of runs) {
    if (run.status !== 'COMPLETED' || run.completedCount <= 0) continue;
    const started = run.history.find((h) => h.status === 'GENERATING')?.at;
    const completed = [...run.history].reverse().find((h) => h.status === 'COMPLETED')?.at;
    if (started === undefined || completed === undefined || completed <= started) continue;
    perItemMinutes.push((completed - started) / run.completedCount / 60000);
  }
  if (perItemMinutes.length === 0) return null;
  return perItemMinutes.reduce((a, b) => a + b, 0) / perItemMinutes.length;
}

export interface HeroOpportunityInput {
  opportunities: MarketOpportunity[];
  missions: DailyMission[];
  seasonalEvents: SeasonalEvent[];
  portfolioAssets: PortfolioAsset[];
  qualitySnapshots: QualitySnapshot[];
  autonomousRuns: AutonomousDesignRun[];
  offline: OfflineSnapshotResult;
  requestedCount: number;
  now: number;
}

/** Pure — builds today's Hero Card content from real evidence + real
 * historical measurements only. Uses `TODAYS_MISSION` evidence selection
 * (the same "best currently-scored real opportunity, honest evergreen
 * fallback when none exists" logic `AutopilotView`'s own Today's Mission
 * quick action already relies on). */
export function buildHeroOpportunity(input: HeroOpportunityInput): HeroOpportunity {
  const decisionInput: DecisionEngineInput = {
    mode: 'TODAYS_MISSION',
    requestedCount: input.requestedCount,
    colorwayCount: 1,
    marketplacePreference: null,
    productionGoal: 'auto',
    constraints: emptyAutopilotConstraints(),
    opportunities: input.opportunities,
    missions: input.missions,
    seasonalEvents: input.seasonalEvents,
    portfolioAssets: input.portfolioAssets,
    offline: input.offline,
    now: input.now,
  };
  const evidence = selectEvidence(decisionInput);
  const score = evidence.mission?.opportunityScore ?? evidence.opportunity?.score.overall ?? null;
  const { categoryId, count } = leastCoveredCategory(input.portfolioAssets, emptyAutopilotConstraints());
  const beautyScore = estimateBeautyScoreForCategory(categoryId, input.portfolioAssets, input.qualitySnapshots);
  const avgMinutesPerPattern = estimateAverageMinutesPerPattern(input.autonomousRuns);

  const reasons: string[] = [evidence.note];
  if (count <= 3) reasons.push(`Portfolio coverage gap: "${categoryId}" has only ${count} existing pattern(s).`);
  if (evidence.confidence !== 'unknown') reasons.push(`Evidence confidence: ${evidence.confidence}.`);

  return {
    theme: evidence.theme,
    marketplace: evidence.marketplace,
    stars: starsFromScore(score),
    estimatedCommercialScore: score,
    estimatedBeautyScore: beautyScore,
    portfolioGap: gapBandFromCount(count),
    portfolioGapCount: count,
    estimatedProductionMinutes: avgMinutesPerPattern === null ? null : Math.round(avgMinutesPerPattern * input.requestedCount),
    requestedCount: input.requestedCount,
    reasons,
  };
}
