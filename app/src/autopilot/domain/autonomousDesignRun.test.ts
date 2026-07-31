import { describe, it, expect } from 'vitest';
import {
  createAutonomousDesignRun,
  transitionAutonomousDesignRun,
  isValidAutonomousDesignRun,
  isAutonomousRunArchived,
  archiveAutonomousDesignRun,
  unarchiveAutonomousDesignRun,
  InvalidAutonomousDesignRunInputError,
  InvalidAutonomousRunTransitionError,
} from './autonomousDesignRun';

describe('createAutonomousDesignRun', () => {
  it('creates a run at PLAN_DRAFT with real, honest defaults', () => {
    const run = createAutonomousDesignRun({ mode: 'FULL_AUTOPILOT', requestedCount: 10, now: 1000 });
    expect(run.status).toBe('PLAN_DRAFT');
    expect(run.history).toEqual([{ status: 'PLAN_DRAFT', at: 1000 }]);
    expect(run.designPlan).toBeNull();
    expect(run.items).toEqual([]);
    expect(run.readyCount).toBe(0);
    expect(run.reviewCount).toBe(0);
    expect(run.rejectCount).toBe(0);
    expect(run.cancelledAt).toBeNull();
    expect(run.resumeFromIndex).toBe(0);
    expect(isValidAutonomousDesignRun(run)).toBe(true);
  });

  it('rejects a non-positive requestedCount', () => {
    expect(() => createAutonomousDesignRun({ mode: 'FULL_AUTOPILOT', requestedCount: 0 })).toThrow(InvalidAutonomousDesignRunInputError);
    expect(() => createAutonomousDesignRun({ mode: 'FULL_AUTOPILOT', requestedCount: -1 })).toThrow(InvalidAutonomousDesignRunInputError);
  });

  it('rejects an invalid mode', () => {
    expect(() => createAutonomousDesignRun({ mode: 'NOT_A_MODE' as never, requestedCount: 5 })).toThrow(InvalidAutonomousDesignRunInputError);
  });
});

describe('transitionAutonomousDesignRun', () => {
  it('walks the real state machine PLAN_DRAFT -> PLAN_READY -> GENERATING -> COMPLETED, appending audit history', () => {
    let run = createAutonomousDesignRun({ mode: 'GUIDED_AUTOPILOT', requestedCount: 5, now: 1 });
    run = transitionAutonomousDesignRun(run, 'PLAN_READY', 2);
    run = transitionAutonomousDesignRun(run, 'GENERATING', 3);
    run = transitionAutonomousDesignRun(run, 'COMPLETED', 4, 'all items processed');
    expect(run.history.map((h) => h.status)).toEqual(['PLAN_DRAFT', 'PLAN_READY', 'GENERATING', 'COMPLETED']);
    expect(run.history[3].note).toBe('all items processed');
    expect(run.updatedAt).toBe(4);
  });

  it('supports pause/resume: GENERATING -> PAUSED -> GENERATING', () => {
    let run = createAutonomousDesignRun({ mode: 'FULL_AUTOPILOT', requestedCount: 5, now: 1 });
    run = transitionAutonomousDesignRun(run, 'PLAN_READY', 2);
    run = transitionAutonomousDesignRun(run, 'GENERATING', 3);
    run = transitionAutonomousDesignRun(run, 'PAUSED', 4);
    run = transitionAutonomousDesignRun(run, 'GENERATING', 5);
    expect(run.status).toBe('GENERATING');
  });

  it('rejects an impossible transition (COMPLETED cannot resume)', () => {
    let run = createAutonomousDesignRun({ mode: 'FULL_AUTOPILOT', requestedCount: 5, now: 1 });
    run = transitionAutonomousDesignRun(run, 'PLAN_READY', 2);
    run = transitionAutonomousDesignRun(run, 'GENERATING', 3);
    run = transitionAutonomousDesignRun(run, 'COMPLETED', 4);
    expect(() => transitionAutonomousDesignRun(run, 'GENERATING', 5)).toThrow(InvalidAutonomousRunTransitionError);
  });

  it('cancel is reachable from every in-flight status', () => {
    for (const status of ['PLAN_DRAFT', 'PLAN_READY', 'GENERATING'] as const) {
      let run = createAutonomousDesignRun({ mode: 'FULL_AUTOPILOT', requestedCount: 5, now: 1 });
      if (status !== 'PLAN_DRAFT') run = transitionAutonomousDesignRun(run, 'PLAN_READY', 2);
      if (status === 'GENERATING') run = transitionAutonomousDesignRun(run, 'GENERATING', 3);
      run = transitionAutonomousDesignRun(run, 'CANCELLED', 4);
      expect(run.status).toBe('CANCELLED');
    }
  });
});

describe('archiveAutonomousDesignRun / unarchiveAutonomousDesignRun', () => {
  it('archives without touching status or history, and a pre-archive-field run reads as not archived', () => {
    let run = createAutonomousDesignRun({ mode: 'FULL_AUTOPILOT', requestedCount: 5, now: 1 });
    expect(isAutonomousRunArchived(run)).toBe(false);

    const legacyRun = { ...run, archived: undefined };
    expect(isAutonomousRunArchived(legacyRun)).toBe(false);

    run = archiveAutonomousDesignRun(run, 100);
    expect(isAutonomousRunArchived(run)).toBe(true);
    expect(run.archivedAt).toBe(100);
    expect(run.status).toBe('PLAN_DRAFT');
    expect(run.history).toHaveLength(1);

    run = unarchiveAutonomousDesignRun(run, 200);
    expect(isAutonomousRunArchived(run)).toBe(false);
    expect(run.archivedAt).toBeNull();
  });
});

describe('isValidAutonomousDesignRun', () => {
  it('rejects malformed values', () => {
    expect(isValidAutonomousDesignRun(null)).toBe(false);
    expect(isValidAutonomousDesignRun({})).toBe(false);
    expect(isValidAutonomousDesignRun({ id: 'x', status: 'NOT_A_STATUS', mode: 'FULL_AUTOPILOT', items: [], history: [] })).toBe(false);
  });
});
