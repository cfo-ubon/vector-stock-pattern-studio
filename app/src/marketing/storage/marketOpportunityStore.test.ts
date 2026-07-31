import { describe, it, expect, beforeEach } from 'vitest';
import { createMarketOpportunity } from '../domain/marketOpportunity';
import { computeOpportunityScore } from '../scoring/opportunityScoring';
import { createScoringProfile } from '../domain/scoringProfile';
import { loadMarketOpportunities, getMarketOpportunity, putMarketOpportunity, deleteMarketOpportunity, clearMarketOpportunities } from './marketOpportunityStore';

beforeEach(async () => {
  await clearMarketOpportunities();
});

function makeOpportunity() {
  const profile = createScoringProfile({ name: 'Test', now: 1000 });
  const score = computeOpportunityScore({ demandSignal: { value: 80, evidenceSource: 'USER_OBSERVATION', confidence: 'medium' } }, profile);
  return createMarketOpportunity({ snapshotId: 'SNAP-1', title: 'x', theme: 'x', niche: 'x', marketplace: 'etsy', score, evidenceRefs: ['OBS-1'], now: 1000 });
}

describe('marketOpportunityStore', () => {
  it('persists and retrieves an opportunity with its full score object intact', async () => {
    const opportunity = makeOpportunity();
    await putMarketOpportunity(opportunity);
    expect(await getMarketOpportunity(opportunity.id)).toEqual(opportunity);
  });

  it('deletes an opportunity', async () => {
    const opportunity = makeOpportunity();
    await putMarketOpportunity(opportunity);
    await deleteMarketOpportunity(opportunity.id);
    expect(await getMarketOpportunity(opportunity.id)).toBeUndefined();
  });

  it('loads all opportunities', async () => {
    await putMarketOpportunity(makeOpportunity());
    expect(await loadMarketOpportunities()).toHaveLength(1);
  });
});
