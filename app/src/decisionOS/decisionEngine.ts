import type { Decision, DecisionRequestContext, EvidenceBundle, EvidenceSourceKind, PolicyDefinition, PolicyEvaluation } from './domain/types';
import type { EffectivePolicy } from './policyEngine';
import { computeConfidence } from './confidenceEngine';
import { estimateBusinessImpact } from './businessImpact';
import { gatherEvidence, EvidenceCache } from './evidenceEngine';
import { effectivePoliciesFor, loadEffectivePolicies } from './policyEngine';

// Build 031B, Part 4, 6 & 11 — Decision Engine. The one function every AI
// module in the app now calls for its core business decision (Part 10).
// `evaluateDecision` is pure (no I/O, deterministic given its inputs) so
// it is fully unit-testable without IndexedDB; `runDecision` is the async
// convenience wrapper real callers use (gathers evidence via
// `evidenceEngine.ts`, loads effective policies via `policyEngine.ts`,
// optionally records to the Decision Timeline).
//
// Part 11 (Safety): this function NEVER guesses when it lacks evidence —
// see the `Not enough evidence` branch below, the one place a `Decision`
// is allowed to come back with `recommendedAction: null` and
// `confidence.band: 'unknown'` even though a `requestedAction` was asked
// about.

let decisionCounter = 0;
function nextDecisionId(now: number): string {
  decisionCounter += 1;
  return `DEC-${now}-${decisionCounter}`;
}

/** Test-only: `evaluateDecision` is pure and deterministic given its
 * inputs, but `Decision.id` embeds a monotonic counter for uniqueness —
 * reset it between test files so IDs stay predictable in assertions that
 * check for a specific decision count from zero. */
export function resetDecisionCounterForTest(): void {
  decisionCounter = 0;
}

const CONFIDENCE_FLOOR_FOR_ANY_ANSWER = 15;

function runPolicies(effectivePolicies: EffectivePolicy[], evidence: EvidenceBundle, context: DecisionRequestContext): { policy: PolicyDefinition; evaluation: PolicyEvaluation }[] {
  // Sorted defensively here (not just trusted from the caller) so a
  // lower-priority policy can never win by accident regardless of the
  // order `effectivePolicies` arrives in — `policyEngine.ts`'s own
  // `effectivePoliciesFor` already sorts, but `evaluateDecision` is a
  // public, directly-testable function and must be correct on its own.
  const sorted = [...effectivePolicies].sort((a, b) => a.priority - b.priority);
  return sorted.map(({ definition }) => ({ policy: definition, evaluation: definition.evaluate(evidence, context) }));
}

/** Pure — the actual Policy + Evidence -> Confidence -> Decision
 * pipeline. */
export function evaluateDecision(effectivePolicies: EffectivePolicy[], evidence: EvidenceBundle, context: DecisionRequestContext): Decision {
  const results = runPolicies(effectivePolicies, evidence, context);
  const evaluations = results.map((r) => r.evaluation);
  const applying = results.filter((r) => r.evaluation.applies);

  const blockedReasons = applying.filter((r) => r.evaluation.blockedReason !== null).map((r) => r.evaluation.blockedReason as string);
  const warnings = applying.filter((r) => r.evaluation.warning !== null).map((r) => r.evaluation.warning as string);

  const candidates = applying.filter((r) => r.evaluation.action !== null);
  const isBlocked = blockedReasons.length > 0 && !context.allowOverride;

  const confidence = computeConfidence(evidence, evaluations);

  const explanation: string[] = [];
  let recommendedAction: string | null = null;
  let firingPolicies: PolicyDefinition[] = [];
  let alternative: Decision['alternative'] = null;

  if (isBlocked) {
    explanation.push(`Blocked by ${blockedReasons.length} polic${blockedReasons.length === 1 ? 'y' : 'ies'}: ${blockedReasons.join(' ')}`);
  } else if (evidence.records.length === 0 || confidence.score < CONFIDENCE_FLOOR_FOR_ANY_ANSWER) {
    explanation.push('Not enough evidence to make a supported recommendation — reporting Unknown rather than guessing.');
  } else if (candidates.length > 0) {
    recommendedAction = candidates[0].evaluation.action;
    firingPolicies = [candidates[0].policy];
    explanation.push(`Recommended by "${candidates[0].policy.name}": ${candidates[0].evaluation.detail}`);
    const second = candidates.find((c) => c.evaluation.action !== recommendedAction);
    if (second) alternative = { action: second.evaluation.action as string, reason: second.evaluation.detail };
  } else if (context.requestedAction !== null) {
    recommendedAction = context.requestedAction;
    explanation.push('No policy objected to the requested action, and no policy proposed a different one.');
  } else {
    explanation.push('No policy in this domain had an applicable recommendation for the current evidence.');
  }

  if (isBlocked && context.requestedAction) explanation.push(`Requested action "${context.requestedAction}" was refused.`);
  if (context.allowOverride && blockedReasons.length > 0) explanation.push('Blocking condition(s) were present but explicitly overridden by the caller.');

  const businessImpactResult = estimateBusinessImpact(firingPolicies, evaluations, confidence);

  const policyIds = [...new Set(evaluations.filter((e) => e.applies).map((e) => e.policyId))];
  const evidenceIds = [...new Set(evidence.records.map((r) => r.id))];

  return {
    id: nextDecisionId(context.now),
    domain: context.domain,
    requestedAction: context.requestedAction,
    recommendedAction,
    businessImpact: businessImpactResult.impact,
    businessImpactReasons: businessImpactResult.reasons,
    alternative,
    blockedReasons,
    warnings,
    policyIds,
    evidenceIds,
    confidence,
    explanation: [...explanation, ...confidence.explanation],
    createdAt: context.now,
  };
}

export interface RunDecisionOptions {
  cache?: EvidenceCache;
}

/** Async convenience: loads effective policies + gathers evidence for
 * exactly the union of what those policies declare they need, then calls
 * the pure `evaluateDecision`. Does NOT record to the Decision Timeline
 * itself (see `decisionTimeline.ts`'s `recordDecision` for that) so a
 * caller evaluating many candidates (e.g. ranking every asset) can choose
 * to only persist the ones it actually surfaces. */
export async function runDecision(context: DecisionRequestContext, options: RunDecisionOptions = {}): Promise<Decision> {
  const effectivePolicies = await loadEffectivePolicies(context.domain);
  const requiredSources = [...new Set(effectivePolicies.flatMap((p) => p.definition.requiredEvidence))];
  const evidence = gatherEvidence(context, requiredSources, options.cache);
  return evaluateDecision(effectivePolicies, evidence, context);
}

/** Synchronous sibling of `runDecision` for callers that are themselves
 * synchronous/pure by contract (e.g. `aiCeo/decisionEngine.ts`'s
 * `rankAiCeoRecommendations`, documented as producing the same output for
 * the same input with no I/O). Skips `loadEffectivePolicies`'s IndexedDB
 * read of Part 9 policy overrides and evaluates against each policy's own
 * code-defined default status/priority instead — Part 9 overrides remain
 * fully available to any caller willing to be async (`runDecision`
 * above); this sync path exists so adopting the Decision Engine never
 * forces a previously-synchronous, directly-testable function to become
 * async just to reach it. */
export function runDecisionSync(context: DecisionRequestContext, requiredSources: EvidenceSourceKind[]): Decision {
  const effectivePolicies = effectivePoliciesFor(context.domain, []);
  const evidence = gatherEvidence(context, requiredSources);
  return evaluateDecision(effectivePolicies, evidence, context);
}
