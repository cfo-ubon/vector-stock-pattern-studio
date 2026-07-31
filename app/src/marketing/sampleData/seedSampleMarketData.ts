import { createResearchSource } from '../domain/researchSource';
import { createMarketObservation } from '../domain/marketObservation';
import { createMarketSnapshot, type MarketSnapshot } from '../domain/marketSnapshot';
import { createMarketKeyword } from '../domain/marketKeyword';
import { createMarketOpportunity, type MarketOpportunity } from '../domain/marketOpportunity';
import { computeOpportunityScore, type OpportunityScoreInputs } from '../scoring/opportunityScoring';
import { generateDailyMission } from '../mission/dailyMissionGenerator';

import { putResearchSource } from '../storage/researchSourceStore';
import { putMarketObservation, loadMarketObservations } from '../storage/marketObservationStore';
import { putMarketSnapshot, loadMarketSnapshots } from '../storage/marketSnapshotStore';
import { putMarketKeyword, loadMarketKeywords } from '../storage/marketKeywordStore';
import { putMarketOpportunity, loadMarketOpportunities } from '../storage/marketOpportunityStore';
import { putDailyMission, loadDailyMissions } from '../storage/dailyMissionStore';
import { ensureDefaultScoringProfile } from '../storage/scoringProfileStore';

// Build 028 Phase 4 — this module is the ONLY place in the app that writes
// evidenceStatus/evidenceSource: 'SAMPLE_DATA'. It exists purely so a
// first-time user of the Marketing Intelligence Center sees real,
// persisted, IndexedDB-backed records instead of an empty screen — every
// record it writes is functionally identical to a real user-entered
// record and flows through the exact same scoring/mission/gap-finder
// code paths, but is honestly labeled SAMPLE_DATA end to end so the UI
// can render a visible badge and never let a reader mistake it for real
// research (see the brief's non-negotiable rule #4 and UX rule about the
// SAMPLE DATA badge). Calling this is always an explicit user action
// (a button in the empty state), never automatic.

export interface SeedSampleMarketDataResult {
  snapshot: MarketSnapshot;
  opportunities: MarketOpportunity[];
  alreadySeeded: boolean;
}

/** Idempotent-ish: if a snapshot already exists, does nothing and returns
 * the existing state rather than piling up duplicate sample data on every
 * click of "Load Sample Data". */
