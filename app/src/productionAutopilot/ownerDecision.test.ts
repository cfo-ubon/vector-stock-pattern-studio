import { describe, it, expect } from 'vitest';
import { recordOwnerDecision, countOwnerDecisionsToday, isWithinDailyDecisionTarget, generateOwnerDecisionId } from './ownerDecision';
import { DAILY_OWNER_DECISION_TARGET } from './domain/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);

describe('recordOwnerDecision', () => {
  it('records a real timestamped decision, never inferring a duration', () => {
    const record = recordOwnerDecision('APPROVE_SESSION', 'FSESS-1', 4200, NOW);
    expect(record.type).toBe('APPROVE_SESSION');
    expect(record.sessionId).toBe('FSESS-1');
    expect(record.durationMs).toBe(4200);
    expect(record.decidedAt).toBe(NOW);
  });

  it('generates a stable, matchable id format', () => {
    const id = generateOwnerDecisionId(NOW);
    expect(id).toMatch(/^FODEC-\d{8}-[0-9A-Z]{6}$/);
  });
});

describe('countOwnerDecisionsToday', () => {
  it('counts only decisions made on the same calendar day', () => {
    const records = [
      recordOwnerDecision('APPROVE_SESSION', null, 1000, NOW),
      recordOwnerDecision('APPROVE_EXPORT', null, 1000, NOW - DAY_MS),
      recordOwnerDecision('APPROVE_OVERRIDE', null, 1000, NOW + 1000),
    ];
    expect(countOwnerDecisionsToday(records, NOW)).toBe(2);
  });

  it('returns 0 for no records, never a fabricated baseline', () => {
    expect(countOwnerDecisionsToday([], NOW)).toBe(0);
  });
});

describe('isWithinDailyDecisionTarget', () => {
  it('matches the disclosed ≤3/day target exactly', () => {
    expect(isWithinDailyDecisionTarget(DAILY_OWNER_DECISION_TARGET)).toBe(true);
    expect(isWithinDailyDecisionTarget(DAILY_OWNER_DECISION_TARGET + 1)).toBe(false);
  });
});
