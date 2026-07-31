import { MARKETPLACE_PROFILES, type MarketplaceId } from '../../metadata/marketplaceProfiles';
import type { MarketObservation } from '../domain/marketObservation';
import type { MarketKeyword } from '../domain/marketKeyword';
import type { EvidenceBand } from '../domain/evidence';
import { EVIDENCE_BAND_VALUES } from '../domain/evidence';

// Build 028, Module 1 Section 8 (Marketplace Comparison). Reuses the
// existing, already-real `MARKETPLACE_PROFILES` (title/description/
// keyword/preview rules per marketplace, built from `src/marketplaces/*.json`
// — see BUILD_028_AUDIT.md Section 1.5) for the metadata-requirements
// dimension, and derives competition/demand as a *distribution* of
// observed bands rather than a single averaged number — averaging
// ordinal categories like "low"/"medium"/"high" into one figure would
// imply false numeric precision this build has no real data source for.

export type EvidenceBandDistribution = Record<EvidenceBand, number>;

function emptyDistribution(): EvidenceBandDistribution {
  return Object.fromEntries(EVIDENCE_BAND_VALUES.map((b) => [b, 0])) as EvidenceBandDistribution;
}

export interface MarketplaceComparisonRow {
  marketplaceId: MarketplaceId;
  metadataRequirements: {
    titleMaxLength: number;
    descriptionMaxLength: number;
    minKeywords: number;
    maxKeywords: number;
  };
  observationCount: number;
  demandDistribution: EvidenceBandDistribution;
  competitionDistribution: EvidenceBandDistribution;
  keywordCount: number;
  keywordOpportunityDistribution: EvidenceBandDistribution;
}

export function compareMarketplaces(
  marketplaceIds: MarketplaceId[],
  observations: MarketObservation[],
  keywords: MarketKeyword[],
): MarketplaceComparisonRow[] {
  return marketplaceIds.map((marketplaceId) => {
    const profile = MARKETPLACE_PROFILES[marketplaceId];
    const marketplaceObservations = observations.filter((o) => o.marketplace === marketplaceId);
    const marketplaceKeywords = keywords.filter((k) => k.marketplace === marketplaceId);

    const demandDistribution = emptyDistribution();
    const competitionDistribution = emptyDistribution();
    for (const obs of marketplaceObservations) {
      demandDistribution[obs.demandSignal] += 1;
      competitionDistribution[obs.competitionSignal] += 1;
    }

    const keywordOpportunityDistribution = emptyDistribution();
    for (const keyword of marketplaceKeywords) {
      keywordOpportunityDistribution[keyword.opportunityEstimate] += 1;
    }

    return {
      marketplaceId,
      metadataRequirements: {
        titleMaxLength: profile.titleRules.maxLength,
        descriptionMaxLength: profile.descriptionRules.maxLength,
        minKeywords: profile.keywordRules.minCount,
        maxKeywords: profile.keywordRules.maxCount,
      },
      observationCount: marketplaceObservations.length,
      demandDistribution,
      competitionDistribution,
      keywordCount: marketplaceKeywords.length,
      keywordOpportunityDistribution,
    };
  });
}
