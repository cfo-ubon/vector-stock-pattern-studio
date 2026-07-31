import { describe, it, expect, beforeEach } from 'vitest';
import { createDailyMission } from '../domain/dailyMission';
import { loadDailyMissions, getDailyMission, putDailyMission, clearDailyMissions, getMissionForDate } from './dailyMissionStore';

beforeEach(async () => {
  await clearDailyMissions();
});

function makeMission(date: number) {
  return createDailyMission({
    date,
    opportunityId: 'OPP-1',
    primaryMarketplace: 'etsy',
    niche: 'x',
    theme: 'x',
    category: 'x',
    heroMotif: 'x',
    opportunityScore: 70,
    confidence: 'medium',
    evidenceFreshness: 'Same day',
    now: date,
  });
}

describe('dailyMissionStore', () => {
  it('persists and retrieves a mission', async () => {
    const mission = makeMission(1000);
    await putDailyMission(mission);
    expect(await getDailyMission(mission.id)).toEqual(mission);
  });

  it('loads all missions', async () => {
    await putDailyMission(makeMission(1000));
    expect(await loadDailyMissions()).toHaveLength(1);
  });
});

describe('getMissionForDate', () => {
  it('finds the most recent mission whose date falls on the given day', async () => {
    const day = Date.UTC(2026, 6, 18, 9, 0, 0);
    const laterSameDay = Date.UTC(2026, 6, 18, 15, 0, 0);
    const earlier = makeMission(day);
    const later = makeMission(laterSameDay);
    await putDailyMission(earlier);
    await putDailyMission(later);
    const result = await getMissionForDate(day);
    expect(result?.id).toBe(later.id);
  });

  it('returns null honestly when no mission exists for that day', async () => {
    expect(await getMissionForDate(Date.UTC(2026, 6, 18))).toBeNull();
  });
});
