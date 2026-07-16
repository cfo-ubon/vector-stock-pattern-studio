import { QUALITY_PRESET_WEIGHTS, type CompositionMetrics, type QualityPresetId } from './scoring';
import { PENALTY_RULES_V2, isPenaltyApplicable, type PenaltyConfidence, type PenaltyEvaluationContext } from './penaltyRulesV2';
import type { LayoutEvaluationClass } from './layoutEvaluation';
import type { ProductUseId } from '../collection/productTargets';

// Build 012, Sections 2/5/7 (Layout-aware Evaluation / Penalty System V2 /
// Explainability). This is a separate module from `engine/scoring.ts` (not
// a rewrite of `computeOverallScore`/`applySoftPenalties`, which stay exactly
// as they were — every existing caller and test of the V1 functions keeps
// working unchanged) specifically to avoid a circular import:
// `engine/penaltyRulesV2.ts` imports `SOFT_PENALTY_RULES`/`CompositionMetrics`
// FROM `scoring.ts`, so the V2 scoring entrypoint that consumes
// `PENALTY_RULES_V2` has to live outside `scoring.ts` itself.
//
// `computeOverallScoreV2` reuses `QUALITY_PRESET_WEIGHTS` unchanged (Section
// 2/5's fix is entirely about *which penalties apply*, not the weighted-
// average layer) and produces the same numeric weighted base V1 does — the
// only behavioral difference is that `PENALTY_RULES_V2`'s applicability
// gate (`isPenaltyApplicable`) decides which triggered rules actually
// deduct points for this tile's real layout/product context, with every
// exempted rule recorded (not silently dropped) alongside every applied
// one, each carrying its own `reason`/`confidence` — Section 7's
// explainability requirement.

function clamp01to100(n: number): number {
  return Math.max(0, Math.min(100, n));
}

const METRIC_LABELS: Partial<Record<keyof CompositionMetrics, string>> = {
  composition: 'composition/occupancy',
  spacing: 'motif spacing evenness',
  quadrantBalance: 'quadrant balance',
  horizontalBalance: 'left/right balance',
  verticalBalance: 'top/bottom balance',
  visualCenterOffset: 'visual center offset',
  occupancyRatio: 'tile occupancy',
  densityVariance: 'local density variance',
  largestEmptyRegion: 'largest empty region',
  hierarchy: 'visual hierarchy clarity',
  scaleDiversity: 'scale diversity',
  rotationDiversity: 'rotation diversity',
  colorBalance: 'color-role balance',
  paletteContrast: 'palette contrast',
  overlapQuality: 'overlap quality',
  heroSeparation: 'hero separation',
  edgeDensity: 'edge density balance',
  adjacencyRepetition: 'adjacent-motif repetition',
  svgHealth: 'SVG technical health',
  flowCoherence: 'directional flow coherence',
  rhythmRegularity: 'spacing rhythm regularity',
  motifShapeDiversity: 'motif shape diversity',
  cornerContinuity: 'tile-corner junction balance',
  heroDetailRatio: 'hero motif internal detail',
  isolationScore: 'isolated-object presence',
  clusterCohesion: 'cluster cohesion',
  gridAppearanceScore: 'grid-like appearance',
  spacingUniformity: 'spacing uniformity',
};

export interface EvaluationTraceEntry {
  ruleId: string;
  label: string;
  points: number;
  reason: string;
  confidence: PenaltyConfidence;
}

export interface ScoreResultV2 {
  score: number;
  /** Plain weighted average before any penalty deduction — identical
   * formula/weights to `computeOverallScore`'s own `baseScore`. */
  baseScore: number;
  presetId: QualityPresetId;
  layoutClass: LayoutEvaluationClass;
  productId?: ProductUseId;
  /** Penalty rules that triggered AND applied under this context (deducted
   * points from `baseScore`). */
  appliedPenalties: EvaluationTraceEntry[];
  /** Penalty rules that triggered but were exempted under this context
   * (layout/product) — surfaced so a caller can show "this would normally
   * be flagged, but not for this layout/product", never silently hidden. */
  exemptedPenalties: EvaluationTraceEntry[];
  /** Informational only (not deducted): individual weighted metrics that
   * scored below 50, same convention `computeOverallScore`'s own
   * `penaltyReasons` already established. */
  lowMetricReasons: string[];
}

/** Build 012's layout/style/product-aware successor to
 * `computeOverallScore` — same weighted-average formula and
 * `QUALITY_PRESET_WEIGHTS`, but gates `PENALTY_RULES_V2` through
 * `isPenaltyApplicable` instead of applying every triggered rule
 * unconditionally. `ctx.productId` is optional — omit it when scoring a
 * tile with no specific product target in mind (the `cornerDeadZone`
 * repeat-only gate simply never exempts in that case, matching V1's
 * always-universal behavior exactly). */
export function computeOverallScoreV2(metrics: CompositionMetrics, presetId: QualityPresetId, ctx: PenaltyEvaluationContext): ScoreResultV2 {
  const weights = QUALITY_PRESET_WEIGHTS[presetId];
  let weightedSum = 0;
  let weightTotal = 0;
  const lowMetricReasons: string[] = [];
  for (const [key, weight] of Object.entries(weights) as Array<[keyof CompositionMetrics, number]>) {
    const value = metrics[key];
    if (typeof value !== 'number' || typeof weight !== 'number') continue;
    weightedSum += value * weight;
    weightTotal += weight;
    if (value < 50) lowMetricReasons.push(`${METRIC_LABELS[key] ?? key} is low (${Math.round(value)}/100)`);
  }
  const baseScore = weightTotal > 0 ? weightedSum / weightTotal : 0;

  const appliedPenalties: EvaluationTraceEntry[] = [];
  const exemptedPenalties: EvaluationTraceEntry[] = [];
  let deduction = 0;
  for (const rule of PENALTY_RULES_V2) {
    if (!rule.check(metrics)) continue;
    const entry: EvaluationTraceEntry = { ruleId: rule.id, label: rule.label, points: rule.points, reason: rule.reason, confidence: rule.confidence };
    if (isPenaltyApplicable(rule, ctx)) {
      appliedPenalties.push(entry);
      deduction += rule.points;
    } else {
      exemptedPenalties.push(entry);
    }
  }

  const score = Math.round(clamp01to100(baseScore - deduction));
  return { score, baseScore: Math.round(baseScore), presetId, layoutClass: ctx.layoutClass, productId: ctx.productId, appliedPenalties, exemptedPenalties, lowMetricReasons };
}
