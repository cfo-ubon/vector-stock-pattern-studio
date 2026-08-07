import type { DecisionRequestContext, EvidenceSourceKind } from '../domain/types';

// Build 031B Hardening — Autopilot Generation Gate adapter. Turns
// already-computed pipeline/QA counts (the same ones `aiCeo/decisionEngine.ts`'s
// `buildContinueRunRecommendation`/`countReadyNotImported` and
// `aiCeo/portfolioDoctor.ts`'s `reviewRejectFinding` already derive from real
// `AutonomousDesignRun`/`QualitySnapshot` records) into the
// `DecisionRequestContext.data` shape the `factory.completeExistingWorkFirst`/
// `factory.repairBeforeGenerate` policies expect — never recomputes them.

export const GENERATION_GATE_SOURCES: EvidenceSourceKind[] = ['pipeline', 'qa'];

export function generationGateContext(resumableRunCount: number, readyNotImportedCount: number, reviewCount: number, rejectCount: number, totalEvaluated: number, now: number): DecisionRequestContext {
  return {
    domain: 'factory',
    requestedAction: 'generate',
    now,
    data: {
      pipeline: { resumableRunCount, readyNotImportedCount, timestamp: now },
      qa: { reviewCount, rejectCount, totalEvaluated, assetQaPassed: null, timestamp: now },
    },
  };
}
