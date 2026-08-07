import { registerPolicies } from '../policyEngine';
import { FACTORY_POLICIES } from './factoryPolicies';
import { PORTFOLIO_POLICIES } from './portfolioPolicies';
import { MARKETPLACE_POLICIES } from './marketplacePolicies';
import { COMMERCIAL_POLICIES } from './commercialPolicies';

// Build 031B, Part 7 & 9 — registers the full initial policy set (15
// policies across 4 domains). Idempotent-guarded the same way
// `evidenceProviders/index.ts` is, since `policyEngine.ts`'s
// `registerPolicy` throws on a duplicate id.

let registered = false;

export function registerAllPolicies(): void {
  if (registered) return;
  registerPolicies(FACTORY_POLICIES);
  registerPolicies(PORTFOLIO_POLICIES);
  registerPolicies(MARKETPLACE_POLICIES);
  registerPolicies(COMMERCIAL_POLICIES);
  registered = true;
}

export function resetPolicyRegistrationForTest(): void {
  registered = false;
}

export { FACTORY_POLICIES, PORTFOLIO_POLICIES, MARKETPLACE_POLICIES, COMMERCIAL_POLICIES };
