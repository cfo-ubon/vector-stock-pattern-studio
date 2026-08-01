import type { Decision } from '../decisionOS/domain/types';
import type { DecisionTrace } from './domain/types';

/** Build 031B Hardening (Section 7) — reshapes a real `Decision` into the
 * small trace object every visible recommendation/finding/card can carry,
 * so a screen can show "why" without reaching into the Decision Timeline
 * itself. Never fabricates a value the `Decision` doesn't already have.
 * Shared by every module (AI CEO, Portfolio Doctor, Business Coach,
 * Commercial Pipeline, Mission Control, Autopilot) that routes a visible
 * recommendation through Decision OS. */
export function decisionTraceFrom(decision: Decision): DecisionTrace {
  return {
    decisionId: decision.id,
    domain: decision.domain,
    policyIds: decision.policyIds,
    evidenceIds: decision.evidenceIds,
    confidenceScore: decision.confidence.score,
    confidenceBand: decision.confidence.band,
    businessImpact: decision.businessImpact,
    alternative: decision.alternative,
    blockedReasons: decision.blockedReasons,
  };
}
