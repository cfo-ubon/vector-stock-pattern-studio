import type { MarketOpportunity } from '../marketing/domain/marketOpportunity';
import type { DailyMission } from '../marketing/domain/dailyMission';
import type { SeasonalEvent } from '../marketing/domain/seasonalEvent';
import type { PortfolioAsset } from '../catalog/domain/types';
import type { OfflineSnapshotResult } from '../marketing/snapshot/snapshotService';
import type { AutonomousDesignRun } from '../autopilot/domain/autonomousDesignRun';
import type { DashboardSnapshot } from '../catalog/dashboard/dashboardSnapshot';
import type { Recommendation as DashboardRecommendation } from '../catalog/dashboard/recommendationEngine';
import { selectEvidence, leastCoveredCategory, type DecisionEngineInput, type EvidenceSelection } from '../autopilot/decisionEngine';
import { emptyAutopilotConstraints, type AutopilotConstraints } from '../autopilot/domain/constraints';
import { aiCeoRecommendationId } from './domain/id';
import type { AiCeoRecommendation, AiCeoActionType, AiCeoDataStatus, AiMemory, DecisionTrace } from './domain/types';
import { runDecisionSync, recordDecision } from '../decisionOS/index';
import { marketplaceFallbackContext, MARKETPLACE_FALLBACK_SOURCES } from '../decisionOS/adapters/marketplaceAdapter';
import { decisionTraceFrom } from './decisionTrace';

// Build 030 Part 2, Module 2 — AI CEO Decision Engine. Combines only
// already-real, already-computed outputs (Build 029's `selectEvidence`/
// `leastCoveredCategory`, Build 017's Dashboard Snapshot recommendations,
// Build 029's own `AutonomousDesignRun` records) into one ranked list —
// no new scoring system, no revenue estimate, no fabricated confidence.
// Every recommendation traces back to a real function call this file
// itself does not reimplement.

/** Confirmed-memory reads this module is allowed (Module 8: only
 * CONFIRMED memory may influence a recommendation, and every influence
 * must be disclosed via `memoryInfluence`). */
function memoryValuesOfType(memories: AiMemory[], type: AiMemory['type']): string[] {
  return memories.filter((m) => m.type === type).map((m) => m.value);
}

function constraintsFromMemory(memories: AiMemory[]): AutopilotConstraints {
  const base = emptyAutopilotConstraints();
  const preferredMarketplace = memoryValuesOfType(memories, 'PREFERRED_MARKETPLACE')[0] ?? null;
  const avoidedCategories = memoryValuesOfType(memories, 'AVOIDED_CATEGORY');
  const avoidedHeroMotifs = memoryValuesOfType(memories, 'AVOIDED_HERO_MOTIF');
  const preferredDensityRaw = memoryValuesOfType(memories, 'PREFERRED_DENSITY')[0] ?? null;
  const preferredDensity = preferredDensityRaw === 'low' || preferredDensityRaw === 'medium' || preferredDensityRaw === 'high' ? preferredDensityRaw : null;
  return { ...base, preferredMarketplace, excludeCategoryIds: avoidedCategories, excludedHeroMotifs: avoidedHeroMotifs, preferredDensity };
}

function freshnessLabelFor(status: AiCeoDataStatus, offline: OfflineSnapshotResult): string {
  switch (status) {
    case 'LIVE_DATA':
      return 'Live within this session';
    case 'SAVED_SNAPSHOT':
      return offline.snapshot ? `Based on saved snapshot (${offline.freshnessLabel})` : 'Based on saved snapshot';
    case 'LOCAL_PORTFOLIO_ANALYSIS':
      return 'Based on local portfolio only';
    case 'OFFLINE_RECOMMENDATION':
      return 'Offline recommendation — no live market data available';
    case 'INSUFFICIENT_DATA':
      return 'Insufficient data';
  }
}

export interface AiCeoDecisionInput {
  opportunities: MarketOpportunity[];
  missions: DailyMission[];
  seasonalEvents: SeasonalEvent[];
  portfolioAssets: PortfolioAsset[];
  autonomousRuns: AutonomousDesignRun[];
  dashboard: DashboardSnapshot;
  offline: OfflineSnapshotResult;
  confirmedMemories: AiMemory[];
  requestedCount: number;
  now: number;
}

