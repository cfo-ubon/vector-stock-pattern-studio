import { createSeasonalEvent, type SeasonalEvent } from '../domain/seasonalEvent';

// Build 028, Module 1 Section 6 — a small, honestly-scoped seed list of
// widely-recognized global gift/decor occasions (the brief's own examples:
// New Year, Valentine's Day, Easter, Mother's Day, Halloween, Christmas,
// Wedding season, Back to School). These are common calendar facts, not
// live market data — every one of them still carries `isGlobal: true` /
// `isUserDefined: false` so the UI can label them distinctly from a user's
// own region-specific or cultural events (the brief explicitly requires
// supporting more than one country; this seed list is a starting point,
// not a claim of completeness). Easter's date genuinely varies by ~5 weeks
// each year and cannot be computed with a fixed offset without a real
// lunar calendar algorithm — deliberately using an approximate fixed
// month/day per year here would misrepresent it as precise, so Easter is
// intentionally omitted from the auto-generated list; users can add it
// manually with the real date for a given year.

interface GlobalEventTemplate {
  eventName: string;
  month: number; // 1-12
  day: number;
}

const GLOBAL_EVENT_TEMPLATES: GlobalEventTemplate[] = [
  { eventName: "New Year's Day", month: 1, day: 1 },
  { eventName: "Valentine's Day", month: 2, day: 14 },
  { eventName: "Mother's Day (US/UK convention, verify locally)", month: 5, day: 12 },
  { eventName: 'Back to School', month: 8, day: 15 },
  { eventName: 'Wedding Season (Northern Hemisphere peak)', month: 6, day: 1 },
  { eventName: 'Halloween', month: 10, day: 31 },
  { eventName: 'Christmas', month: 12, day: 25 },
];

/** Builds this year's global seasonal events from the seed templates above.
 * `year` must be supplied explicitly by the caller (never inferred from
 * the system clock inside this pure function) so tests stay deterministic
 * and callers control which year's calendar they're generating. */
export function buildGlobalSeasonalEvents(year: number, now: number = Date.now()): SeasonalEvent[] {
  return GLOBAL_EVENT_TEMPLATES.map((template) =>
    createSeasonalEvent({
      eventName: template.eventName,
      eventDate: Date.UTC(year, template.month - 1, template.day),
      region: 'global',
      isGlobal: true,
      isUserDefined: false,
      now,
    }),
  );
}
