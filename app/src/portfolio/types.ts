import type { LayoutId } from '../engine/types';
import type { CompositionMetrics } from '../engine/scoring';
import type { ProductUseId } from '../collection/productTargets';
import type { BotanicalFamily } from '../generators/botanicalFamilies';
import type { LayoutEvaluationClass } from '../engine/layoutEvaluation';
import type { EvaluationTraceEntry } from '../engine/scoringV2';
import type { PortfolioBaselineManifest } from './baseline';

// Build 013, Section 3 (Portfolio Data Model). Every field below is either
// a direct pass-through of an already-real, already-computed value
// (`scripts/qualityReport.ts`'s `EvalResult`, Build 012's `scoringV2`/
// `commercialJudgeV2`) or one of the genuinely new fields Build 013 itself
// introduces (fingerprint, cluster assignment, rank/percentile, confidence,
// failure/strength tags, recommendation tags, provenance) — see
// BUILD_013_AUDIT.md Section 1 for which is which. Nothing here duplicates
// `EvalResult`'s own computation; a `PortfolioPatternRecord` is built FROM
// one real `EvalResult` plus the new Build 013 analysis outputs.

export const PORTFOLIO_SCHEMA_VERSION = 1;

/** Real, closed set of failure-mode ids Section 7 detects — each one maps
 * to an already-real signal (a `SOFT_PENALTY_RULES`/`PENALTY_RULES_V2`
 * trigger, a `VisualIssueId`, or a named low-metric threshold), never an
 * invented category with no measurement behind it. */
export type FailureModeId =
  | 'weakHierarchy'
  | 'heroInsufficientDetail'
  | 'gridAppearance'
  | 'equalSpacingDetected'
  | 'zeroMotifOverlap'
  | 'largeEmptyHole'
  | 'repetitiveMotifShapes'
  | 'tooManyIsolatedObjects'
  | 'lowClusterCohesion'
  | 'lowPaletteContrast'
  | 'weakProductFit'
  | 'lowStyleFitQuality'
  | 'weakThumbnailImpact'
  | 'repeatedScale'
  | 'fragmentedSilhouette';

export type StrengthTagId =
  | 'strongHierarchy'
  | 'strongHeroDetail'
  | 'strongPaletteContrast'
  | 'strongProductFit'
  | 'strongStyleFitQuality'
  | 'strongThumbnailImpact'
  | 'strongMotifDiversity'
  | 'strongFlowCoherence';

export interface PortfolioPatternRecord {
  schemaVersion: typeof PORTFOLIO_SCHEMA_VERSION;
  /** Deterministic, human-legible id: `${styleDnaId}@${seed}`. */
  patternId: string;
  seed: string;
  styleDnaId: string;
  layoutId: LayoutId;
  layoutClass: LayoutEvaluationClass;
  categoryId: string;
  /** Real Composition Zone label, when the resolved params carried one —
   * undefined for layouts that don't use the composition-zone mechanism. */
  compositionZone?: string;
  /** The real top-ranked product use for this tile
   * (`recommendedProductUses(evaluateProductTargets(...), 1)[0]`) — an
   * honest, measured "best fit", not an externally imposed label. */
  productTarget: ProductUseId;
  productTargetScore: number;
  /** Every product's real fit score, for callers that need the full
   * distribution rather than only the top pick. */
  allProductScores: Partial<Record<ProductUseId, number>>;
  marketplaceTarget?: string;
  botanicalFamily?: BotanicalFamily;
  /** Real declared Style DNA `colorStrategy` field (`fullPalette`,
   * `dominantDuo`, etc.) — the closest already-real "color story" concept. */
  colorStrategy?: string;
  clusterType?: string;
  heroStructure?: string;

  nodeCount: number;
  /** Estimated serialized-SVG byte size — real (computed from the
   * serialized markup length when generation retains it, see
   * `scripts/portfolioGenerate.ts`), not a placeholder. */
  fileSizeBytes: number;
  generationTimeMs: number;

  metrics: CompositionMetrics;
  absoluteCommercialQualityV1: number;
  absoluteCommercialQualityV2: number;
  appliedPenaltiesV2: EvaluationTraceEntry[];
  exemptedPenaltiesV2: EvaluationTraceEntry[];
  heroVisibility: number;
  patternBeautyScore: number;
  illustrationQuality?: number;
  visualRichness?: number;
  styleFitQuality?: number;
  commercialAppealV2Overall: number;
  luxuryCompositionOverall: number;
  surfacePatternSuitability: number;
  commercialJudgeVerdict: string;

  /** Section 8: the real per-tile similarity fingerprint (see
   * `src/portfolio/fingerprint.ts`) — a deterministic string built from
   * already-real declared/measured fields, used for near-duplicate
   * classification within this tile's own `(styleDnaId, layoutId)` bucket. */
  similarityFingerprint: string;
  duplicateStatus?: 'exactDuplicate' | 'deterministicDuplicate' | 'nearDuplicate' | 'acceptableVariant';
  /** Patterns this one was compared against and classified relative to —
   * only populated for tiles with a non-`acceptableVariant`/undefined
   * `duplicateStatus`, so most records carry an empty array. */
  similarTo: string[];
  /** Real, deduped shape-topology signatures (`extractMotifShapeSignatures`)
   * this tile's motifs actually drew — persisted (not just summarized into
   * `similarityFingerprint`'s `shapes:<count>` field) so Section 8's
   * within-bucket duplicate pass can compute real Jaccard similarity
   * against every other tile in the manifest without regenerating tiles. */
  shapeSignatures: string[];

  /** Section 9: which real, data-derived cluster (see
   * `src/portfolio/clustering.ts`) this pattern was assigned to, plus the
   * human-readable summary label attached to that cluster id — both filled
   * in only after Section 9's clustering pass runs over the full manifest. */
  clusterId?: number;
  clusterLabel?: string;

  /** Section 5: overall + scoped ranks, 1-based, and the derived
   * percentile bucket. All undefined until the ranking pass runs. */
  rankOverall?: number;
  percentileOverall?: number;
  rankWithinPreset?: number;
  percentileWithinPreset?: number;
  rankWithinProduct?: number;
  rankWithinLayout?: number;
  percentileBucket?: 'top1' | 'top5' | 'top10' | 'middle50' | 'bottom10' | 'bottom5' | 'bottom1' | 'other';
  compositeRankScore?: number;

  failureModes: FailureModeId[];
  strengthTags: StrengthTagId[];
  recommendationTags: string[];

  /** Section 10: this one tile's own evaluator confidence (distinct from
   * a portfolio-level or recommendation-level confidence) — derived from
   * how many of `appliedPenaltiesV2`/`exemptedPenaltiesV2` carry `'low'`
   * confidence (Build 012's own per-rule confidence field) and how much
   * evidence (node count, instance count) backed the metrics. */
  evaluatorConfidence: 'high' | 'medium' | 'low';

  provenance: {
    baseline: PortfolioBaselineManifest;
  };
}

export interface PortfolioManifest {
  schemaVersion: typeof PORTFOLIO_SCHEMA_VERSION;
  generatedAt: string;
  baseline: PortfolioBaselineManifest;
  totalPatterns: number;
  distribution: Record<string, number>;
  patterns: PortfolioPatternRecord[];
}