export async function seedSampleMarketData(now: number = Date.now()): Promise<SeedSampleMarketDataResult> {
  const existingSnapshots = await loadMarketSnapshots();
  if (existingSnapshots.length > 0) {
    const opportunities = await loadMarketOpportunities();
    return { snapshot: existingSnapshots[0], opportunities, alreadySeeded: true };
  }

  const profile = await ensureDefaultScoringProfile(now);

  const source = createResearchSource({
    sourceType: 'pinterest',
    sourceTitle: 'Sample: Spring cottage-garden floral board scan',
    searchTerm: 'spring cottage garden floral pattern',
    marketplace: 'adobestock',
    region: 'global',
    language: 'en',
    tags: ['sample'],
    now,
  });
  await putResearchSource(source);

  const observations = [
    createMarketObservation({
      sourceType: 'pinterest',
      evidenceStatus: 'SAMPLE_DATA',
      researchSourceId: source.id,
      marketplace: 'adobestock',
      sourceTitle: source.sourceTitle,
      searchTerm: source.searchTerm,
      observationDate: now,
      trendDirection: 'rising',
      demandSignal: 'high',
      competitionSignal: 'medium',
      buyerIntent: 'ready-to-buy',
      seasonality: 'spring',
      notes: 'Sample observation: cottage-garden florals trending upward on mood boards ahead of spring gifting season.',
      confidence: 'medium',
      tags: ['sample', 'botanical', 'spring'],
      now,
    }),
    createMarketObservation({
      sourceType: 'etsy',
      evidenceStatus: 'SAMPLE_DATA',
      marketplace: 'etsy',
      sourceTitle: 'Sample: Etsy shop search results — minimal botanical stationery',
      searchTerm: 'minimal botanical stationery',
      observationDate: now,
      trendDirection: 'stable',
      demandSignal: 'medium',
      competitionSignal: 'low',
      buyerIntent: 'considering',
      seasonality: 'year-round',
      notes: 'Sample observation: minimal botanical stationery listings have few active shops relative to browse volume.',
      confidence: 'low',
      tags: ['sample', 'minimal', 'stationery'],
      now,
    }),
  ];
  for (const obs of observations) await putMarketObservation(obs);

  const snapshot = createMarketSnapshot({
    researchDateRange: { from: now - 7 * 24 * 60 * 60 * 1000, to: now },
    evidenceRefs: observations.map((o) => o.id),
    marketplaces: ['adobestock', 'etsy'],
    regions: ['global'],
    keywords: ['spring cottage garden', 'minimal botanical stationery'],
    themes: ['Spring Cottage Garden'],
    niches: ['Botanical'],
    motifs: ['Tulip bouquet with ribbon', 'Daisy sprig', 'Olive branch'],
    styles: ['editorial', 'minimal'],
    colors: ['sage green', 'butter yellow', 'dusty rose'],
    seasons: ['spring'],
    productUseCases: ['gift wrap', 'fabric', 'stationery', 'digital paper'],
    observedCompetition: 'medium',
    observedDemand: 'high',
    recommendations: ['Prioritize a Spring Cottage Garden collection for Adobe Stock + Etsy ahead of the spring gifting window.'],
    confidence: 'medium',
    now,
  });
  await putMarketSnapshot(snapshot);

  const keywords = [
    createMarketKeyword({
      keyword: 'spring cottage garden floral',
      cluster: 'subject',
      evidenceSource: 'SAMPLE_DATA',
      parentTheme: 'Spring Cottage Garden',
      marketplace: 'adobestock',
      buyerIntent: 'ready-to-buy',
      trendDirection: 'rising',
      competitionEstimate: 'medium',
      opportunityEstimate: 'high',
      seasonalRelevance: 'spring',
      productRelevance: ['gift wrap', 'fabric'],
      portfolioCoverage: 0,
      duplicateRisk: 'low',
      confidence: 'medium',
      now,
    }),
    createMarketKeyword({
      keyword: 'minimal botanical stationery',
      cluster: 'product-use',
      evidenceSource: 'SAMPLE_DATA',
      parentTheme: 'Minimal Botanical',
      marketplace: 'etsy',
      buyerIntent: 'considering',
      trendDirection: 'stable',
      competitionEstimate: 'low',
      opportunityEstimate: 'high',
      seasonalRelevance: 'year-round',
      productRelevance: ['stationery', 'digital paper'],
      portfolioCoverage: 0,
      duplicateRisk: 'low',
      confidence: 'low',
      now,
    }),
    createMarketKeyword({
      keyword: 'sage green palette',
      cluster: 'color',
      evidenceSource: 'AI_INFERENCE',
      parentTheme: 'Spring Cottage Garden',
      buyerIntent: 'browsing',
      trendDirection: 'rising',
      competitionEstimate: 'medium',
      opportunityEstimate: 'medium',
      seasonalRelevance: 'spring',
      portfolioCoverage: 3,
      duplicateRisk: 'low',
      confidence: 'unknown',
      now,
    }),
  ];
  for (const keyword of keywords) await putMarketKeyword(keyword);

  const opportunityInputsA: OpportunityScoreInputs = {
    demandSignal: { value: 85, evidenceSource: 'SAMPLE_DATA', confidence: 'medium' },
    trendMomentum: { value: 78, evidenceSource: 'SAMPLE_DATA', confidence: 'medium' },
    competitionAdvantage: { value: 60, evidenceSource: 'SAMPLE_DATA', confidence: 'low' },
    seasonalTiming: { value: 90, evidenceSource: 'SAMPLE_DATA', confidence: 'high' },
    marketplaceFit: { value: 82, evidenceSource: 'SAMPLE_DATA', confidence: 'medium' },
    portfolioGap: { value: 95, evidenceSource: 'LOCAL_PORTFOLIO_DATA', confidence: 'high' },
    buyerIntent: { value: 88, evidenceSource: 'SAMPLE_DATA', confidence: 'medium' },
    productVersatility: { value: 80, evidenceSource: 'SAMPLE_DATA', confidence: 'medium' },
    // productionFeasibility / historicalSalesEvidence / rejectionRisk / evidenceQuality / dataFreshness
    // intentionally left without values — this app has no real production-effort estimator or sales
    // history yet for a brand-new theme, so those dimensions are honestly reported as missing rather
    // than guessed.
  };
  const scoreA = computeOpportunityScore(opportunityInputsA, profile);
  const opportunityA = createMarketOpportunity({
    snapshotId: snapshot.id,
    title: 'Spring Cottage Garden — Adobe Stock',
    theme: 'Spring Cottage Garden',
    niche: 'Botanical',
    marketplace: 'adobestock',
    score: scoreA,
    evidenceRefs: [observations[0].id, keywords[0].id],
    now,
  });

  const opportunityInputsB: OpportunityScoreInputs = {
    demandSignal: { value: 55, evidenceSource: 'SAMPLE_DATA', confidence: 'low' },
    competitionAdvantage: { value: 75, evidenceSource: 'SAMPLE_DATA', confidence: 'low' },
    portfolioGap: { value: 90, evidenceSource: 'LOCAL_PORTFOLIO_DATA', confidence: 'high' },
    marketplaceFit: { value: 65, evidenceSource: 'SAMPLE_DATA', confidence: 'low' },
  };
  const scoreB = computeOpportunityScore(opportunityInputsB, profile);
  const opportunityB = createMarketOpportunity({
    snapshotId: snapshot.id,
    title: 'Minimal Botanical Stationery — Etsy',
    theme: 'Minimal Botanical',
    niche: 'Stationery',
    marketplace: 'etsy',
    score: scoreB,
    evidenceRefs: [observations[1].id, keywords[1].id],
    now,
  });

  const opportunities = [opportunityA, opportunityB];
  for (const opportunity of opportunities) await putMarketOpportunity(opportunity);

  const mission = generateDailyMission(opportunities, snapshot, { now });
  if (mission) await putDailyMission(mission);

  return { snapshot, opportunities, alreadySeeded: false };
}

export async function hasSampleOrRealMarketData(): Promise<boolean> {
  const [snapshots, observations, keywords, missions] = await Promise.all([
    loadMarketSnapshots(),
    loadMarketObservations(),
    loadMarketKeywords(),
    loadDailyMissions(),
  ]);
  return snapshots.length > 0 || observations.length > 0 || keywords.length > 0 || missions.length > 0;
}
