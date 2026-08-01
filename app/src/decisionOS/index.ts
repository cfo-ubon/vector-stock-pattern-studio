// Build 031B — Decision OS barrel. Importing this module guarantees every
// evidence provider and policy is registered (both registration functions
// are idempotent-guarded) before any `runDecision`/`evaluateDecision`
// call — every `adapters/*.ts` file imports from here rather than the
// individual provider/policy modules directly, so registration can never
// be accidentally skipped by an adapter that forgets to import a
// `policies/*.ts` file itself.

import { registerAllEvidenceProviders } from './evidenceProviders/index';
import { registerAllPolicies } from './policies/index';

registerAllEvidenceProviders();
registerAllPolicies();

export * from './domain/types';
export { evaluateDecision, runDecision, runDecisionSync, resetDecisionCounterForTest } from './decisionEngine';
export { recordDecision, loadRecentDecisions, decisionToTimelineEntry } from './decisionTimeline';
export { gatherEvidence, EvidenceCache, classifyFreshness } from './evidenceEngine';
export { computeConfidence } from './confidenceEngine';
export { estimateBusinessImpact } from './businessImpact';
export {
  listAllPolicies,
  listPoliciesByDomain,
  effectivePoliciesFor,
  enabledEffectivePoliciesFor,
  loadEffectivePolicies,
  setPolicyStatus,
  setPolicyPriority,
  clearPolicyOverride,
  type EffectivePolicy,
} from './policyEngine';
