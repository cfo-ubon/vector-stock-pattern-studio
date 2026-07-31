import { describe, it, expect } from 'vitest';
import { createMarketObservation } from '../domain/marketObservation';
import { createMarketKeyword } from '../domain/marketKeyword';
import { compareMarketplaces } from './marketplaceComparison';

describe('compareMarketplaces', () => {
  it('pulls real metadata requirements from the existing MarketplaceProfile system', () => {
    const [row] = compareMarketplaces(['etsy'], [], []);
    expect(row.marketplaceId).toBe('etsy');
    expect(row.metadataRequirements.titleMaxLength).toBeGreaterThan(0);
    expect(row.metadataRequirements.maxKeywords).toBeGreaterThan(0);
  });

  it('builds a real per-band distribution from observations, not a fabricated average', () => {
    const observations = [
      createMarketObservation({ sourceType: 'etsy', evidenceStatus: 'USER_OBSERVATION', marketplace: 'etsy', demandSignal: 'high', competitionSignal: 'medium', now: 1000 }),
      createMarketObservation({ sourceType: 'etsy', evidenceStatus: 'USER_OBSERVATION', marketplace: 'etsy', demandSignal: 'high', competitionSignal: 'low', now: 1000 }),
      createMarketObservation({ sourceType: 'adobe-stock', evidenceStatus: 'USER_OBSERVATION', marketplace: 'adobestock', demandSignal: 'low', competitionSignal: 'high', now: 1000 }),
    ];
    const [etsyRow] = compareMarketplaces(['etsy'], observations, []);
    expect(etsyRow.observationCount).toBe(2);
    expect(etsyRow.demandDistribution.high).toBe(2);
    expect(etsyRow.competitionDistribution.medium).toBe(1);
    expect(etsyRow.competitionDistribution.low).toBe(1);
  });

  it('builds a real keyword-opportunity distribution scoped to each marketplace', () => {
    const keywords = [
      createMarketKeyword({ keyword: 'a', cluster: 'subject', evidenceSource: 'SAMPLE_DATA', marketplace: 'etsy', opportunityEstimate: 'high', now: 1000 }),
      createMarketKeyword({ keyword: 'b', cluster: 'subject', evidenceSource: 'SAMPLE_DATA', marketplace: 'adobestock', opportunityEstimate: 'low', now: 1000 }),
    ];
    const [etsyRow] = compareMarketplaces(['etsy'], [], keywords);
    expect(etsyRow.keywordCount).toBe(1);
    expect(etsyRow.keywordOpportunityDistribution.high).toBe(1);
  });
});
