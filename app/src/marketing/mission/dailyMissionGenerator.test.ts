import { describe, it, expect } from 'vitest';
import { generateDailyMission } from './dailyMissionGenerator';
import { createMarketOpportunity } from '../domain/marketOpportunity';
import { createMarketSnapshot } from '../domain/marketSnapshot';
import { createScoringProfile } from '../domain/scoringProfile';
import { computeOpportunityScore } from '../scoring/opportunityScoring';

function makeSnapshot() {
  return createMarketSnapshot({
    researchDateRange: { from: 0, to: 1000 },
    evidenceRefs: ['OBS-1'],
    motifs: ['Tulip bouquet', 'Daisy sprig'],
    colors: ['sage', 'butter yellow'],
    productUseCases: ['gift wrap', 'stationery'],
    now: 1000,
  });
}

describe('generateDailyMission', () => {
  it('picks the highest-scoring opportunity for the snapshot and maps real snapshot fields onto the mission', () => {
    const snapshot = makeSnapshot();
    const profile = createScoringProfile({ name: 'Test', now: 1000 });
    const low = createMarketOpportunity({
      snapshotId: snapshot.id,
      title: 'Low',
      theme: 'Low Theme',
      niche: 'Botanical',
      marketplace: 'etsy',
      score: computeOpportunityScore({ demandSignal: { value: 30, evidenceSource: 'SAMPLE_DATA', confidence: 'low' } }, profile),
      evidenceRefs: ['OBS-1'],
      now: 1000,
    });
    const high = createMarketOpportunity({
      snapshotId: snapshot.id,
      title: 'High',
      theme: 'High Theme',
      niche: 'Botanical',
      marketplace: 'adobestock',
      score: computeOpportunityScore({ demandSignal: { value: 90, evidenceSource: 'USER_OBSERVATION', confidence: 'high' } }, profile),
      evidenceRefs: ['OBS-1'],
      now: 1000,
    });
    const mission = generateDailyMission([low, high], snapshot, { now: 2000 });
    expect(mission?.opportunityId).toBe(high.id);
    expect(mission?.heroMotif).toBe('Tulip bouquet');
    expect(mission?.secondaryMotifs).toEqual(['Daisy sprig']);
    expect(mission?.colorDirection).toEqual(['sage', 'butter yellow']);
    expect(mission?.evidenceFreshness).toBe(snapshot.dataFreshness);
  });

  it('returns null (not a fabricated mission) when there are no opportunities for this snapshot', () => {
    const snapshot = makeSnapshot();
    expect(generateDailyMission([], snapshot)).toBeNull();
  });

  it('surfaces a risk note when the best opportunity has missing scoring dimensions', () => {
    const snapshot = makeSnapshot();
    const profile = createScoringProfile({ name: 'Test', now: 1000 });
    const opportunity = createMarketOpportunity({
      snapshotId: snapshot.id,
      title: 'Only one dimension',
      theme: 'Theme',
      niche: 'Botanical',
      marketplace: 'etsy',
      score: computeOpportunityScore({ demandSignal: { value: 60, evidenceSource: 'SAMPLE_DATA', confidence: 'unknown' } }, profile),
      evidenceRefs: ['OBS-1'],
      now: 1000,
    });
    const mission = generateDailyMission([opportunity], snapshot, { now: 2000 });
    expect(mission?.risks.length).toBeGreaterThan(0);
  });
});
