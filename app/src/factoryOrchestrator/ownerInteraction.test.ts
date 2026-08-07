import { describe, it, expect } from 'vitest';
import { summarizeOwnerInteraction } from './ownerInteraction';
import { createOrchestrationRun, transitionOrchestrationRun } from './orchestrationRun';
import { recordOwnerDecision } from '../productionAutopilot/ownerDecision';
import { DAILY_OWNER_DECISION_TARGET } from '../productionAutopilot/domain/types';

const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);

describe('summarizeOwnerInteraction', () => {
  it('reports honest zeros/nulls with no records and no run activity', () => {
    const run = createOrchestrationRun(NOW);
    const summary = summarizeOwnerInteraction(run, [], NOW);
    expect(summary.decisionsToday).toBe(0);
    expect(summary.withinDailyTarget).toBe(true);
    expect(summary.waitingTimeMs).toBeNull();
    expect(summary.overrideCount).toBe(0);
    expect(summary.approvalCount).toBe(0);
  });

  it('counts overrides/approvals from real OwnerDecisionRecord types', () => {
    const run = createOrchestrationRun(NOW);
    const records = [recordOwnerDecision('APPROVE_SESSION', null, 1000, NOW), recordOwnerDecision('APPROVE_OVERRIDE', null, 2000, NOW), recordOwnerDecision('APPROVE_EXPORT', null, 1500, NOW)];
    const summary = summarizeOwnerInteraction(run, records, NOW);
    expect(summary.decisionsToday).toBe(3);
    expect(summary.overrideCount).toBe(1);
    expect(summary.approvalCount).toBe(2);
  });

  it('flags withinDailyTarget false once the disclosed target is exceeded', () => {
    const run = createOrchestrationRun(NOW);
    const records = Array.from({ length: DAILY_OWNER_DECISION_TARGET + 1 }, () => recordOwnerDecision('APPROVE_SESSION', null, 1000, NOW));
    const summary = summarizeOwnerInteraction(run, records, NOW);
    expect(summary.withinDailyTarget).toBe(false);
  });

  it('computes real waitingTimeMs from the run\'s own timestamps once both exist', () => {
    let run = createOrchestrationRun(NOW);
    run = transitionOrchestrationRun(run, 'PREPARING', NOW + 1);
    run = transitionOrchestrationRun(run, 'PREFLIGHT', NOW + 2);
    run = transitionOrchestrationRun(run, 'PLANNING', NOW + 3);
    run = transitionOrchestrationRun(run, 'WAITING_OWNER_APPROVAL', NOW + 4);
    run = transitionOrchestrationRun(run, 'RUNNING', NOW + 604);
    const summary = summarizeOwnerInteraction(run, [], NOW + 700);
    expect(summary.waitingTimeMs).toBe(600);
  });
});
