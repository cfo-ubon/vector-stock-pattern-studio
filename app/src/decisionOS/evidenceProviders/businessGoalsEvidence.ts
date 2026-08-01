import type { DecisionRequestContext, EvidenceRecord } from '../domain/types';
import { classifyFreshness } from '../evidenceEngine';

// Build 031B, Part 2 — Business Goals evidence provider. Reads
// `context.data.businessGoals`, supplied by the adapter from
// `aiCeo/storage/businessGoalStore.ts`'s real, confirmed goal records —
// not consumed by any Part 7 policy yet, registered now (per the spec's
// "Evidence providers... Business Goals" requirement and this build's own
// "reusable" mandate) so a future policy can depend on it without a new
// provider file.

export interface BusinessGoalsEvidenceInput {
  activeGoalCount: number;
  timestamp: number;
}

export function businessGoalsEvidenceProvider(context: DecisionRequestContext): EvidenceRecord[] {
  const input = context.data.businessGoals as BusinessGoalsEvidenceInput | undefined;
  if (!input) return [];
  const freshness = classifyFreshness(input.timestamp, context.now);
  return [
    {
      id: 'businessGoals:activeCount',
      source: 'businessGoals',
      label: 'Active confirmed business goals',
      timestamp: input.timestamp,
      freshness,
      completeness: 1,
      confidenceImpact: 0.2,
      missingData: [],
      value: { activeGoalCount: input.activeGoalCount },
    },
  ];
}
