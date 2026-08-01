import type { DecisionRequestContext, EvidenceRecord } from '../domain/types';
import { classifyFreshness } from '../evidenceEngine';

// Build 031B, Part 2 — Portfolio evidence provider. Reads only
// `context.data.portfolio` — a caller-supplied, already-computed payload
// (adapters reuse `autopilot/decisionEngine.ts`'s existing
// `leastCoveredCategory` and the same category-share math
// `aiCeo/portfolioDoctor.ts` already had, rather than this provider
// re-deriving it from raw `PortfolioAsset[]`). Never fabricates a
// category or count that wasn't actually supplied.

export interface PortfolioEvidenceInput {
  totalAssets: number;
  categoryConcentration: { maxCategoryId: string; maxCount: number; share: number } | null;
  leastCoveredCategory: { categoryId: string; count: number } | null;
  oversupplyShare: number;
  /** Build 031B Hardening — Portfolio Doctor's "not prepared for
   * submission" count (assets still in DRAFT/READY_FOR_REVIEW). `null`
   * when the caller has no submission-prep data to offer, never a
   * fabricated 0. */
  notPreparedForSubmission: { count: number; total: number } | null;
  timestamp: number;
}

export function portfolioEvidenceProvider(context: DecisionRequestContext): EvidenceRecord[] {
  const input = context.data.portfolio as PortfolioEvidenceInput | undefined;
  if (!input) return [];
  const freshness = classifyFreshness(input.timestamp, context.now);
  const missingData: string[] = [];
  if (input.totalAssets === 0) missingData.push('portfolioAssets');
  if (!input.categoryConcentration) missingData.push('categoryConcentration');
  if (!input.leastCoveredCategory) missingData.push('leastCoveredCategory');

  return [
    {
      id: 'portfolio:categoryConcentration',
      source: 'portfolio',
      label: 'Portfolio category concentration',
      timestamp: input.timestamp,
      freshness,
      completeness: input.categoryConcentration ? 1 : 0,
      confidenceImpact: 0.6,
      missingData: input.categoryConcentration ? [] : ['categoryConcentration'],
      // Build 031B Hardening — spreading a `null` `categoryConcentration`
      // used to produce a truthy `{ total, oversupplyShare }` object with
      // `share: undefined`, which fooled `avoidOversaturation`'s `!concentration`
      // null check (an `undefined < number` comparison is always `false`,
      // so the policy fired as if a category *were* concentrated). Stay
      // `null` when there's genuinely no concentration data.
      value: input.categoryConcentration ? { ...input.categoryConcentration, total: input.totalAssets, oversupplyShare: input.oversupplyShare } : null,
    },
    {
      id: 'portfolio:leastCoveredCategory',
      source: 'portfolio',
      label: 'Least-covered Portfolio category',
      timestamp: input.timestamp,
      freshness,
      completeness: input.leastCoveredCategory ? 1 : 0,
      confidenceImpact: 0.4,
      missingData: input.leastCoveredCategory ? [] : ['leastCoveredCategory'],
      value: input.leastCoveredCategory,
    },
    {
      id: 'portfolio:hasAnyAssets',
      source: 'portfolio',
      label: 'Portfolio has any assets',
      timestamp: input.timestamp,
      freshness,
      completeness: 1,
      confidenceImpact: 0.2,
      missingData,
      value: { hasPortfolio: input.totalAssets > 0, totalAssets: input.totalAssets },
    },
    {
      id: 'portfolio:notPreparedForSubmission',
      source: 'portfolio',
      label: 'Portfolio assets not yet prepared for submission',
      timestamp: input.timestamp,
      freshness,
      completeness: input.notPreparedForSubmission ? 1 : 0,
      confidenceImpact: 0.3,
      missingData: input.notPreparedForSubmission ? [] : ['notPreparedForSubmission'],
      value: input.notPreparedForSubmission,
    },
  ];
}
