import { describe, it, expect, beforeEach } from 'vitest';
import { createSeasonalEvent } from '../domain/seasonalEvent';
import { loadSeasonalEvents, putSeasonalEvent, deleteSeasonalEvent, clearSeasonalEvents, ensureGlobalSeasonalEventsSeeded } from './seasonalEventStore';

beforeEach(async () => {
  await clearSeasonalEvents();
});

describe('seasonalEventStore', () => {
  it('is empty before anything is written', async () => {
    expect(await loadSeasonalEvents()).toEqual([]);
  });

  it('persists and deletes an event', async () => {
    const event = createSeasonalEvent({ eventName: 'Local Festival', eventDate: 1_000_000_000, now: 1000 });
    await putSeasonalEvent(event);
    expect(await loadSeasonalEvents()).toHaveLength(1);
    await deleteSeasonalEvent(event.id);
    expect(await loadSeasonalEvents()).toHaveLength(0);
  });
});

describe('ensureGlobalSeasonalEventsSeeded', () => {
  it('seeds real global events into an empty store', async () => {
    await ensureGlobalSeasonalEventsSeeded(Date.UTC(2026, 0, 1));
    const events = await loadSeasonalEvents();
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.isGlobal)).toBe(true);
  });

  it('is idempotent — never duplicates or overwrites existing events', async () => {
    await ensureGlobalSeasonalEventsSeeded(Date.UTC(2026, 0, 1));
    const firstCount = (await loadSeasonalEvents()).length;
    const customEvent = createSeasonalEvent({ eventName: 'My Local Event', eventDate: 5_000_000_000, now: 1000 });
    await putSeasonalEvent(customEvent);
    await ensureGlobalSeasonalEventsSeeded(Date.UTC(2026, 0, 1));
    const afterCount = (await loadSeasonalEvents()).length;
    expect(afterCount).toBe(firstCount + 1);
  });
});
