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
      value: { ...input.categoryConcentration, total: input.totalAssets, oversupplyShare: input.oversupplyShare },
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
  ];
}
