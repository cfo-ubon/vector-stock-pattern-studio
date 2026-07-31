import { describe, it, expect } from 'vitest';
import { buildGlobalSeasonalEvents } from './globalCalendar';

describe('buildGlobalSeasonalEvents', () => {
  it('produces a real, non-empty seed list all marked global and not user-defined', () => {
    const events = buildGlobalSeasonalEvents(2026, 1000);
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event.isGlobal).toBe(true);
      expect(event.isUserDefined).toBe(false);
      expect(new Date(event.eventDate).getUTCFullYear()).toBe(2026);
    }
  });

  it('is deterministic for the same year', () => {
    const a = buildGlobalSeasonalEvents(2026, 1000);
    const b = buildGlobalSeasonalEvents(2026, 1000);
    expect(a.map((e) => e.eventDate)).toEqual(b.map((e) => e.eventDate));
  });
});
