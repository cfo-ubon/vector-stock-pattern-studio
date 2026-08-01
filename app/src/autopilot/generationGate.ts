import type { PortfolioAsset } from '../catalog/domain/types';
import type { QualitySnapshot } from '../catalog/quality/qualitySnapshotStore';
import type { AutonomousDesignRun } from './domain/autonomousDesignRun';
import type { DecisionTrace } from '../aiCeo/domain/types';
import { runDecisionSync, recordDecision } from '../decisionOS/index';
import { generationGateContext, GENERATION_GATE_SOURCES } from '../decisionOS/adapters/generationGateAdapter';
import { decisionTraceFrom } from '../aiCeo/decisionTrace';

// Build 031B Hardening — Autopilot Generation Gate. Before a Design Plan
// is even built, ask the Decision OS whether generating new patterns is
// actually the best next action, or whether unfinished work (an
// interrupted/paused run, un-imported READY items) or REVIEW/REJECT
// repair work should come first (`factory.completeExistingWorkFirst` /
// `factory.repairBeforeGenerate` — Build 031B, Part 7 policies that
// existed but were never wired into a real caller until now). Generation
// is never silently blocked: the caller always has an explicit override.

export type GenerationGateAction = 'generate' | 'resumeExistingWork' | 'repairExisting';

export interface GenerationGateResult {
  /** `true` only when the Decision OS itself recommends generating —
   * `false` means it recommends `alternativeAction` first, never a
   * fabricated block. */
  recommendGenerate: boolean;
  action: GenerationGateAction;
  /** Human-readable reason for `action`, taken directly from the real
   * Decision's own explanation — never invented by this function. */
  reason: string;
  decisionTrace: DecisionTrace;
}

/** Same per-asset "latest QualitySnapshot" reduction `aiCeo/portfolioDoctor.ts`'s
 * `reviewRejectFinding` already does — duplicated here (rather than
 * imported) because that function is module-private and this gate needs
 * only the two counts, not the full finding shape. */
function latestSnapshotByAsset(snapshots: QualitySnapshot[]): Map<string, QualitySnapshot> {
  const map = new Map<string, QualitySnapshot>();
  for (const s of [...snapshots].sort((a, b) => a.createdAt - b.createdAt)) map.set(s.assetId, s);
  return map;
}

/** Pure decision (no I/O) — `evaluateGenerationGate` computes the real
 * counts itself so a caller only has to load raw storage records, exactly
 * mirroring how every other Decision-OS-routed finding in this app
 * works. Fire-and-forget records the Decision to the Timeline (the
 * caller — an interactive screen — should not block on that write). */
export function evaluateGenerationGate(portfolioAssets: PortfolioAsset[], qualitySnapshots: QualitySnapshot[], autonomousRuns: AutonomousDesignRun[], now: number): GenerationGateResult {
  const resumableRunCount = autonomousRuns.filter((r) => r.status === 'GENERATING' || r.status === 'PAUSED').length;

  let readyNotImportedCount = 0;
  for (const run of autonomousRuns) {
    for (const item of run.items) {
      if (item.decision === 'READY' && item.portfolioAssetId === null) readyNotImportedCount++;
    }
  }

  const latest = latestSnapshotByAsset(qualitySnapshots);
  const assetIds = new Set(portfolioAssets.map((a) => a.assetId));
  let reviewCount = 0;
  let rejectCount = 0;
  let totalEvaluated = 0;
  for (const [assetId, snap] of latest) {
    if (!assetIds.has(assetId)) continue;
    totalEvaluated++;
    if (snap.decision === 'REVIEW') reviewCount++;
    if (snap.decision === 'REJECT') rejectCount++;
  }

  const context = generationGateContext(resumableRunCount, readyNotImportedCount, reviewCount, rejectCount, totalEvaluated, now);
  const decision = runDecisionSync(context, GENERATION_GATE_SOURCES);
  void recordDecision(decision).catch(() => {});

  const action = (decision.recommendedAction as GenerationGateAction | null) ?? 'generate';
  const reason = decision.explanation[0] ?? 'No policy objected to generating new patterns.';
  return {
    recommendGenerate: action === 'generate',
    action,
    reason,
    decisionTrace: decisionTraceFrom(decision),
  };
}
