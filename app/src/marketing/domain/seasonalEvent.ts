import { seasonalEventId } from './id';

// Build 028, Module 1 Section 6 (Seasonal Production Calendar). Region and
// marketplaceProfile are plain strings, not a hardcoded enum of countries —
// the brief is explicit that this must support arbitrary regions, not one
// hardcoded country.

export const SEASONAL_EVENT_SCHEMA_VERSION = 1;

export interface SeasonalEvent {
  id: string;
  eventName: string;
  region: string;
  marketplaceProfile: string | null;
  eventDate: number;
  recommendedDesignStartDate: number;
  recommendedSubmissionStartDate: number;
  expectedDemandWindowFrom: number;
  expectedDemandWindowTo: number;
  lateProductionWarningDate: number;
  isGlobal: boolean;
  isUserDefined: boolean;
  createdAt: number;
  schemaVersion: number;
}

export class InvalidSeasonalEventInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSeasonalEventInputError';
  }
}

const DAY = 24 * 60 * 60 * 1000;

export interface CreateSeasonalEventInput {
  eventName: string;
  eventDate: number;
  region?: string;
  marketplaceProfile?: string | null;
  isGlobal?: boolean;
  isUserDefined?: boolean;
  /** Days of production lead time before `eventDate` — defaults follow the
   * common stock-marketplace guidance of designing/submitting well ahead
   * of a seasonal demand spike (reviews + buyer browsing windows both take
   * weeks), not an arbitrary number. Callers researching a specific
   * marketplace's real review SLA should override these explicitly. */
  designLeadDays?: number;
  submissionLeadDays?: number;
  demandWindowDays?: number;
  lateWarningLeadDays?: number;
  now?: number;
}

export function createSeasonalEvent(input: CreateSeasonalEventInput): SeasonalEvent {
  if (!input.eventName.trim()) {
    throw new InvalidSeasonalEventInputError('eventName cannot be empty.');
  }
  const now = input.now ?? Date.now();
  const designLeadDays = input.designLeadDays ?? 90;
  const submissionLeadDays = input.submissionLeadDays ?? 60;
  const demandWindowDays = input.demandWindowDays ?? 21;
  const lateWarningLeadDays = input.lateWarningLeadDays ?? 30;
  return {
    id: seasonalEventId.generate(now),
    eventName: input.eventName,
    region: input.region ?? 'global',
    marketplaceProfile: input.marketplaceProfile ?? null,
    eventDate: input.eventDate,
    recommendedDesignStartDate: input.eventDate - designLeadDays * DAY,
    recommendedSubmissionStartDate: input.eventDate - submissionLeadDays * DAY,
    expectedDemandWindowFrom: input.eventDate - demandWindowDays * DAY,
    expectedDemandWindowTo: input.eventDate,
    lateProductionWarningDate: input.eventDate - lateWarningLeadDays * DAY,
    isGlobal: input.isGlobal ?? false,
    isUserDefined: input.isUserDefined ?? true,
    createdAt: now,
    schemaVersion: SEASONAL_EVENT_SCHEMA_VERSION,
  };
}

export function isValidSeasonalEvent(value: unknown): value is SeasonalEvent {
  if (!value || typeof value !== 'object') return false;
  const r = value as Partial<SeasonalEvent>;
  return (
    typeof r.id === 'string' &&
    typeof r.eventName === 'string' &&
    typeof r.eventDate === 'number' &&
    typeof r.recommendedDesignStartDate === 'number' &&
    typeof r.recommendedSubmissionStartDate === 'number' &&
    typeof r.isGlobal === 'boolean' &&
    typeof r.isUserDefined === 'boolean'
  );
}

/** Section 6's "late-production warning" check — a real, explainable
 * comparison against `now`, not a fabricated urgency score. */
export function isLateForProduction(event: SeasonalEvent, now: number = Date.now()): boolean {
  return now > event.lateProductionWarningDate && now < event.eventDate;
}

export function isPastEvent(event: SeasonalEvent, now: number = Date.now()): boolean {
  return now > event.eventDate;
}
