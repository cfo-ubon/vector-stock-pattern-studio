import type { CommercialAppealScoreV2 } from './commercialAppealScore';
import type { CompositionMetrics } from '../engine/scoring';
import type { ScoreResultV2, EvaluationTraceEntry } from '../engine/scoringV2';
import { LAYOUT_EVALUATION_CLASS_LABELS, type LayoutEvaluationClass } from '../engine/layoutEvaluation';
import { computeStyleAwareDensityFit, type StyleEvaluationProfile } from '../engine/styleEvaluation';
import type { ProductUseId } from '../collection/productTargets';

// Build 012, Section 6 (Commercial Judge V2). The brief asks for an
// evaluation layer that judges artwork like a commercial art director
// across 6 named dimensions "without duplicating existing metrics".
// BUILD_012_AUDIT.md's Finding 5 traced 5 of those 6 directly to
// `critic/commercialAppealScore.ts`'s already-real `CommercialAppealScoreV2`
// (Luxury Feel, Editorial Quality, Shelf Impact, Product Suitability,
// Collection Consistency) — this module reuses that result unchanged
// rather than recomputing it a second time under a slightly different name.
//
// Only "Surface Pattern Suitability" is genuinely new: whether a tile's
// measured repeat/density character actually works as a sellable surface
// pattern at all, combining two real signals no existing dimension
// measures together — repeat-seam integrity (`seamlessIntegrity`,
// `cornerContinuity`) and the Section 3 style-aware density fit
// (`computeStyleAwareDensityFit` — does measured occupancy match what this
// tile's own Style DNA actually declared, replacing the universal ideal
// band `engine/scoring.ts`'s `computeComposition` uses, per Finding 3).
//
// This module also carries `ScoreResultV2`'s full penalty explanation
// (Section 7) through to one place, so a caller gets both "how commercial
// does this look" and "why did the underlying quality score land where it
// did, under which layout/product context" from a single result.

export interface CommercialJudgeV2Inputs {
  /** Already-computed (`computeCommercialAppealScoreV2`,
   * commercialAppealScore.ts) — reused verbatim, never recomputed. */
  appeal: CommercialAppealScoreV2;
  /** Already-computed (`computeOverallScoreV2`, scoringV2.ts) — carries the
   * layout-aware penalty trace this judge surfaces for explainability. */
  scoreV2: ScoreResultV2;
  metrics: CompositionMetrics;
  /** Real declared `density` (0-1) from this tile's own Style DNA, when one
   * was used — required (with `styleProfile`) to compute Surface Pattern
   * Suitability's style-aware half; omitted for a plain non-Style-DNA tile,
   * in which case that half falls back to the plain repeat-quality read
   * alone (never a fabricated style-fit number). */
  declaredDensity?: number;
  styleProfile?: StyleEvaluationProfile;
}

export interface CommercialJudgeV2Result {
  luxuryFeel: number;
  editorialQuality: number;
  shelfImpact: number;
  productSuitability: number;
  collectionConsistency?: number;
  /** New in Build 012 — see module doc comment. */
  surfacePatternSuitability: number;
  overall: number;
  /** Section 7 (Explainability): one plain-English sentence summarizing the
   * verdict and its strongest driver — always derived from the real
   * dimension scores above, never a canned string. */
  verdict: string;
  explanation: {
    layoutClass: LayoutEvaluationClass;
    layoutClassLabel: string;
    productId?: ProductUseId;
    appliedPenalties: EvaluationTraceEntry[];
    exemptedPenalties: EvaluationTraceEntry[];
  };
}

function clamp0to100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Genuinely new Section 6 dimension: repeat-seam integrity averaged with
 * (when a style context is available) the Section 3 style-aware density
 * fit. Neither existing `CommercialAppealScoreV2` nor `commercialPatternCritic.ts`
 * measures this specific combination. */
function computeSurfacePatternSuitability(metrics: CompositionMetrics, declaredDensity: number | undefined, styleProfile: StyleEvaluationProfile | undefined): number {
  const repeatIntegrity = Math.round((metrics.seamlessIntegrity + metrics.cornerContinuity) / 2);
  if (declaredDensity === undefined || styleProfile === undefined) return repeatIntegrity;
  const densityFit = computeStyleAwareDensityFit(metrics.occupancyRatio, styleProfile, declaredDensity);
  return clamp0to100((repeatIntegrity + densityFit) / 2);
}

function buildVerdict(dims: Record<string, number>, overall: number): string {
  const entries = Object.entries(dims);
  const [strongestLabel, strongestValue] = entries.reduce((best, cur) => (cur[1] > best[1] ? cur : best));
  const [weakestLabel, weakestValue] = entries.reduce((worst, cur) => (cur[1] < worst[1] ? cur : worst));
  const tier = overall >= 80 ? 'strong commercial candidate' : overall >= 60 ? 'commercially viable with reservations' : 'not yet commercially ready';
  return `${tier} (overall ${overall}/100) — strongest on ${strongestLabel} (${strongestValue}/100), weakest on ${weakestLabel} (${weakestValue}/100).`;
}

/** Combines the Section 6 6 named dimensions from already-real sub-scores
 * (see module doc comment for exactly where each comes from) plus the one
 * genuinely new dimension, with a plain-English verdict and the full
 * layout/penalty explanation trace attached. */
export function computeCommercialJudgeV2(inputs: CommercialJudgeV2Inputs): CommercialJudgeV2Result {
  const { appeal, scoreV2, metrics, declaredDensity, styleProfile } = inputs;

  const surfacePatternSuitability = computeSurfacePatternSuitability(metrics, declaredDensity, styleProfile);

  const dims: Record<string, number> = {
    'Luxury Feel': appeal.luxuryFeel,
    'Editorial Quality': appeal.editorialQuality,
    'Shelf Impact': appeal.shelfImpact,
    'Product Suitability': appeal.productSuitability,
    'Surface Pattern Suitability': surfacePatternSuitability,
  };
  if (appeal.collectionConsistency !== undefined) dims['Collection Consistency'] = appeal.collectionConsistency;

  const overall = clamp0to100(Object.values(dims).reduce((a, b) => a + b, 0) / Object.values(dims).length);
  const verdict = buildVerdict(dims, overall);

  return {
    luxuryFeel: appeal.luxuryFeel,
    editorialQuality: appeal.editorialQuality,
    shelfImpact: appeal.shelfImpact,
    productSuitability: appeal.productSuitability,
    collectionConsistency: appeal.collectionConsistency,
    surfacePatternSuitability,
    overall,
    verdict,
    explanation: {
      layoutClass: scoreV2.layoutClass,
      layoutClassLabel: LAYOUT_EVALUATION_CLASS_LABELS[scoreV2.layoutClass],
      productId: scoreV2.productId,
      appliedPenalties: scoreV2.appliedPenalties,
      exemptedPenalties: scoreV2.exemptedPenalties,
    },
  };
}
