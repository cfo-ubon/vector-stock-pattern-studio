import type { PolicyDefinition, PolicyEvaluation } from '../domain/types';
import type { PortfolioEvidenceInput } from '../evidenceProviders/portfolioEvidence';

// Build 031B, Part 7 — Portfolio policies. The 3 rules named in the
// spec's own Portfolio list.

function evaluationOf<T>(records: { id: string; value: unknown }[], id: string): T | undefined {
  return records.find((r) => r.id === id)?.value as T | undefined;
}

const avoidOversaturation: PolicyDefinition = {
  id: 'portfolio.avoidOversaturation',
  name: 'Avoid oversaturation',
  description: 'Recommend diversifying away from a category that already dominates the Portfolio.',
  domain: 'portfolio',
  version: 1,
  defaultPriority: 10,
  defaultStatus: 'ENABLED',
  requiredEvidence: ['portfolio'],
  expectedOutcome: 'A single category is never allowed to silently grow past the configured oversupply share without a recommendation to diversify.',
  impactWhenApplies: 'MEDIUM',
  examples: ['"botanical" is 45% of the Portfolio, oversupply threshold is 40% -> recommend diversifying.'],
  evaluate: (evidence): PolicyEvaluation => {
    const concentration = evaluationOf<PortfolioEvidenceInput['categoryConcentration'] & { total: number; oversupplyShare: number }>(evidence.records, 'portfolio:categoryConcentration');
    const evidenceIds = evidence.records.filter((r) => r.id === 'portfolio:categoryConcentration').map((r) => r.id);
    if (!concentration || concentration.share < concentration.oversupplyShare) {
      return { policyId: avoidOversaturation.id, policyName: avoidOversaturation.name, domain: 'portfolio', applies: false, action: null, blockedReason: null, warning: null, detail: 'No category reaches the configured oversupply threshold.', evidenceIds };
    }
    const detail = `"${concentration.maxCategoryId}" is ${Math.round(concentration.share * 100)}% of the Portfolio, at or above the ${Math.round(concentration.oversupplyShare * 100)}% threshold.`;
    return { policyId: avoidOversaturation.id, policyName: avoidOversaturation.name, domain: 'portfolio', applies: true, action: 'diversifyPortfolio', blockedReason: null, warning: detail, detail, evidenceIds };
  },
};

const preferMissingCategories: PolicyDefinition = {
  id: 'portfolio.preferMissingCategories',
  name: 'Prefer missing categories',
  description: 'Recommend targeting whichever category currently has the fewest Portfolio assets.',
  domain: 'portfolio',
  version: 1,
  defaultPriority: 20,
  defaultStatus: 'ENABLED',
  requiredEvidence: ['portfolio'],
  expectedOutcome: 'The least-covered category is always the diversification target, never a guess.',
  impactWhenApplies: 'MEDIUM',
  examples: ['"animal-print" has 0 existing assets, the fewest of any category -> recommend it.'],
  evaluate: (evidence): PolicyEvaluation => {
    const gap = evaluationOf<PortfolioEvidenceInput['leastCoveredCategory']>(evidence.records, 'portfolio:leastCoveredCategory');
    const evidenceIds = evidence.records.filter((r) => r.id === 'portfolio:leastCoveredCategory').map((r) => r.id);
    if (!gap) {
      return { policyId: preferMissingCategories.id, policyName: preferMissingCategories.name, domain: 'portfolio', applies: false, action: null, blockedReason: null, warning: null, detail: 'No category coverage data available.', evidenceIds };
    }
    const detail = `"${gap.categoryId}" has only ${gap.count} existing Portfolio asset(s) — the fewest of any supported category.`;
    return { policyId: preferMissingCategories.id, policyName: preferMissingCategories.name, domain: 'portfolio', applies: true, action: 'diversifyPortfolio', blockedReason: null, warning: null, detail, evidenceIds };
  },
};

const preferCollectionDiversity: PolicyDefinition = {
  id: 'portfolio.preferCollectionDiversity',
  name: 'Prefer collection diversity',
  description: 'Recommend filling empty collections before starting a new one.',
  domain: 'portfolio',
  version: 1,
  defaultPriority: 15,
  defaultStatus: 'ENABLED',
  requiredEvidence: ['collection'],
  expectedOutcome: 'Empty collections are surfaced as a real diversification opportunity.',
  impactWhenApplies: 'MEDIUM',
  examples: ['3 collections have zero assigned patterns -> recommend filling them.'],
  evaluate: (evidence): PolicyEvaluation => {
    const empty = evaluationOf<{ count: number }>(evidence.records, 'collection:emptyCollections');
    const evidenceIds = evidence.records.filter((r) => r.id === 'collection:emptyCollections').map((r) => r.id);
    if (!empty || empty.count === 0) {
      return { policyId: preferCollectionDiversity.id, policyName: preferCollectionDiversity.name, domain: 'portfolio', applies: false, action: null, blockedReason: null, warning: null, detail: 'No empty collections found.', evidenceIds };
    }
    return {
      policyId: preferCollectionDiversity.id,
      policyName: preferCollectionDiversity.name,
      domain: 'portfolio',
      applies: true,
      action: 'fillEmptyCollections',
      blockedReason: null,
      warning: null,
      detail: `${empty.count} collection(s) have no patterns assigned.`,
      evidenceIds,
    };
  },
};

export const PORTFOLIO_POLICIES: PolicyDefinition[] = [avoidOversaturation, preferMissingCategories, preferCollectionDiversity];
