import type { PortfolioAsset } from '../domain/types';
import type { CommercialFeedbackReport, CommercialConfidenceLevel } from './commercialFeedbackEngine';

// Build 026, Phase 13 — Production Recommendations ("What Should I
// Generate Next"). Distinct from `commercialFeedbackEngine.ts` (which
// only reports what already happened) — this module turns that report,
// plus the existing portfolio's own composition, into a ranked list of
// which preset to generate more of next. It never invents a specific
// seed, palette, or SVG — seed/geometry generation stays the pattern
// generator's own job (per the brief's "preserve deterministic replay"
// rule); this module only recommends the higher-level dimension
// (`presetId`) and explains, per candidate, which lower-level
// dimensions (styleDna, compositionType, productTargets, colorPalette)
// have been under-explored for it so far, so a human still makes the
// concrete generation choice.
//
// Diversity constraints (brief: "seed/palette/composition/motif-family/
// product-target diversity, duplicate-risk limit"):
//   - seed diversity is out of scope for a presetId-level recommendation
//     (a seed is chosen at generation time, per pattern, not per preset);
//   - palette diversity -> `distinctPaletteCount` (unique
//     `colorPalette` signatures already generated for this preset);
//   - composition diversity -> `distinctCompositionTypeCount`;
//   - motif-family diversity -> `distinctStyleDnaCount` (Style DNA is
//     this codebase's closest existing concept to "motif family");
//   - product-target diversity -> `distinctProductTargetCount`;
//   - duplicate-risk limit -> `maxExistingAssetsPerPreset`: a preset
//     already at or past this many existing assets is EXCLUDED from
//     recommendations entirely (listed in `excludedDueToDuplicateRisk`),
//     regardless of how well it performs commercially, so this engine
//     can never recommend flooding the portfolio with more near-
//     duplicates of an already-saturated preset.

export const DEFAULT_MAX_EXISTING_ASSETS_PER_PRESET = 25;

export interface ProductionRecommendationInput {
  assets: PortfolioAsset[];
  /** The presets this recommendation run is allowed to choose among —
   * this module never invents a presetId the caller didn't supply; the
   * pattern generator's own registered preset list is the caller's
   * responsibility to pass in. */
  availablePresetIds: string[];
  /** Optional — when omitted, no commercial weighting is applied and
   * every recommendation's `commercialConfidence`/`commercialApprovalRate`
   * stay `null`, with the reason saying so explicitly rather than
   * pretending an unweighted score is commercially informed. */
  commercialFeedback?: CommercialFeedbackReport;
  maxRecommendations?: number;
  maxExistingAssetsPerPreset?: number;
  /** Injectable clock for deterministic tests. */
  now?: number;
}

export interface ProductionRecommendation {
  presetId: string;
  existingAssetCount: number;
  distinctStyleDnaCount: number;
  distinctCompositionTypeCount: number;
  distinctProductTargetCount: number;
  distinctPaletteCount: number;
  commercialConfidence: CommercialConfidenceLevel | null;
  commercialApprovalRate: number | null;
  score: number;
  reason: string;
}

export interface ProductionRecommendationReport {
  generatedAt: number;
  recommendations: ProductionRecommendation[];
  /** Presets that met/exceeded `maxExistingAssetsPerPreset` and were
   * therefore excluded outright, regardless of score. */
  excludedDueToDuplicateRisk: string[];
}

