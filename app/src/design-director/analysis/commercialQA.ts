import type { EvidenceBand } from '../../marketing/domain/evidence';
import { MARKETPLACE_PROFILES } from '../../metadata/marketplaceProfiles';
import { evaluateProductTargets } from '../../collection/productTargets';
import type { CreativeBrief } from '../domain/creativeBrief';
import type { CollectionPlan } from '../domain/collectionPlan';
import type { CollectionCompleteness } from './completeness';
import type { CollectionBalance } from './balance';
import type { CollectionDiversity } from './diversity';

// Build 028B — Module 8: Commercial QA. Evaluates the *whole planned
// collection* (never a single pattern) across 9 dimensions — every score is
// derived from an already-computed real value (Completeness/Balance/
// Diversity's outputs, the brief's own evidence confidence, real
// marketplace-profile/product-target rules), the same "transparent,
// component-by-component" convention `marketing/scoring/opportunityScoring.ts`
// and `collection/collectionScore.ts` already use elsewhere in this app.

const EVIDENCE_BAND_SCORE: Record<EvidenceBand, number> = {
  'very-low': 10,
  low: 30,
  medium: 55,
  high: 80,
  'very-high': 95,
  unknown: 0,
};

export interface QAComponent {
  dimension: string;
  score: number;
  explanation: string;
}

export interface CommercialQAResult {
  components: QAComponent[];
  overall: number;
}

export function computeCommercialQA(
  brief: CreativeBrief,
  plan: CollectionPlan,
  completeness: CollectionCompleteness,
  balance: CollectionBalance,
  diversity: CollectionDiversity,
): CommercialQAResult {
  const components: QAComponent[] = [];

  components.push({
    dimension: 'Commercial Quality',
    score: completeness.percent,
    explanation: `Based on Collection Completeness (${completeness.percent}%): ${completeness.missing.length === 0 ? 'all completeness checks passed.' : `missing ${completeness.missing.join(', ')}.`}`,
  });

  const consistencyScore = Math.round((balance.entries.filter((e) => e.withinTolerance).length / balance.entries.length) * 100);
  components.push({
    dimension: 'Collection Consistency',
    score: consistencyScore,
    explanation: `${balance.entries.filter((e) => e.withinTolerance).length}/${balance.entries.length} pattern-type ratios fall within the balanced-collection tolerance band.`,
  });

  const heroRepetition = diversity.signals.find((s) => s.id === 'heroRepetition');
  const expansionScore = heroRepetition?.available ? Math.max(0, 100 - Math.min(100, (heroRepetition.value ?? 0) * 15)) : 50;
  components.push({
    dimension: 'Portfolio Expansion',
    score: expansionScore,
    explanation: heroRepetition?.available
      ? `${heroRepetition.value} existing portfolio asset(s) already share this theme — fewer matches means more real portfolio expansion.`
      : 'Portfolio repetition data unavailable — defaulting to a neutral score.',
  });

  const knownMarketplace = Object.prototype.hasOwnProperty.call(MARKETPLACE_PROFILES, brief.targetMarketplace);
  const marketplaceFitScore = knownMarketplace ? 90 : brief.targetMarketplace.trim() ? 40 : 0;
  components.push({
    dimension: 'Marketplace Fit',
    score: marketplaceFitScore,
    explanation: knownMarketplace
      ? `"${brief.targetMarketplace}" matches a known marketplace profile in this app (metadata/marketplaceProfiles.ts).`
      : brief.targetMarketplace.trim()
        ? `"${brief.targetMarketplace}" does not match a known marketplace profile — metadata rules cannot be validated automatically.`
        : 'No target marketplace set on the brief yet.',
  });

  const productEvaluations = evaluateProductTargets({
    categoryId: plan.theme.toLowerCase().replace(/\s+/g, ''),
    tileSize: 1500,
    density: 0.5,
    keywordText: `${plan.theme} ${plan.targetProducts.join(' ')}`,
  });
  const suitableIds = new Set<string>(productEvaluations.filter((e) => e.suitable).map((e) => e.id));
  const coveredCount = plan.targetProducts.filter((p) => suitableIds.has(p)).length;
  const productCoverageScore = plan.targetProducts.length > 0 ? Math.round((coveredCount / plan.targetProducts.length) * 100) : 0;
  components.push({
    dimension: 'Product Coverage',
    score: productCoverageScore,
    explanation:
      plan.targetProducts.length > 0
        ? `${coveredCount}/${plan.targetProducts.length} target product(s) are rule-evaluated as a good fit for this theme.`
        : 'No target products set on the plan yet.',
  });

  const variationCheck = completeness.checks.find((c) => c.id === 'variation');
  components.push({
    dimension: 'Variation Quality',
    score: variationCheck?.passed ? 85 : 40,
    explanation: variationCheck?.explanation ?? 'Variation check unavailable.',
  });

  const brandFieldsSet = [brief.heroStyle, brief.colorDirection.length > 0, brief.buyerPersona].filter(Boolean).length;
  const brandConsistencyScore = Math.round((brandFieldsSet / 3) * 100);
  components.push({
    dimension: 'Brand Consistency',
    score: brandConsistencyScore,
    explanation: `${brandFieldsSet}/3 brand-defining brief fields are set (hero style, color direction, buyer persona).`,
  });

  const evidenceScore = EVIDENCE_BAND_SCORE[brief.confidence];
  components.push({
    dimension: 'Evidence Confidence',
    score: evidenceScore,
    explanation: `The brief's evidence confidence is "${brief.confidence}" (inherited from its source Market Opportunity, where applicable).`,
  });

  const overall = Math.round(components.reduce((sum, c) => sum + c.score, 0) / components.length);
  components.push({
    dimension: 'Commercial Readiness',
    score: overall,
    explanation: `Average of the ${components.length} dimensions above.`,
  });

  return { components, overall };
}