function buildContinueRunRecommendation(run: AutonomousDesignRun, now: number): AiCeoRecommendation {
  const completed = run.items.filter((i) => i.completedAt !== null).length;
  return {
    id: aiCeoRecommendationId.generate(now),
    action: 'CONTINUE_INTERRUPTED_RUN',
    title: 'Continue your interrupted run',
    reason: `You have an interrupted run with ${completed} of ${run.requestedCount} pattern(s) completed.`,
    evidenceRefs: [`autonomousDesignRun:${run.id}`],
    confidence: 'high',
    risks: [],
    alternativeAction: null,
    alternativeTitle: null,
    alternativeReason: null,
    dataFreshness: 'LOCAL_PORTFOLIO_ANALYSIS',
    freshnessLabel: 'Based on local portfolio only',
    expectedImpact: 'Preserves already-completed work rather than restarting the run from zero.',
    autopilotAction: null,
    navigateTarget: 'autopilotHistory',
    memoryInfluence: [],
    decisionTrace: null,
  };
}

function countReadyNotImported(runs: AutonomousDesignRun[]): number {
  let n = 0;
  for (const run of runs) {
    for (const item of run.items) {
      if (item.decision === 'READY' && item.portfolioAssetId === null) n++;
    }
  }
  return n;
}

function buildMoveReadyRecommendation(count: number, now: number): AiCeoRecommendation {
  return {
    id: aiCeoRecommendationId.generate(now),
    action: 'MOVE_READY_TO_PORTFOLIO',
    title: 'Move Ready items into Portfolio',
    reason: `${count} generated pattern(s) passed quality review as READY but have not been added to your Portfolio yet.`,
    evidenceRefs: [],
    confidence: 'high',
    risks: [],
    alternativeAction: null,
    alternativeTitle: null,
    alternativeReason: null,
    dataFreshness: 'LOCAL_PORTFOLIO_ANALYSIS',
    freshnessLabel: 'Based on local portfolio only',
    expectedImpact: 'Makes already-finished work visible in your Portfolio and eligible for submission prep.',
    autopilotAction: null,
    navigateTarget: 'autopilotHistory',
    memoryInfluence: [],
    decisionTrace: null,
  };
}

const DASHBOARD_CODE_MAP: Partial<Record<DashboardRecommendation['code'], { action: AiCeoActionType; title: string; expectedImpact: string }>> = {
  'review-rejected': { action: 'REVIEW_REJECTED_ITEMS', title: 'Review rejected items', expectedImpact: 'Recovers value from patterns that already failed once — fixing and resubmitting is usually faster than starting new work.' },
  'complete-metadata': { action: 'COMPLETE_SEO', title: 'Complete SEO metadata', expectedImpact: 'Improves discoverability of already-created listings.' },
  'improve-seo': { action: 'COMPLETE_SEO', title: 'Improve SEO metadata', expectedImpact: 'Improves discoverability of already-created listings.' },
  'move-ready-to-submission': { action: 'PREPARE_FOR_SUBMISSION', title: 'Prepare Ready items for submission', expectedImpact: 'Moves already-finished work toward marketplace listing.' },
  'fill-empty-collections': { action: 'DIVERSIFY_PORTFOLIO', title: 'Fill empty collections', expectedImpact: 'Completes collections that currently have no patterns assigned.' },
};

function mapDashboardRecommendation(dr: DashboardRecommendation, now: number): AiCeoRecommendation | null {
  const mapping = DASHBOARD_CODE_MAP[dr.code];
  if (!mapping) return null;
  return {
    id: aiCeoRecommendationId.generate(now),
    action: mapping.action,
    title: mapping.title,
    reason: dr.message,
    evidenceRefs: [`portfolioHealth:${dr.code}`],
    confidence: 'high',
    risks: [],
    alternativeAction: null,
    alternativeTitle: null,
    alternativeReason: null,
    dataFreshness: 'LOCAL_PORTFOLIO_ANALYSIS',
    freshnessLabel: 'Based on local portfolio only',
    expectedImpact: mapping.expectedImpact,
    autopilotAction: null,
    navigateTarget: 'portfolio',
    memoryInfluence: [],
    decisionTrace: null,
  };
}

