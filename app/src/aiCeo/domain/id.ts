// Build 030 Part 2 — id generation for every AI CEO record, mirroring
// `marketing/domain/id.ts`'s own `PREFIX-YYYYMMDD-XXXXXX` shape and its
// stated reason for not importing that module: this is a new, isolated
// subsystem and must not require touching an already-shipped domain file
// to add a new id prefix.

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

export const aiCeoBriefId = makeIdKit('BRIEF');
export const aiCeoRecommendationId = makeIdKit('CEOREC');
export const businessGoalId = makeIdKit('GOAL');
export const aiConversationId = makeIdKit('CONV');
export const aiConversationMessageId = makeIdKit('MSG');
export const aiMemoryCandidateId = makeIdKit('MEMC');
export const aiMemoryId = makeIdKit('MEM');
export const portfolioDiagnosisId = makeIdKit('DIAG');
export const businessCoachRunId = makeIdKit('COACH');
export const proactiveRecommendationHistoryId = makeIdKit('PRH');