function paletteSignature(colorPalette: string[]): string {
  return [...colorPalette].sort().join('|');
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Pure function: given the current portfolio and (optionally) a
 * Commercial Feedback report, ranks candidate presets by how much they'd
 * benefit from more generation right now. Every recommendation carries a
 * `reason` explaining its own score inputs — no opaque ranking. */
export function generateProductionRecommendations(input: ProductionRecommendationInput): ProductionRecommendationReport {
  const {
    assets,
    availablePresetIds,
    commercialFeedback,
    maxRecommendations = 10,
    maxExistingAssetsPerPreset = DEFAULT_MAX_EXISTING_ASSETS_PER_PRESET,
    now,
  } = input;

  const excludedDueToDuplicateRisk: string[] = [];
  const recommendations: ProductionRecommendation[] = [];

  for (const presetId of availablePresetIds) {
    const presetAssets = assets.filter((a) => a.presetId === presetId);
    const existingAssetCount = presetAssets.length;

    if (existingAssetCount >= maxExistingAssetsPerPreset) {
      excludedDueToDuplicateRisk.push(presetId);
      continue;
    }

    const distinctStyleDnaCount = new Set(presetAssets.map((a) => a.styleDna).filter((v): v is string => !!v)).size;
    const distinctCompositionTypeCount = new Set(presetAssets.map((a) => a.compositionType).filter((v): v is string => !!v)).size;
    const distinctProductTargetCount = new Set(presetAssets.flatMap((a) => a.productTargets)).size;
    const distinctPaletteCount = new Set(presetAssets.map((a) => paletteSignature(a.colorPalette)).filter((s) => s.length > 0)).size;

    const commercialInsight = commercialFeedback?.dimensions.find((d) => d.dimension === 'presetId' && d.value === presetId);
    const commercialConfidence = commercialInsight?.confidence ?? null;
    const commercialApprovalRate = commercialInsight?.approvalRate ?? null;

    // Gap score: fewer existing assets for this preset -> stronger case
    // for generating more of it (1.0 for a never-generated preset,
    // decaying toward 0 as existingAssetCount grows).
    const gapScore = 1 / (1 + existingAssetCount);

    // Internal-diversity score: among what HAS been generated for this
    // preset, how repetitive is it across styleDna/compositionType/
    // productTarget/palette? Only dimensions with at least one non-null
    // value among this preset's assets count toward the average --
    // otherwise a preset whose assets simply never recorded a given
    // field (e.g. no `productTargets` set at all) would be scored as
    // "maximally repetitive" on that dimension purely for lacking data,
    // which is a different problem than actually repeating the same
    // value. Low distinctness relative to volume -> stronger case for
    // varying those dimensions on the next batch.
    const populatedDimensionRatios: number[] = [];
    if (presetAssets.some((a) => a.styleDna)) populatedDimensionRatios.push(distinctStyleDnaCount / Math.max(existingAssetCount, 1));
    if (presetAssets.some((a) => a.compositionType)) populatedDimensionRatios.push(distinctCompositionTypeCount / Math.max(existingAssetCount, 1));
    if (presetAssets.some((a) => a.productTargets.length > 0)) populatedDimensionRatios.push(distinctProductTargetCount / Math.max(existingAssetCount, 1));
    if (presetAssets.some((a) => a.colorPalette.length > 0)) populatedDimensionRatios.push(distinctPaletteCount / Math.max(existingAssetCount, 1));
    const avgDistinctRatio =
      existingAssetCount === 0 || populatedDimensionRatios.length === 0
        ? 1
        : populatedDimensionRatios.reduce((sum, r) => sum + r, 0) / populatedDimensionRatios.length;
    const internalDiversityScore = existingAssetCount === 0 ? 0 : 1 - Math.min(1, avgDistinctRatio);

    // Commercial boost: only applied when the Commercial Feedback Engine
    // itself reported at least 'moderate' confidence -- a 'low'-
    // confidence or missing insight contributes nothing, honoring the
    // same "never claim more than the data supports" rule that engine
    // enforces on its own output.
    const commercialBoost =
      commercialApprovalRate !== null && (commercialConfidence === 'high' || commercialConfidence === 'moderate') ? commercialApprovalRate : 0;

    const score = round2(gapScore * 0.5 + internalDiversityScore * 0.3 + commercialBoost * 0.2);

    const reasonParts: string[] = [];
    reasonParts.push(
      existingAssetCount === 0
        ? `"${presetId}" has no existing assets yet.`
        : `"${presetId}" has ${existingAssetCount} existing asset${existingAssetCount === 1 ? '' : 's'} (${distinctStyleDnaCount} distinct styleDna, ${distinctCompositionTypeCount} distinct compositionType, ${distinctProductTargetCount} distinct productTarget, ${distinctPaletteCount} distinct palette).`,
    );
    if (existingAssetCount > 0 && internalDiversityScore > 0.5) {
      reasonParts.push('What exists so far is repetitive across those dimensions -- vary them on the next batch.');
    }
    if (commercialApprovalRate !== null && (commercialConfidence === 'high' || commercialConfidence === 'moderate')) {
      reasonParts.push(`Commercial feedback (${commercialConfidence} confidence) shows a ${Math.round(commercialApprovalRate * 100)}% approval rate for this preset -- weighted into this recommendation.`);
    } else if (commercialInsight) {
      reasonParts.push('Commercial feedback exists for this preset but at low confidence, so it was NOT used to weight this recommendation.');
    } else {
      reasonParts.push('No commercial feedback exists yet for this preset.');
    }

    recommendations.push({
      presetId,
      existingAssetCount,
      distinctStyleDnaCount,
      distinctCompositionTypeCount,
      distinctProductTargetCount,
      distinctPaletteCount,
      commercialConfidence,
      commercialApprovalRate,
      score,
      reason: reasonParts.join(' '),
    });
  }

  recommendations.sort((a, b) => b.score - a.score);

  return {
    generatedAt: now ?? Date.now(),
    recommendations: recommendations.slice(0, maxRecommendations),
    excludedDueToDuplicateRisk,
  };
}
