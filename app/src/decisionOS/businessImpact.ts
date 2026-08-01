import type { BusinessImpact, ConfidenceResult, PolicyDefinition, PolicyEvaluation } from './domain/types';

// Build 031B, Part 5 — Business Impact. A fixed qualitative enum, never a
// revenue estimate (the spec is explicit: "Never estimate revenue").
// Impact always traces back to which policy actually fired
// (`PolicyDefinition.impactWhenApplies`, itself data — see
// `policies/*.ts`) and is honestly downgraded when confidence is low,
// matching Part 3's "never fabricate confidence" rule extended to impact:
// a decision the system is not sure about cannot honestly claim "Very
// High" impact.

const IMPACT_ORDER: BusinessImpact[] = ['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];

function rankOf(impact: BusinessImpact): number {
  return IMPACT_ORDER.indexOf(impact);
}

function downgrade(impact: BusinessImpact, steps: number): BusinessImpact {
  const rank = Math.max(0, rankOf(impact) - steps);
  return IMPACT_ORDER[rank];
}

export interface BusinessImpactResult {
  impact: BusinessImpact;
  reasons: string[];
}

/** `firingPolicies` — the `PolicyDefinition`s whose evaluation produced
 * the Decision's `recommendedAction` (see `decisionEngine.ts`). Takes the
 * highest declared impact among them (a decision satisfying multiple
 * policies at once is at least as impactful as its strongest one), then
 * downgrades by one tier per confidence band below "high". */
export function estimateBusinessImpact(firingPolicies: PolicyDefinition[], evaluations: PolicyEvaluation[], confidence: ConfidenceResult): BusinessImpactResult {
  if (firingPolicies.length === 0) {
    return { impact: 'UNKNOWN', reasons: ['No policy produced a recommended action — impact cannot be estimated.'] };
  }

  const strongest = firingPolicies.reduce<PolicyDefinition>((best, p) => (rankOf(p.impactWhenApplies) > rankOf(best.impactWhenApplies) ? p : best), firingPolicies[0]);

  // Unknown confidence is not "one tier worse than low" — it means the
  // system has no supported basis for a rating at all, so it must report
  // UNKNOWN rather than a downgraded-but-still-specific guess like LOW.
  if (confidence.band === 'unknown') {
    return {
      impact: 'UNKNOWN',
      reasons: [`"${strongest.name}" declares ${strongest.impactWhenApplies} impact when it applies, but decision confidence is "unknown" — impact cannot be honestly estimated.`],
    };
  }

  const downgradeSteps = confidence.band === 'high' ? 0 : confidence.band === 'medium' ? 1 : 2;
  const impact = downgrade(strongest.impactWhenApplies, downgradeSteps);

  const reasons: string[] = [`"${strongest.name}" declares ${strongest.impactWhenApplies} impact when it applies.`];
  if (downgradeSteps > 0) reasons.push(`Downgraded to ${impact} because decision confidence is "${confidence.band}".`);

  const applyingDetails = evaluations.filter((e) => e.applies && firingPolicies.some((p) => p.id === e.policyId)).map((e) => e.detail);
  reasons.push(...applyingDetails);

  return { impact, reasons };
}
