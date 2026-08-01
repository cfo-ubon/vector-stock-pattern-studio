import type { DecisionRequestContext, EvidenceSourceKind } from '../domain/types';

// Build 031B Hardening — Commercial Pipeline adapter. Turns an already-
// computed `CommercialReadinessReport` (Build 031A's `readinessEngine.ts`)
// into the `DecisionRequestContext.data` shape the Commercial evidence
// provider (plus the reused `qa` evidence provider) expects — never
// recomputes any check itself, only reshapes what the caller already
// derived.

export const COMMERCIAL_NEXT_ACTION_SOURCES: EvidenceSourceKind[] = ['commercial', 'qa'];

export function commercialNextActionContext(
  score: number,
  threshold: number,
  failingChecksCount: number,
  hasSeo: boolean | null,
  collectionAssigned: boolean | null,
  qaPassed: boolean | null,
  assetId: string,
  now: number,
): DecisionRequestContext {
  return {
    domain: 'commercial',
    requestedAction: null,
    now,
    data: {
      commercial: {
        readiness: { assetId, score, threshold, failingChecksCount },
        hasSeo,
        recentPackage: null,
        collectionAssigned,
        timestamp: now,
      },
      qa: { reviewCount: 0, rejectCount: 0, totalEvaluated: qaPassed === null ? 0 : 1, assetQaPassed: qaPassed, timestamp: now },
    },
  };
}
