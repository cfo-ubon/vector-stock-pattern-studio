import { describe, it, expect } from 'vitest';
import { buildCreativeBriefFromOpportunity } from './briefGenerator';
import { createMarketOpportunity } from '../../marketing/domain/marketOpportunity';
import { createMarketSnapshot } from '../../marketing/domain/marketSnapshot';
import { computeOpportunityScore } from '../../marketing/scoring/opportunityScoring';
import { createScoringProfile } from '../../marketing/domain/scoringProfile';

function makeOpportunity(overallValue: number) {
  const profile = createScoringProfile({ name: 'Test', now: 1000 });
  const score = computeOpportunityScore({ demandSignal: { value: overallValue, evidenceSource: 'USER_OBSERVATION', confidence: 'high' } }, profile);
  return createMarketOpportunity({
    snapshotId: 'SNAP-1',
    title: 'Spring Cottage Garden',
    theme: 'Spring Cottage Garden',
    niche: 'Botanical',
    marketplace: 'adobestock',
    score,
    evidenceRefs: ['OBS-1'],
    now: 1000,
  });
}

function makeSnapshot() {
  return createMarketSnapshot({
    researchDateRange: { from: 900, to: 1000 },
    evidenceRefs: ['OBS-1'],
    styles: ['Watercolor Botanical'],
    motifs: ['Tulip', 'Daisy', 'Olive branch'],
    colors: ['#9CAF88', '#F0D080'],
    productUseCases: ['fabric', 'homeDecor'],
    now: 1000,
  });
}

describe('buildCreativeBriefFromOpportunity', () => {
  it('derives a brief from a high-scoring opportunity and its snapshot, with rationale for every AI field', () => {
    const opportunity = makeOpportunity(90);
    const brief = buildCreativeBriefFromOpportunity(opportunity, makeSnapshot(), { now: 1000 });

    expect(brief.sourceOpportunityId).toBe(opportunity.id);
    expect(brief.collectionName).toBe('Spring Cottage Garden');
    expect(brief.heroStyle).toBe('Watercolor Botanical');
    expect(brief.secondaryAssets).toEqual(['Daisy', 'Olive branch']);
    expect(brief.colorDirection).toEqual(['#9CAF88', '#F0D080']);
    expect(brief.commercialPriority).toBe('urgent');
    expect(brief.fieldRationale.heroStyle).toContain('Market Snapshot');
    expect(brief.fieldRationale.commercialPriority).toContain('90');
  });

  it('falls back to neutral defaults with no snapshot, without fabricating rationale for fields it could not derive', () => {
    const opportunity = makeOpportunity(30);
    const brief = buildCreativeBriefFromOpportunity(opportunity, null, { now: 1000 });

    expect(brief.heroStyle).toBe(opportunity.theme);
    expect(brief.secondaryAssets).toEqual([]);
    expect(brief.fieldRationale.heroStyle).toBeUndefined();
    expect(brief.commercialPriority).toBe('low');
    expect(brief.expectedDifficulty).toBe('very-hard');
  });
});
