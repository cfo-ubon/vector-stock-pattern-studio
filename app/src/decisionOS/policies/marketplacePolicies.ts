import type { PolicyDefinition, PolicyEvaluation } from '../domain/types';
import type { MarketplaceEvidenceInput } from '../evidenceProviders/marketplaceEvidence';
import type { MissionEvidenceInput } from '../evidenceProviders/missionEvidence';

// Build 031B, Part 7 — Marketplace policies. "Use verified marketplace
// profiles only" (the spec's own Marketplace list) plus 3 production-
// targeting preference policies from the spec's top-level Examples
// section ("Prefer Portfolio Gap", "Prefer Evergreen when demand
// unknown") — these three together are the exact same 3-way fallback
// `aiCeo/decisionEngine.ts`'s `rankAiCeoRecommendations` used to resolve
// with its own if/else chain (Section 1's audit); expressing it as
// prioritized policies here is what lets that module delegate to the
// Decision Engine instead (see `adapters/marketplaceAdapter.ts`).

function evaluationOf<T>(records: { id: string; value: unknown }[], id: string): T | undefined {
  return records.find((r) => r.id === id)?.value as T | undefined;
}

const useVerifiedProfilesOnly: PolicyDefinition = {
  id: 'marketplace.useVerifiedProfilesOnly',
  name: 'Use verified marketplace profiles only',
  description: 'Warn (never silently claim readiness) when the target marketplace profile is not yet verified.',
  domain: 'marketplace',
  version: 1,
  defaultPriority: 10,
  defaultStatus: 'ENABLED',
  requiredEvidence: ['marketplace'],
  expectedOutcome: 'A future/unverified marketplace profile is always flagged, matching `packageBuilder.ts`\'s own NEEDS_VERIFICATION status — never presented as equivalent to a verified one.',
  impactWhenApplies: 'LOW',
  examples: ['Target marketplace profile has contributorUrlVerified: false -> warn.'],
  evaluate: (evidence): PolicyEvaluation => {
    const profile = evaluationOf<MarketplaceEvidenceInput['profile']>(evidence.records, 'marketplace:profileVerification');
    const evidenceIds = evidence.records.filter((r) => r.id === 'marketplace:profileVerification').map((r) => r.id);
    if (!profile || (!profile.future && profile.contributorUrlVerified)) {
      return { policyId: useVerifiedProfilesOnly.id, policyName: useVerifiedProfilesOnly.name, domain: 'marketplace', applies: false, action: null, blockedReason: null, warning: null, detail: 'Marketplace profile is verified, or no profile evidence supplied.', evidenceIds };
    }
    const reason = profile.future ? `"${profile.marketplaceId}" is not yet a verified, ready-to-submit marketplace.` : `"${profile.marketplaceId}"'s contributor portal link has not been manually verified.`;
    return { policyId: useVerifiedProfilesOnly.id, policyName: useVerifiedProfilesOnly.name, domain: 'marketplace', applies: true, action: null, blockedReason: null, warning: reason, detail: reason, evidenceIds };
  },
};

const preferLiveMarketEvidence: PolicyDefinition = {
  id: 'marketplace.preferLiveMarketEvidence',
  name: 'Prefer live market evidence',
  description: 'When a real, currently-scored Market Opportunity or Daily Mission exists, target it first.',
  domain: 'marketplace',
  version: 1,
  defaultPriority: 5,
  defaultStatus: 'ENABLED',
  requiredEvidence: ['mission'],
  expectedOutcome: 'Live evidence always outranks the Portfolio Gap and Evergreen fallbacks when it exists.',
  impactWhenApplies: 'HIGH',
  examples: ['A scored Market Opportunity exists -> target it.'],
  evaluate: (evidence): PolicyEvaluation => {
    const mission = evaluationOf<MissionEvidenceInput>(evidence.records, 'mission:evidenceAvailable');
    const evidenceIds = evidence.records.filter((r) => r.id === 'mission:evidenceAvailable').map((r) => r.id);
    if (!mission || !mission.hasLiveEvidence) {
      return { policyId: preferLiveMarketEvidence.id, policyName: preferLiveMarketEvidence.name, domain: 'marketplace', applies: false, action: null, blockedReason: null, warning: null, detail: 'No live market evidence exists.', evidenceIds };
    }
    return { policyId: preferLiveMarketEvidence.id, policyName: preferLiveMarketEvidence.name, domain: 'marketplace', applies: true, action: 'targetMarketEvidence', blockedReason: null, warning: null, detail: mission.note, evidenceIds };
  },
};

