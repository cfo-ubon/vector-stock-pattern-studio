import { describe, it, expect } from 'vitest';
import { createDailyMission, transitionDailyMissionStatus, isValidDailyMission, InvalidDailyMissionInputError } from './dailyMission';

describe('createDailyMission', () => {
  it('creates a well-shaped mission starting in RESEARCH status with sane defaults', () => {
    const mission = createDailyMission({
      date: 1000,
      opportunityId: 'OPP-1',
      primaryMarketplace: 'adobestock',
      niche: 'Botanical',
      theme: 'Spring Cottage Garden',
      category: 'botanical',
      heroMotif: 'Tulip bouquet with ribbon',
      opportunityScore: 88,
      confidence: 'medium',
      evidenceFreshness: 'Same day',
      now: 1000,
    });
    expect(mission.status).toBe('RESEARCH');
    expect(mission.designCount).toBe(10);
    expect(mission.colorwayCount).toBe(3);
    expect(isValidDailyMission(mission)).toBe(true);
  });

  it('rejects an empty opportunityId or theme', () => {
    expect(() =>
      createDailyMission({
        date: 1000,
        opportunityId: '',
        primaryMarketplace: 'etsy',
        niche: '',
        theme: 'x',
        category: '',
        heroMotif: '',
        opportunityScore: 50,
        confidence: 'unknown',
        evidenceFreshness: '',
      }),
    ).toThrow(InvalidDailyMissionInputError);
  });
});

describe('transitionDailyMissionStatus', () => {
  it('supports the accept/reject/postpone/edit workflow via real status transitions', () => {
    const mission = createDailyMission({
      date: 1000,
      opportunityId: 'OPP-1',
      primaryMarketplace: 'adobestock',
      niche: 'Botanical',
      theme: 'Spring',
      category: 'botanical',
      heroMotif: 'Tulip',
      opportunityScore: 80,
      confidence: 'medium',
      evidenceFreshness: 'Same day',
      now: 1000,
    });
    const selected = transitionDailyMissionStatus(mission, 'SELECTED');
    expect(selected.status).toBe('SELECTED');
    expect(mission.status).toBe('RESEARCH');
  });
});
