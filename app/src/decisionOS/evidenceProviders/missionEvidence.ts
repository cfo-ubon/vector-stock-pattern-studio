import type { DecisionRequestContext, EvidenceRecord } from '../domain/types';
import { classifyFreshness } from '../evidenceEngine';

// Build 031B, Part 2 — Mission evidence provider. Reads
// `context.data.mission`, supplied by the adapter from
// `autopilot/decisionEngine.ts`'s existing `selectEvidence` output — the
// same "is there a real, currently-scored Market Opportunity or Daily
// Mission" evidence Mission Control's Hero Card and AI CEO's Decision
// Engine already both compute, never a second copy of that selection
// logic.

export interface MissionEvidenceInput {
  hasLiveEvidence: boolean;
  note: string;
  confidenceBand: string;
  timestamp: number;
}

export function missionEvidenceProvider(context: DecisionRequestContext): EvidenceRecord[] {
  const input = context.data.mission as MissionEvidenceInput | undefined;
  if (!input) return [];
  const freshness = classifyFreshness(input.timestamp, context.now);
  return [
    {
      id: 'mission:evidenceAvailable',
      source: 'mission',
      label: 'Live market evidence available',
      timestamp: input.timestamp,
      freshness,
      completeness: 1,
      confidenceImpact: 0.6,
      missingData: [],
      value: { hasLiveEvidence: input.hasLiveEvidence, note: input.note, confidenceBand: input.confidenceBand },
    },
  ];
}