const preferPortfolioGap: PolicyDefinition = {
  id: 'marketplace.preferPortfolioGap',
  name: 'Prefer Portfolio Gap',
  description: 'When no live market evidence exists but the Portfolio has real assets, target the least-covered category instead of guessing.',
  domain: 'marketplace',
  version: 1,
  defaultPriority: 10,
  defaultStatus: 'ENABLED',
  requiredEvidence: ['mission', 'portfolio'],
  expectedOutcome: 'Portfolio Gap is the second choice, used only when live evidence is unavailable.',
  impactWhenApplies: 'MEDIUM',
  examples: ['No Market Opportunity is scored, but 40 Portfolio assets exist -> target the least-covered category.'],
  evaluate: (evidence): PolicyEvaluation => {
    const mission = evaluationOf<MissionEvidenceInput>(evidence.records, 'mission:evidenceAvailable');
    const hasPortfolio = evaluationOf<{ hasPortfolio: boolean }>(evidence.records, 'portfolio:hasAnyAssets');
    const evidenceIds = evidence.records.filter((r) => r.id === 'mission:evidenceAvailable' || r.id === 'portfolio:hasAnyAssets').map((r) => r.id);
    if (!mission || mission.hasLiveEvidence || !hasPortfolio || !hasPortfolio.hasPortfolio) {
      return { policyId: preferPortfolioGap.id, policyName: preferPortfolioGap.name, domain: 'marketplace', applies: false, action: null, blockedReason: null, warning: null, detail: 'Live evidence exists, or Portfolio has no assets yet.', evidenceIds };
    }
    return {
      policyId: preferPortfolioGap.id,
      policyName: preferPortfolioGap.name,
      domain: 'marketplace',
      applies: true,
      action: 'targetPortfolioGap',
      blockedReason: null,
      warning: null,
      detail: 'No live market evidence exists — targeting the Portfolio\'s own least-covered category.',
      evidenceIds,
    };
  },
};

const preferEvergreenWhenDemandUnknown: PolicyDefinition = {
  id: 'marketplace.preferEvergreenWhenDemandUnknown',
  name: 'Prefer Evergreen when demand unknown',
  description: 'When neither live market evidence nor a real Portfolio exists, fall back to a steady, non-seasonal category rather than guessing.',
  domain: 'marketplace',
  version: 1,
  defaultPriority: 15,
  defaultStatus: 'ENABLED',
  requiredEvidence: ['mission', 'portfolio'],
  expectedOutcome: 'The last-resort fallback is always a real, generator-supported evergreen category, never a fabricated trend claim.',
  impactWhenApplies: 'LOW',
  examples: ['No Market Snapshot and no Portfolio data exist yet -> use an evergreen default.'],
  evaluate: (evidence): PolicyEvaluation => {
    const mission = evaluationOf<MissionEvidenceInput>(evidence.records, 'mission:evidenceAvailable');
    const hasPortfolio = evaluationOf<{ hasPortfolio: boolean }>(evidence.records, 'portfolio:hasAnyAssets');
    const evidenceIds = evidence.records.filter((r) => r.id === 'mission:evidenceAvailable' || r.id === 'portfolio:hasAnyAssets').map((r) => r.id);
    if (!mission || mission.hasLiveEvidence || (hasPortfolio && hasPortfolio.hasPortfolio)) {
      return { policyId: preferEvergreenWhenDemandUnknown.id, policyName: preferEvergreenWhenDemandUnknown.name, domain: 'marketplace', applies: false, action: null, blockedReason: null, warning: null, detail: 'Live evidence or Portfolio Gap evidence takes precedence.', evidenceIds };
    }
    return {
      policyId: preferEvergreenWhenDemandUnknown.id,
      policyName: preferEvergreenWhenDemandUnknown.name,
      domain: 'marketplace',
      applies: true,
      action: 'targetEvergreen',
      blockedReason: null,
      warning: null,
      detail: 'No verified Market Opportunity and no Portfolio data exist yet — using a category with steady, non-seasonal demand.',
      evidenceIds,
    };
  },
};

export const MARKETPLACE_POLICIES: PolicyDefinition[] = [useVerifiedProfilesOnly, preferLiveMarketEvidence, preferPortfolioGap, preferEvergreenWhenDemandUnknown];
