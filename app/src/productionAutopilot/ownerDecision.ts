import type { OwnerDecisionRecord, OwnerDecisionType } from './domain/types';
import { DAILY_OWNER_DECISION_TARGET } from './domain/types';

// Mission 4, Part 5 — Owner Decision Reduction. Every record here is a
// real, timestamped owner action — never inferred or estimated. The
// daily count is a real tally over already-recorded decisions, compared
// against the spec's own disclosed "≤3/day" target.

function pad(n: number, len: number): string {
  return String(n).padStart(len, '0');
}
function dateStamp(now: number): string {
  const d = new Date(now);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1, 2)}${pad(d.getUTCDate(), 2)}`;
}
function randomSuffix(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
export function generateOwnerDecisionId(now: number = Date.now()): string {
  return `FODEC-${dateStamp(now)}-${randomSuffix()}`;
}

export function recordOwnerDecision(type: OwnerDecisionType, sessionId: string | null, durationMs: number, now: number = Date.now(), note: string | null = null): OwnerDecisionRecord {
  return { id: generateOwnerDecisionId(now), sessionId, type, decidedAt: now, durationMs, note };
}

function dateKeyFor(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function countOwnerDecisionsToday(records: OwnerDecisionRecord[], now: number = Date.now()): number {
  const today = dateKeyFor(now);
  return records.filter((r) => dateKeyFor(r.decidedAt) === today).length;
}

export function isWithinDailyDecisionTarget(count: number): boolean {
  return count <= DAILY_OWNER_DECISION_TARGET;
}
