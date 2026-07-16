import { deriveSeed } from '../engine/candidateEngine';
import { runDesignSpecQualityLoop } from '../trend/designSpecQuality';
import type { DesignSpecification } from '../trend/designSpecTypes';
import { buildDesignReport, type DesignReport } from './designReport';
import type { StyleCoachCategory } from './styleCoach';

// Design Critic & Art Direction Engine (Phase 7) — Section 8 "Improvement
// Loop" (Evaluate -> Recommend -> Update Design Specification ->
// Re-generate -> Evaluate Again). This is genuinely new: the existing
// `trend/designSpecQuality.ts`'s `runDesignSpecQualityLoop` (Design
// Workbench Phase 6) only re-seeds and regenerates candidates from the
// SAME, unmodified spec — it never patches a `DesignSpecification` field.
// This loop is the first in the codebase that actually closes the brief's
// full cycle: each round evaluates the current spec (reusing
// `runDesignSpecQualityLoop` with `maxRounds=1` for the real candidate-
// pool-and-score step, not a re-implementation of it), takes the
// highest-priority Art Direction recommendation that has a real
// `specPatch`, applies it to produce the NEXT round's spec, and stops
// early once the commercial bar is met or no further automatic patch is
// available (never patches based on an advisory-only recommendation).

export interface ImprovementRound {
  round: number;
  spec: DesignSpecification;
  report: DesignReport;
  /** The recommendation id whose `specPatch` was applied to produce the
   * NEXT round's spec — null on the final round (nothing left to try, or
   * the gate was already met). */
  appliedRecommendationId: string | null;
  meetsCommercialBar: boolean;
}

export interface ImprovementLoopResult {
  rounds: ImprovementRound[];
  finalSpec: DesignSpecification;
  finalReport: DesignReport;
  roundsUsed: number;
  maxRounds: number;
  /** True when the final round's overall critique score is higher than
   * the first round's — a real measured before/after delta, not assumed. */
  improved: boolean;
}

const DEFAULT_MAX_ROUNDS = 3;

/** Runs the Section 8 loop. Deterministic — the same spec + seed +
 * maxRounds always produces the same rounds, the same applied patches,
 * and the same final result. */
export function runImprovementLoop(
  spec: DesignSpecification,
  seed: string,
  maxRounds: number = DEFAULT_MAX_ROUNDS,
  styleCoachCategory?: StyleCoachCategory,
): ImprovementLoopResult {
  const rounds: ImprovementRound[] = [];
  let currentSpec = spec;
  let firstOverall: number | null = null;

  for (let round = 0; round < maxRounds; round++) {
    const roundSeed = round === 0 ? seed : deriveSeed(seed, 'improvement-loop', round);
    const loopResult = runDesignSpecQualityLoop(currentSpec, roundSeed, 'fast', 1);

    // A patch applied to reach this round can push a previously-valid spec
    // into hard-reject territory (confirmed during Phase 7 scoping: e.g.
    // switching off a strict grid layout can raise the instance count past
    // engine/candidateEngine.ts's node-count safety budget). Never accept
    // a round broken by our own patch — stop and keep the last good round.
    // Round 0 is the caller's own starting spec, not our doing, so it's
    // always accepted even if (unexpectedly) rejected, so the loop never
    // returns zero rounds.
    if (round > 0 && loopResult.pool.winner.rejected) break;

    const report = buildDesignReport(
      currentSpec,
      loopResult.pool.winner.tileData,
      loopResult.pool.winner.metrics,
      loopResult.check.report,
      loopResult.check.meetsTargets,
      styleCoachCategory,
    );
    if (firstOverall === null) firstOverall = report.critique.overall;

    const topRecommendation = report.recommendations.find((r) => r.id === report.priorityOrder[0]);
    const canAutoApply = !report.meetsCommercialBar && !!topRecommendation?.specPatch;

    rounds.push({
      round,
      spec: currentSpec,
      report,
      appliedRecommendationId: canAutoApply ? topRecommendation!.id : null,
      meetsCommercialBar: report.meetsCommercialBar,
    });

    if (report.meetsCommercialBar || !canAutoApply) break;
    currentSpec = { ...currentSpec, ...topRecommendation!.specPatch };
  }

  const finalRound = rounds[rounds.length - 1];
  return {
    rounds,
    finalSpec: finalRound.spec,
    finalReport: finalRound.report,
    roundsUsed: rounds.length,
    maxRounds,
    improved: firstOverall !== null && finalRound.report.critique.overall > firstOverall,
  };
}
