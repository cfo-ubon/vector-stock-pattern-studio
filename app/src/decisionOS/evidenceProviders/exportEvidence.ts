import type { DecisionRequestContext, EvidenceRecord } from '../domain/types';
import { classifyFreshness } from '../evidenceEngine';

// Build 031B, Part 2 — Export evidence provider. Reads
// `context.data.export`, supplied by the adapter from Build 031A's
// `commercial/exportReadinessDashboard.ts` bucket counts — not consumed
// by any Part 7 policy yet, registered now for the same "reusable"
// reason as `businessGoalsEvidence.ts`.

export interface ExportEvidenceInput {
  readyCount: number;
  blockedCount: number;
  timestamp: number;
}

export function exportEvidenceProvider(context: DecisionRequestContext): EvidenceRecord[] {
  const input = context.data.export as ExportEvidenceInput | undefined;
  if (!input) return [];
  const freshness = classifyFreshness(input.timestamp, context.now);
  return [
    {
      id: 'export:readinessBuckets',
      source: 'export',
      label: 'Export Readiness Dashboard buckets',
      timestamp: input.timestamp,
      freshness,
      completeness: 1,
      confidenceImpact: 0.3,
      missingData: [],
      value: { readyCount: input.readyCount, blockedCount: input.blockedCount },
    },
  ];
}
