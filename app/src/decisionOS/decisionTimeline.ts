import type { Decision, DecisionTimelineEntry } from './domain/types';
import { recordDecisionTimelineEntry, loadDecisionTimeline } from './storage/decisionTimelineStore';

// Build 031B, Part 8 — Decision Timeline. Turns a `Decision` into its
// immutable audit-history row and persists it. Deliberately a thin
// mapping function (not folded into `decisionEngine.ts` itself) so
// `evaluateDecision` stays pure/testable without IndexedDB, and so a
// caller can choose NOT to record a decision it only used internally
// (e.g. one candidate among many considered while ranking).

let timelineCounter = 0;
function nextTimelineEntryId(now: number): string {
  timelineCounter += 1;
  return `DECTL-${now}-${timelineCounter}`;
}

export function resetDecisionTimelineCounterForTest(): void {
  timelineCounter = 0;
}

export function decisionToTimelineEntry(decision: Decision): DecisionTimelineEntry {
  return {
    id: nextTimelineEntryId(decision.createdAt),
    decisionId: decision.id,
    domain: decision.domain,
    requestedAction: decision.requestedAction,
    recommendedAction: decision.recommendedAction,
    businessImpact: decision.businessImpact,
    confidenceScore: decision.confidence.score,
    confidenceBand: decision.confidence.band,
    policyIds: decision.policyIds,
    evidenceIds: decision.evidenceIds,
    blockedReasons: decision.blockedReasons,
    warnings: decision.warnings,
    explanation: decision.explanation,
    createdAt: decision.createdAt,
  };
}

export async function recordDecision(decision: Decision): Promise<DecisionTimelineEntry> {
  const entry = decisionToTimelineEntry(decision);
  await recordDecisionTimelineEntry(entry);
  return entry;
}

export async function loadRecentDecisions(limit = 100): Promise<DecisionTimelineEntry[]> {
  const all = await loadDecisionTimeline();
  return [...all].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}
