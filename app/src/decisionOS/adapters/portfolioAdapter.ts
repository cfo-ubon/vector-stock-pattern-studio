import type { DecisionRequestContext, EvidenceSourceKind } from '../domain/types';

// Build 031B, Part 10 (+ Hardening pass) — Portfolio Doctor adapter. Turns
// `aiCeo/portfolioDoctor.ts`'s already-computed finding inputs into the
// `DecisionRequestContext.data` shape each relevant evidence provider
// expects — never recomputes any business math itself, only reshapes what
// the caller already derived from real Portfolio/Collection/QA/Autopilot
// records. One context builder per finding so each Decision stays
// independently explainable and independently recorded to the Decision
// Timeline.

export const CATEGORY_CONCENTRATION_SOURCES: EvidenceSourceKind[] = ['portfolio'];
export const EMPTY_COLLECTIONS_SOURCES: EvidenceSourceKind[] = ['collection'];
export const REVIEW_REJECT_SOURCES: EvidenceSourceKind[] = ['qa'];
export const READY_NOT_IMPORTED_SOURCES: EvidenceSourceKind[] = ['pipeline'];
export const SUBMISSION_PREP_SOURCES: EvidenceSourceKind[] = ['portfolio'];

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
        notPreparedForSubmission: null,
        timestamp: now,
      },
    },
  };
}

export function emptyCollectionsContext(emptyCollectionCount: number, now: number): DecisionRequestContext {
  return {
    domain: 'portfolio',
    requestedAction: null,
    now,
    data: {
      collection: { emptyCollectionCount, completeness: null, timestamp: now },
    },
  };
}

export function reviewRejectContext(reviewCount: number, rejectCount: number, totalEvaluated: number, now: number): DecisionRequestContext {
  return {
    domain: 'factory',
    requestedAction: null,
    now,
    data: {
      qa: { reviewCount, rejectCount, totalEvaluated, assetQaPassed: null, timestamp: now },
    },
  };
}

export function readyNotImportedContext(readyNotImportedCount: number, now: number): DecisionRequestContext {
  return {
    domain: 'factory',
    requestedAction: null,
    now,
    data: {
      pipeline: { resumableRunCount: 0, readyNotImportedCount, timestamp: now },
    },
  };
}

export function submissionPrepContext(count: number, total: number, now: number): DecisionRequestContext {
  return {
    domain: 'portfolio',
    requestedAction: null,
    now,
    data: {
      portfolio: {
        totalAssets: total,
        categoryConcentration: null,
        leastCoveredCategory: null,
        oversupplyShare: 0.4,
        notPreparedForSubmission: { count, total },
        timestamp: now,
      },
    },
  };
}
