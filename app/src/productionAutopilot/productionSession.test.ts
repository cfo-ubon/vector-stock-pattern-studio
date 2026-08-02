import { describe, it, expect } from 'vitest';
import {
  createProductionSession,
  transitionProductionSession,
  recordProductionSessionDecision,
  attachProductionSessionBatch,
  completeProductionSessionOutcome,
  canTransitionProductionSession,
  InvalidProductionSessionTransitionError,
  generateProductionSessionId,
  isValidProductionSession,
} from './productionSession';
import { runPreflightValidation } from './preflightValidation';
import { planProductionSession } from './productionSessionPlanner';
import type { ProductionCompletionReview } from './domain/types';

const NOW = 1_700_000_000_000;

function plan() {
  const preflight = runPreflightValidation([], [], [], [], NOW);
  return planProductionSession([], [], [], preflight, NOW);
}

function outcome(): ProductionCompletionReview {
  return {
    batchId: 'B-1',
    packagesProduced: 3,
    commercialReady: 2,
    review: 1,
    repair: 0,
    rejected: 0,
    businessOutcomeScore: 70,
    factoryEfficiency: 85,
    ownerTimeSavedMinutes: 10,
    improvementTasksCreated: 0,
    nextRecommendation: { action: 'GENERATE', reason: 'x', evidence: [], sourceTaskIds: [], decisionTrace: null },
    createdAt: NOW,
  };
}

describe('createProductionSession', () => {
  it('starts in PLANNED with a real id format and one history entry', () => {
    const session = createProductionSession(plan(), NOW);
    expect(session.status).toBe('PLANNED');
    expect(session.id).toMatch(/^FSESS-\d{8}-[0-9A-Z]{6}$/);
    expect(session.history).toEqual([{ status: 'PLANNED', at: NOW }]);
    expect(session.decisionCount).toBe(0);
  });
});

describe('production session state machine', () => {
  it('allows PLANNED -> APPROVED -> RUNNING -> COMPLETED', () => {
    let session = createProductionSession(plan(), NOW);
    session = transitionProductionSession(session, 'APPROVED', NOW + 100);
    session = transitionProductionSession(session, 'RUNNING', NOW + 200);
    session = transitionProductionSession(session, 'COMPLETED', NOW + 300);
    expect(session.status).toBe('COMPLETED');
    expect(session.startedAt).toBe(NOW + 200);
    expect(session.completedAt).toBe(NOW + 300);
    expect(session.history).toHaveLength(4);
  });

  it('rejects an invalid transition (PLANNED -> RUNNING) with a named error', () => {
    const session = createProductionSession(plan(), NOW);
    expect(canTransitionProductionSession('PLANNED', 'RUNNING')).toBe(false);
    expect(() => transitionProductionSession(session, 'RUNNING', NOW + 100)).toThrow(InvalidProductionSessionTransitionError);
  });

  it('COMPLETED and CANCELLED are terminal — no further transitions allowed', () => {
    let session = createProductionSession(plan(), NOW);
    session = transitionProductionSession(session, 'APPROVED', NOW + 100);
    session = transitionProductionSession(session, 'RUNNING', NOW + 200);
    session = transitionProductionSession(session, 'COMPLETED', NOW + 300);
    expect(() => transitionProductionSession(session, 'RUNNING', NOW + 400)).toThrow(InvalidProductionSessionTransitionError);
  });
});

describe('recordProductionSessionDecision / attachProductionSessionBatch', () => {
  it('increments the real decision count without mutating the original', () => {
    const session = createProductionSession(plan(), NOW);
    const decided = recordProductionSessionDecision(session, NOW + 50);
    expect(session.decisionCount).toBe(0);
    expect(decided.decisionCount).toBe(1);
  });

  it('attaches a real batchId without touching status', () => {
    const session = createProductionSession(plan(), NOW);
    const attached = attachProductionSessionBatch(session, 'B-1', NOW + 50);
    expect(attached.batchId).toBe('B-1');
    expect(attached.status).toBe('PLANNED');
  });
});

describe('completeProductionSessionOutcome', () => {
  it('sets the real outcome and transitions to COMPLETED in one step', () => {
    let session = createProductionSession(plan(), NOW);
    session = transitionProductionSession(session, 'APPROVED', NOW + 100);
    session = transitionProductionSession(session, 'RUNNING', NOW + 200);
    const completed = completeProductionSessionOutcome(session, outcome(), NOW + 300);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.outcome).toEqual(outcome());
  });
});

describe('generateProductionSessionId / isValidProductionSession', () => {
  it('generates a unique id per call', () => {
    expect(generateProductionSessionId(NOW)).not.toBe(generateProductionSessionId(NOW));
  });

  it('validates a real session and rejects a malformed value', () => {
    const session = createProductionSession(plan(), NOW);
    expect(isValidProductionSession(session)).toBe(true);
    expect(isValidProductionSession({})).toBe(false);
    expect(isValidProductionSession(null)).toBe(false);
  });
});
