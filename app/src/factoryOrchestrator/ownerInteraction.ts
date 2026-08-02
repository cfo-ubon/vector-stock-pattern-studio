import type { OwnerDecisionRecord } from '../productionAutopilot/domain/types';
import { countOwnerDecisionsToday, isWithinDailyDecisionTarget } from '../productionAutopilot/ownerDecision';
import type { OrchestrationRun, OwnerInteractionSummary } from './domain/types';

// Mission 5, Part 6 — Owner Interaction Layer. A summary view composed
// entirely from Production Autopilot's own real `OwnerDecisionRecord`s
// (Mission 4) and this run's own real timestamps — never a second,
// competing decision-tracking system. `countOwnerDecisionsToday`/
// `isWithinDailyDecisionTarget` are reused as-is (same ≤3/day target).

export function summarizeOwnerInteraction(run: OrchestrationRun, ownerDecisionRecords: OwnerDecisionRecord[], now: number = Date.now()): OwnerInteractionSummary {
  const decisionsToday = countOwnerDecisionsToday(ownerDecisionRecords, now);
  const overrideCount = ownerDecisionRecords.filter((d) => d.type === 'APPROVE_OVERRIDE').length;
  const approvalCount = ownerDecisionRecords.filter((d) => d.type === 'APPROVE_SESSION' || d.type === 'APPROVE_EXPORT').length;
  const waitingTimeMs = run.waitingOwnerApprovalSince !== null && run.ownerRespondedAt !== null ? run.ownerRespondedAt - run.waitingOwnerApprovalSince : null;

  return {
    decisionsToday,
    withinDailyTarget: isWithinDailyDecisionTarget(decisionsToday),
    waitingTimeMs,
    overrideCount,
    approvalCount,
    computedAt: now,
  };
}
