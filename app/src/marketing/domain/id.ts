// Build 028 — id generation shared across every Marketing Intelligence /
// AI Design Director record, mirroring `catalog/submission/submissionRecord.ts`'s
// `generateSubmissionId` shape (`PREFIX-YYYYMMDD-XXXXXX`) rather than
// importing it — this module is a new, isolated subsystem and must not
// require touching an existing, already-shipped domain file to add a new
// id prefix.

function generateId(prefix: string, now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, '0');
  return `${prefix}-${y}${m}${d}-${suffix}`;
}

function makeIdKit(prefix: string) {
  const pattern = new RegExp(`^${prefix}-\\d{8}-[0-9A-Z]{6}$`);
  return {
    generate: (now: number | Date = Date.now()) => generateId(prefix, now instanceof Date ? now : new Date(now)),
    isValid: (value: unknown): value is string => typeof value === 'string' && pattern.test(value),
  };
}

export const researchSourceId = makeIdKit('SRC');
export const marketObservationId = makeIdKit('OBS');
export const marketSnapshotId = makeIdKit('SNAP');
export const marketKeywordId = makeIdKit('KW');
export const seasonalEventId = makeIdKit('EVT');
export const marketOpportunityId = makeIdKit('OPP');
export const scoringProfileId = makeIdKit('SCP');
export const dailyMissionId = makeIdKit('MISN');
export const designBriefId = makeIdKit('BRF');
export const designStrategyId = makeIdKit('STRAT');
export const designConfigurationId = makeIdKit('CFG');
export const marketingDesignHandoffId = makeIdKit('HOF');
export const commercialFeedbackSignalId = makeIdKit('SIG');
export const recommendationHistoryId = makeIdKit('REC');