function marketDrivenRecommendation(evidence: EvidenceSelection, decisionInput: DecisionEngineInput, memoryInfluence: string[], now: number, decisionTrace: DecisionTrace | null): AiCeoRecommendation {
  const freshness: AiCeoDataStatus = !evidence.offline ? 'LIVE_DATA' : decisionInput.offline.classification === 'SAVED_SNAPSHOT' ? 'SAVED_SNAPSHOT' : 'OFFLINE_RECOMMENDATION';
  const lowConfidence = evidence.confidence === 'low' || evidence.confidence === 'very-low' || evidence.confidence === 'unknown';
  return {
    id: aiCeoRecommendationId.generate(now),
    action: 'CREATE_NEW_COLLECTION',
    title: `Create a collection: ${evidence.theme}`,
    reason: evidence.note,
    evidenceRefs: evidence.evidenceRefs,
    confidence: evidence.confidence,
    risks: lowConfidence ? [`Evidence confidence is "${evidence.confidence}".`] : [],
    alternativeAction: 'DIVERSIFY_PORTFOLIO',
    alternativeTitle: 'Fill your largest Portfolio gap instead',
    alternativeReason: 'Uses only your existing Portfolio data — a safer choice if this market evidence turns out to be stale.',
    dataFreshness: freshness,
    freshnessLabel: freshnessLabelFor(freshness, decisionInput.offline),
    expectedImpact: `Targets ${evidence.marketplace} using real market evidence rather than a guess.`,
    autopilotAction: { mode: 'FULL_AUTOPILOT', requestedCount: decisionInput.requestedCount, marketplace: decisionInput.marketplacePreference, productionGoal: 'auto' },
    navigateTarget: null,
    memoryInfluence,
    decisionTrace,
  };
}

function portfolioGapRecommendation(categoryId: string, count: number, decisionInput: DecisionEngineInput, memoryInfluence: string[], now: number, decisionTrace: DecisionTrace | null): AiCeoRecommendation {
  return {
    id: aiCeoRecommendationId.generate(now),
    action: 'DIVERSIFY_PORTFOLIO',
    title: `Fill your Portfolio gap: ${categoryId}`,
    reason: `"${categoryId}" has only ${count} existing Portfolio asset(s) — the fewest of any supported category.`,
    evidenceRefs: [],
    confidence: 'unknown',
    risks: [],
    alternativeAction: 'USE_EVERGREEN_FALLBACK',
    alternativeTitle: 'Use an evergreen commercial default instead',
    alternativeReason: 'A steady, non-seasonal category, if you would rather not target the gap category right now.',
    dataFreshness: 'LOCAL_PORTFOLIO_ANALYSIS',
    freshnessLabel: 'Based on local portfolio only',
    expectedImpact: 'Improves category coverage — reduces reliance on any single category.',
    autopilotAction: { mode: 'PORTFOLIO_GAP', requestedCount: decisionInput.requestedCount, marketplace: decisionInput.marketplacePreference, productionGoal: 'portfolioExpansion' },
    navigateTarget: null,
    memoryInfluence,
    decisionTrace,
  };
}

function evergreenFallbackRecommendation(decisionInput: DecisionEngineInput, hasAnyLocalData: boolean, memoryInfluence: string[], now: number, decisionTrace: DecisionTrace | null): AiCeoRecommendation {
  const freshness: AiCeoDataStatus = hasAnyLocalData ? 'OFFLINE_RECOMMENDATION' : 'INSUFFICIENT_DATA';
  return {
    id: aiCeoRecommendationId.generate(now),
    action: 'USE_EVERGREEN_FALLBACK',
    title: 'Use an evergreen commercial default',
    reason: hasAnyLocalData
      ? 'No verified Market Opportunity and no meaningful Portfolio gap were found — using a category with steady, non-seasonal demand.'
      : 'No Market Snapshot and no Portfolio data exist yet — this is a sample starting point, not a verified recommendation.',
    evidenceRefs: [],
    confidence: 'unknown',
    risks: hasAnyLocalData ? [] : ['No real evidence exists yet — this is a safe starting point, not a market-verified pick.'],
    alternativeAction: null,
    alternativeTitle: null,
    alternativeReason: null,
    dataFreshness: freshness,
    freshnessLabel: freshnessLabelFor(freshness, decisionInput.offline),
    expectedImpact: hasAnyLocalData ? 'Keeps production moving on a low-risk, non-seasonal category.' : 'Unknown — no evidence exists yet to estimate impact.',
    autopilotAction: { mode: 'EVERGREEN_COMMERCIAL', requestedCount: decisionInput.requestedCount, marketplace: decisionInput.marketplacePreference, productionGoal: 'auto' },
    navigateTarget: null,
    memoryInfluence,
    decisionTrace,
  };
}

