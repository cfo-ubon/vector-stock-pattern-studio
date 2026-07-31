import { describe, it, expect } from 'vitest';
import { createSeasonalEvent, isLateForProduction, isPastEvent, isValidSeasonalEvent, InvalidSeasonalEventInputError } from './seasonalEvent';

const DAY = 24 * 60 * 60 * 1000;

describe('createSeasonalEvent', () => {
  it('computes recommended start dates as real offsets before eventDate, not hardcoded absolute dates', () => {
    const eventDate = Date.UTC(2026, 11, 25); // Christmas 2026
    const event = createSeasonalEvent({ eventName: 'Christmas', eventDate, now: 1000 });
    expect(event.recommendedDesignStartDate).toBe(eventDate - 90 * DAY);
    expect(event.recommendedSubmissionStartDate).toBe(eventDate - 60 * DAY);
    expect(event.lateProductionWarningDate).toBe(eventDate - 30 * DAY);
    expect(isValidSeasonalEvent(event)).toBe(true);
  });

  it('supports an arbitrary region, not one hardcoded country', () => {
    const event = createSeasonalEvent({ eventName: 'Songkran', eventDate: Date.UTC(2026, 3, 13), region: 'Thailand', now: 1000 });
    expect(event.region).toBe('Thailand');
  });

  it('rejects an empty eventName', () => {
    expect(() => createSeasonalEvent({ eventName: '', eventDate: 1000 })).toThrow(InvalidSeasonalEventInputError);
  });
});

describe('isLateForProduction / isPastEvent', () => {
  it('correctly classifies before, during the warning window, and after the event', () => {
    const eventDate = Date.UTC(2026, 11, 25);
    const event = createSeasonalEvent({ eventName: 'Christmas', eventDate, now: 1000 });
    expect(isLateForProduction(event, eventDate - 45 * DAY)).toBe(false);
    expect(isLateForProduction(event, eventDate - 10 * DAY)).toBe(true);
    expect(isPastEvent(event, eventDate + DAY)).toBe(true);
    expect(isPastEvent(event, eventDate - DAY)).toBe(false);
  });
});
