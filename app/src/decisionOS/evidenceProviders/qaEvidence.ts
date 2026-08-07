import type { DecisionRequestContext, EvidenceRecord } from '../domain/types';
import { classifyFreshness } from '../evidenceEngine';

// Build 031B, Part 2 — QA evidence provider. Reads `context.data.qa`,
// supplied by the adapter from real `QualitySnapshot` records
// (`catalog/quality/qualitySnapshotStore.ts`) — the same REVIEW/REJECT
// counting `aiCeo/portfolioDoctor.ts`'s `reviewRejectFinding` already
// does, and the same per-asset `decision === 'READY'` check
// `commercial/readinessEngine.ts`'s `qaPassed` check already does.

export interface QaEvidenceInput {
  reviewCount: number;
  rejectCount: number;
  totalEvaluated: number;
  assetQaPassed: boolean | null;
  timestamp: number;
}

export function qaEvidenceProvider(context: DecisionRequestContext): EvidenceRecord[] {
  const input = context.data.qa as QaEvidenceInput | undefined;
  if (!input) return [];
  const freshness = classifyFreshness(input.timestamp, context.now);
  return [
    {
      id: 'qa:reviewRejectCounts',
      source: 'qa',
      label: 'REVIEW/REJECT counts',
      timestamp: input.timestamp,
      freshness,
      completeness: input.totalEvaluated > 0 ? 1 : 0,
      confidenceImpact: 0.5,
      missingData: input.totalEvaluated > 0 ? [] : ['qualitySnapshots'],
      value: { reviewCount: input.reviewCount, rejectCount: input.rejectCount, totalEvaluated: input.totalEvaluated },
    },
    {
      id: 'qa:assetQaStatus',
      source: 'qa',
      label: 'Asset QA status',
      timestamp: input.timestamp,
      freshness,
      completeness: input.assetQaPassed === null ? 0 : 1,
      confidenceImpact: 0.5,
      missingData: input.assetQaPassed === null ? ['qualitySnapshot'] : [],
      value: { passed: input.assetQaPassed },
    },
  ];
}
