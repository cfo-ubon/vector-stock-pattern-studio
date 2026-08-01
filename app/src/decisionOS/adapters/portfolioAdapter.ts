import type { DecisionRequestContext, EvidenceSourceKind } from '../domain/types';

// Build 031B, Part 10 — Portfolio adapter. Turns
// `aiCeo/portfolioDoctor.ts`'s already-computed category counts into the
// `DecisionRequestContext.data.portfolio` shape `portfolioEvidenceProvider`
// expects — never recomputes the max-category/share math itself, only
// reshapes what the caller already derived from real Portfolio assets.

export const CATEGORY_CONCENTRATION_SOURCES: EvidenceSourceKind[] = ['portfolio'];

export function categoryConcentrationContext(maxCategoryId: string, maxCount: number, totalAssets: number, oversupplyShare: number, now: number): DecisionRequestContext {
  return {
    domain: 'portfolio',
    requestedAction: null,
    now,
    data: {
      portfolio: {
        totalAssets,
        categoryConcentration: { maxCategoryId, maxCount, share: maxCount / totalAssets },
        leastCoveredCategory: null,
        oversupplyShare,
        timestamp: now,
      },
    },
  };
}