/** Module 2's ranked list — always at least one recommendation (the final
 * evidence/portfolio-gap/evergreen pick never fails to produce something),
 * with urgent "finish what's already started" items ranked ahead of new
 * production work. */
export function rankAiCeoRecommendations(input: AiCeoDecisionInput): AiCeoRecommendation[] {
  const recommendations: AiCeoRecommendation[] = [];
  const memoryConstraints = constraintsFromMemory(input.confirmedMemories);
  const preferredMarketplaceMemory = memoryValuesOfType(input.confirmedMemories, 'PREFERRED_MARKETPLACE')[0] ?? null;
  const memoryInfluence = preferredMarketplaceMemory ? [`Based on your confirmed preference: target marketplace "${preferredMarketplaceMemory}".`] : [];

  const resumable = input.autonomousRuns.filter((r) => r.status === 'GENERATING' || r.status === 'PAUSED');
  if (resumable.length > 0) recommendations.push(buildContinueRunRecommendation(resumable[0], input.now));

  const readyNotImported = countReadyNotImported(input.autonomousRuns);
  if (readyNotImported > 0) recommendations.push(buildMoveReadyRecommendation(readyNotImported, input.now));

  for (const dr of input.dashboard.recommendations) {
    const mapped = mapDashboardRecommendation(dr, input.now);
    if (mapped) recommendations.push(mapped);
  }

  const decisionInput: DecisionEngineInput = {
    mode: 'FULL_AUTOPILOT',
    requestedCount: input.requestedCount,
    colorwayCount: 3,
    marketplacePreference: memoryConstraints.preferredMarketplace,
    productionGoal: 'auto',
    constraints: memoryConstraints,
    opportunities: input.opportunities,
    missions: input.missions,
    seasonalEvents: input.seasonalEvents,
    portfolioAssets: input.portfolioAssets,
    offline: input.offline,
    now: input.now,
  };
  const evidence = selectEvidence(decisionInput);
  const hasLiveEvidence = evidence.source === 'marketOpportunity' || evidence.source === 'dailyMission' || evidence.source === 'seasonalCalendar' || evidence.source === 'customGoal';
  const { categoryId: gapCategory, count: gapCount } = leastCoveredCategory(input.portfolioAssets, memoryConstraints);

  // Build 031B, Part 10 — this 3-way choice (live evidence / Portfolio
  // gap / evergreen fallback) is no longer decided by this if/else chain
  // itself; it is delegated to the Decision OS's `MARKETPLACE_POLICIES`
  // (`decisionOS/policies/marketplacePolicies.ts`), the one shared place
  // that priority order is now defined and testable. The recommendation-
  // building functions below are unchanged — only which one gets called
  // is now Decision-Engine-routed, so the produced `AiCeoRecommendation`
  // shape and UX stay identical.
  const marketplaceDecision = runDecisionSync(marketplaceFallbackContext(evidence, hasLiveEvidence, input.portfolioAssets.length, input.now), MARKETPLACE_FALLBACK_SOURCES);
  // Build 031B Hardening (Section 7) — every visible recommendation must be
  // traceable to the Decision that produced it. `rankAiCeoRecommendations`
  // stays synchronous (its own docstring promises purity), so the Decision
  // Timeline write is fire-and-forget rather than awaited.
  void recordDecision(marketplaceDecision).catch(() => {});
  const marketplaceTrace = decisionTraceFrom(marketplaceDecision);
  if (marketplaceDecision.recommendedAction === 'targetPortfolioGap') {
    recommendations.push(portfolioGapRecommendation(gapCategory, gapCount, decisionInput, memoryInfluence, input.now, marketplaceTrace));
  } else if (marketplaceDecision.recommendedAction === 'targetEvergreen') {
    recommendations.push(evergreenFallbackRecommendation(decisionInput, input.offline.classification === 'SAVED_SNAPSHOT', memoryInfluence, input.now, marketplaceTrace));
  } else {
    recommendations.push(marketDrivenRecommendation(evidence, decisionInput, memoryInfluence, input.now, marketplaceTrace));
  }

  return recommendations;
}

export function topAiCeoRecommendation(recommendations: AiCeoRecommendation[]): AiCeoRecommendation {
  return recommendations[0];
}
