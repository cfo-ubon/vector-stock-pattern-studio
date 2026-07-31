import { describe, it, expect } from 'vitest';
import { createMarketOpportunity, isValidMarketOpportunity, InvalidMarketOpportunityInputError } from './marketOpportunity';
import { computeOpportunityScore } from '../scoring/opportunityScoring';
import { createScoringProfile } from '../domain/scoringProfile';

function sampleScore() {
  const profile = createScoringProfile({ name: 'Test', now: 1000 });
  return computeOpportunityScore({ demandSignal: { value: 80, evidenceSource: 'USER_OBSERVATION', confidence: 'medium' } }, profile);
}

describe('createMarketOpportunity', () => {
  it('creates a well-shaped opportunity starting in RESEARCH status', () => {
    const opportunity = createMarketOpportunity({
      snapshotId: 'SNAP-1',
      title: 'Spring Cottage Garden',
      theme: 'Spring Cottage Garden',
      niche: 'Botanical',
      marketplace: 'adobestock',
      score: sampleScore(),
      evidenceRefs: ['OBS-1'],
      now: 1000,
    });
    expect(opportunity.status).toBe('RESEARCH');
    expect(opportunity.score.overall).toBe(80);
    expect(isValidMarketOpportunity(opportunity)).toBe(true);
  });

  it('rejects an empty title', () => {
    expect(() =>
      createMarketOpportunity({ snapshotId: 'SNAP-1', title: '', theme: '', niche: '', marketplace: 'etsy', score: sampleScore(), evidenceRefs: [] }),
    ).toThrow(InvalidMarketOpportunityInputError);
  });
});
