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
  /** Build 031C, Part 3 — count of QA-READY assets/tasks awaiting
   * Commercial Packaging, used only by the Factory Priority Engine's
   * "large READY backlog -> packaging first" signal. `undefined` for
   * every other caller (e.g. the Generation Gate), which never sets it. */
  readyBacklogCount?: number;
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
      value: { resumableRunCount: input.resumableRunCount, readyNotImportedCount: input.readyNotImportedCount, readyBacklogCount: input.readyBacklogCount ?? null },
    },
  ];
}
