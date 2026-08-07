import type { GenerateParams, TileData } from '../engine/types';
import { buildTileForGenerate } from '../engine/heroDetector';
import { computeMetrics, type CompositionMetrics } from '../engine/scoring';
import { computePatternBeautyScore, type PatternBeautyScore } from '../engine/patternBeautyScore';
import { layoutEvaluationClass } from '../engine/layoutEvaluation';
import { detectProblems, type DesignProblem } from '../critic/problems';
import { detectVisualIssues, type VisualIssue } from '../critic/visualAnalysis';

// Design Refinement Studio Pro, Mission 2/4/5 — the one function every live
// edit calls. Every number/message here is produced by an already-real,
// already-shipped engine (`engine/heroDetector.ts`'s own hero/commercial
// retry gate, `engine/scoring.ts`'s composition metrics, Build 019's
// pattern-beauty score, and the Design Critic & Art Direction Engine's
// `problems.ts`/`visualAnalysis.ts` penalty/issue detectors) — this module
// adds no new scoring, detection, or advice logic of its own, it only calls
// them in sequence against whatever `GenerateParams` the owner is currently
// editing. Deliberately NOT the `critic/designReport.ts`/`artDirection.ts`
// family: those are coupled to the Design Workbench's `DesignSpecification`
// model, not the `GenerateParams` model Factory/Autopilot-produced assets
// (the vast majority of the catalog) actually use — `computeMetrics`/
// `detectProblems`/`detectVisualIssues` are the real spec-agnostic layer
// that works for both.

export interface DesignEvaluation {
  tileData: TileData;
  metrics: CompositionMetrics;
  beauty: PatternBeautyScore;
  problems: DesignProblem[];
  issues: VisualIssue[];
  /** How many of `heroDetector.ts`'s own quality-retry attempts this
   * evaluation took — surfaced as-is, never recomputed. */
  attempts: number;
  regenerated: boolean;
}

export function evaluateDesign(params: GenerateParams): DesignEvaluation {
  const retryResult = buildTileForGenerate(params);
  const { tileData, attempts, regenerated } = retryResult;
  const metrics = computeMetrics(tileData);
  const beauty = computePatternBeautyScore(metrics);
  const problems = detectProblems(metrics, { layoutClass: layoutEvaluationClass(params.layoutId) });
  const issues = detectVisualIssues(tileData, metrics);
  return { tileData, metrics, beauty, problems, issues, attempts, regenerated };
}
