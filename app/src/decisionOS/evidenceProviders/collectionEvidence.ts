import type { DecisionRequestContext, EvidenceRecord } from '../domain/types';
import { classifyFreshness } from '../evidenceEngine';

// Build 031B, Part 2 — Collection evidence provider. Reads
// `context.data.collection`, supplied by the adapter from
// `catalog/dashboard/dashboardSnapshot.ts`'s own `collectionAnalytics`
// (empty collections) and `commercial/collectionCompleteness.ts` (role
// completeness) — never recomputed here.

export interface CollectionEvidenceInput {
  emptyCollectionCount: number;
  completeness: { collectionId: string; roleTrackingAvailable: boolean; missingRoles: string[] } | null;
  timestamp: number;
}

export function collectionEvidenceProvider(context: DecisionRequestContext): EvidenceRecord[] {
  const input = context.data.collection as CollectionEvidenceInput | undefined;
  if (!input) return [];
  const freshness = classifyFreshness(input.timestamp, context.now);
  return [
    {
      id: 'collection:emptyCollections',
      source: 'collection',
      label: 'Empty collections',
      timestamp: input.timestamp,
      freshness,
      completeness: 1,
      confidenceImpact: 0.3,
      missingData: [],
      value: { count: input.emptyCollectionCount },
    },
    {
      id: 'collection:completeness',
      source: 'collection',
      label: 'Collection role completeness',
      timestamp: input.timestamp,
      freshness,
      completeness: input.completeness && input.completeness.roleTrackingAvailable ? 1 : input.completeness ? 0.5 : 0,
      confidenceImpact: 0.5,
      missingData: input.completeness ? [] : ['completeness'],
      value: input.completeness,
    },
  ];
}
