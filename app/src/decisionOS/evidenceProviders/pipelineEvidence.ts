import type { DecisionRequestContext, EvidenceRecord } from '../domain/types';
import { classifyFreshness } from '../evidenceEngine';

// Build 031B, Part 2 — Pipeline evidence provider. Reads
// `context.data.pipeline`, supplied by the adapter from real
// `AutonomousDesignRun` records (`autopilot/storage/autonomousDesignRunStore.ts`)
// — the same "resumable run" / "READY not imported" counting
// `aiCeo/decisionEngine.ts`'s `buildContinueRunRecommendation`/
// `countReadyNotImported` already do.

export interface PipelineEvidenceInput {
  resumableRunCount: number;
  readyNotImportedCount: number;
  timestamp: number;
}

export function pipelineEvidenceProvider(context: DecisionRequestContext): EvidenceRecord[] {
  const input = context.data.pipeline as PipelineEvidenceInput | undefined;
  if (!input) return [];
  const freshness = classifyFreshness(input.timestamp, context.now);
  return [
    {
      id: 'pipeline:unfinishedWork',
      source: 'pipeline',
      label: 'Unfinished Autopilot work',
      timestamp: input.timestamp,
      freshness,
      completeness: 1,
      confidenceImpact: 0.5,
      missingData: [],
      value: { resumableRunCount: input.resumableRunCount, readyNotImportedCount: input.readyNotImportedCount },
    },
  ];
}
