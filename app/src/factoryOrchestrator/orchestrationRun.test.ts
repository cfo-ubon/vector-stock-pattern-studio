import { describe, it, expect } from 'vitest';
import {
  createOrchestrationRun,
  transitionOrchestrationRun,
  canTransitionOrchestrationRun,
  InvalidOrchestrationTransitionError,
  generateOrchestrationRunId,
  attachOrchestrationRunSession,
  attachOrchestrationRunBatch,
  attachOrchestrationRunArchive,
  isValidOrchestrationRun,
} from './orchestrationRun';

const NOW = 1_700_000_000_000;

describe('createOrchestrationRun', () => {
  it('starts in IDLE with a real id format and one history entry', () => {
    const run = createOrchestrationRun(NOW);
    expect(run.status).toBe('IDLE');
    expect(run.id).toMatch(/^FORCH-\d{8}-[0-9A-Z]{6}$/);
    expect(run.history).toEqual([{ status: 'IDLE', at: NOW }]);
  });

  it('generates a unique id per call', () => {
    expect(generateOrchestrationRunId(NOW)).not.toBe(generateOrchestrationRunId(NOW));
  });
});

describe('orchestration run state machine', () => {
  it('walks the full happy path: IDLE -> PREPARING -> PREFLIGHT -> PLANNING -> WAITING_OWNER_APPROVAL -> RUNNING -> COMPLETED', () => {
    let run = createOrchestrationRun(NOW);
    run = transitionOrchestrationRun(run, 'PREPARING', NOW + 1);
    run = transitionOrchestrationRun(run, 'PREFLIGHT', NOW + 2);
    run = transitionOrchestrationRun(run, 'PLANNING', NOW + 3);
    run = transitionOrchestrationRun(run, 'WAITING_OWNER_APPROVAL', NOW + 4);
    run = transitionOrchestrationRun(run, 'RUNNING', NOW + 5);
    run = transitionOrchestrationRun(run, 'COMPLETED', NOW + 6);
    expect(run.status).toBe('COMPLETED');
    expect(run.history).toHaveLength(7);
  });

  it('rejects an invalid transition (IDLE -> RUNNING) with a named error', () => {
    const run = createOrchestrationRun(NOW);
    expect(canTransitionOrchestrationRun('IDLE', 'RUNNING')).toBe(false);
    expect(() => transitionOrchestrationRun(run, 'RUNNING', NOW + 1)).toThrow(InvalidOrchestrationTransitionError);
  });

  it('COMPLETED and CANCELLED are terminal — no further transitions allowed', () => {
    let run = createOrchestrationRun(NOW);
    run = transitionOrchestrationRun(run, 'PREPARING', NOW + 1);
    run = transitionOrchestrationRun(run, 'CANCELLED', NOW + 2);
    expect(() => transitionOrchestrationRun(run, 'PREPARING', NOW + 3)).toThrow(InvalidOrchestrationTransitionError);
  });

  it('records real waitingOwnerApprovalSince/ownerRespondedAt timestamps across the Approve gap', () => {
    let run = createOrchestrationRun(NOW);
    run = transitionOrchestrationRun(run, 'PREPARING', NOW + 1);
    run = transitionOrchestrationRun(run, 'PREFLIGHT', NOW + 2);
    run = transitionOrchestrationRun(run, 'PLANNING', NOW + 3);
    run = transitionOrchestrationRun(run, 'WAITING_OWNER_APPROVAL', NOW + 4);
    expect(run.waitingOwnerApprovalSince).toBe(NOW + 4);
    expect(run.ownerRespondedAt).toBeNull();
    run = transitionOrchestrationRun(run, 'RUNNING', NOW + 100);
    expect(run.ownerRespondedAt).toBe(NOW + 100);
  });

  it('BLOCKED records a real reason and clears it once PREPARING resumes', () => {
    let run = createOrchestrationRun(NOW);
    run = transitionOrchestrationRun(run, 'PREPARING', NOW + 1);
    run = transitionOrchestrationRun(run, 'PREFLIGHT', NOW + 2);
    run = transitionOrchestrationRun(run, 'BLOCKED', NOW + 3, 'Export queue is empty.');
    expect(run.blockedReason).toBe('Export queue is empty.');
    run = transitionOrchestrationRun(run, 'PREPARING', NOW + 4);
    expect(run.blockedReason).toBeNull();
  });

  it('FAILED can retry back to PREPARING', () => {
    let run = createOrchestrationRun(NOW);
    run = transitionOrchestrationRun(run, 'PREPARING', NOW + 1);
    run = transitionOrchestrationRun(run, 'FAILED', NOW + 2, 'Storage unavailable.');
    expect(run.failureReason).toBe('Storage unavailable.');
    run = transitionOrchestrationRun(run, 'PREPARING', NOW + 3);
    expect(run.status).toBe('PREPARING');
    expect(run.failureReason).toBeNull();
  });

  it('Pause/Resume round-trips correctly', () => {
    let run = createOrchestrationRun(NOW);
    run = transitionOrchestrationRun(run, 'PREPARING', NOW + 1);
    run = transitionOrchestrationRun(run, 'PREFLIGHT', NOW + 2);
    run = transitionOrchestrationRun(run, 'PLANNING', NOW + 3);
    run = transitionOrchestrationRun(run, 'WAITING_OWNER_APPROVAL', NOW + 4);
    run = transitionOrchestrationRun(run, 'RUNNING', NOW + 5);
    run = transitionOrchestrationRun(run, 'PAUSED', NOW + 6, 'Owner paused.');
    expect(run.status).toBe('PAUSED');
    run = transitionOrchestrationRun(run, 'RUNNING', NOW + 7);
    expect(run.status).toBe('RUNNING');
  });
});

describe('attach helpers', () => {
  it('attach session/batch/archive ids without touching status', () => {
    const run = createOrchestrationRun(NOW);
    const withSession = attachOrchestrationRunSession(run, 'FSESS-1', NOW + 1);
    expect(withSession.sessionId).toBe('FSESS-1');
    expect(withSession.status).toBe('IDLE');
    const withBatch = attachOrchestrationRunBatch(withSession, 'B-1', NOW + 2);
    expect(withBatch.batchId).toBe('B-1');
    const withArchive = attachOrchestrationRunArchive(withBatch, 'FARCH-1', NOW + 3);
    expect(withArchive.archiveId).toBe('FARCH-1');
  });
});

describe('isValidOrchestrationRun', () => {
  it('validates a real run and rejects a malformed value', () => {
    const run = createOrchestrationRun(NOW);
    expect(isValidOrchestrationRun(run)).toBe(true);
    expect(isValidOrchestrationRun({})).toBe(false);
    expect(isValidOrchestrationRun(null)).toBe(false);
  });
});
