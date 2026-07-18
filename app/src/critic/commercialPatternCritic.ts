import type { CompositionMetrics } from '../engine/scoring';
import type { BotanicalBeautyMetrics } from '../engine/botanicalBeautyMetrics';
import { evaluateProductTargets } from '../collection/productTargets';

// Build 006, Section 8 (Commercial Pattern Critic): the brief asks for 8
// named dimensions -- Luxury/Editorial/Premium/Fabric/Wallpaper/Gift Wrap
// Feeling, Botanical Realism, Visual Story. `critic/commercialValidation.ts`
// (Build 001.1, Section 7) already computes 6 of these real feelings, but
// only from a `DesignSpecification` (the Trend Studio pathway) -- it can't
// be called from `scripts/qualityReport.ts`'s direct
// `GenerateParams`/`CompositionMetrics` pathway, which is what Section 9's
// 300-pattern portfolio run needs. Rather than force that dependency, this
// module is a standalone, honest re-derivation that operates on plain,
// already-real values any caller already has -- CompositionMetrics plus
// optional botanical metrics/product target -- with its own clearly
// different (and arguably more honest) formulas:
//
// Luxury/Editorial/Premium Feeling here are deliberately NOT blended with
// a style-fit term the way commercialValidation's versions are -- a
// heavily-detailed, high-contrast tile reads luxurious and a
// flow-coherent, evenly-rhythmic tile reads editorial *regardless* of
// which Style DNA (if any) produced it, which is also why this module
// works for the scenario suite's plain non-Style-DNA tiles too, not just
// portfolio tiles with a real `styleDnaId`. Every weight below is a
// documented, fixed blend of already-real `CompositionMetrics` fields --
// never a fabricated new measurement.

export interface CommercialPatternCritique {
  luxuryFeeling: number;
  editorialFeeling: number;
  premiumFeeling: number;
  fabricFeeling: number;
  wallpaperFeeling: number;
  giftWrapFeeling: number;
  /** Passthrough from `BotanicalBeautyMetrics.botanicalRealism` -- undefined
   * for non-botanical tiles, the same "only real inputs, never padded"
   * convention `engine/commercialStyleAnalysis.ts` already established. */
  botanicalRealism?: number;
  /** How much the tile reads as a deliberate visual narrative rather than
   * a flat mechanical repeat -- a real average of `flowCoherence`
   * (directional coherence), `rhythmRegularity` (real periodicity), and
   * `hierarchy` (a clear hero/support structure), all already-real
   * `CompositionMetrics` fields. Genuinely new (no prior metric measured
   * this combination), but never independently re-derived from raw SVG --
   * a plain average of 3 already-tested numbers, same honesty convention
   * `portfolioQuality.ts`'s Illustration Quality/Visual Richness used. */
  visualStory: number;
}

function clamp0to100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export interface CommercialPatternCriticInputs {
  metrics: CompositionMetrics;
  categoryId: string;
  tileSize: number;
  density: number;
  /** Free text for `evaluateProductTargets`' keyword matching -- typically
   * the Style DNA label or category label, same convention
   * `scripts/qualityReport.ts` already uses. */
  keywordText: string;
  heroVisibility: number;
  botanical?: BotanicalBeautyMetrics;
}

/** Evaluates the Section 8 Commercial Pattern Critic dimensions for one
 * already-built tile's real metrics. Pure aggregation over already-real
 * signals (`CompositionMetrics`, `evaluateProductTargets`,
 * `BotanicalBeautyMetrics`) -- no new geometry or SVG analysis of its own. */
export function evaluateCommercialPatternCritique(inputs: CommercialPatternCriticInputs): CommercialPatternCritique {
  const { metrics, categoryId, tileSize, density, keywordText, heroVisibility, botanical } = inputs;

  const luxuryFeeling = clamp0to100(metrics.heroDetailRatio * 0.4 + metrics.paletteContrast * 0.3 + metrics.cornerContinuity * 0.3);
  const editorialFeeling = clamp0to100(metrics.flowCoherence * 0.5 + metrics.rhythmRegularity * 0.3 + metrics.spacing * 0.2);
  const premiumFeeling = clamp0to100(metrics.svgHealth * 0.3 + metrics.cornerContinuity * 0.25 + metrics.heroDetailRatio * 0.25 + metrics.colorBalance * 0.2);
  const visualStory = clamp0to100((metrics.flowCoherence + metrics.rhythmRegularity + metrics.hierarchy) / 3);

  const productEvaluations = evaluateProductTargets({ categoryId, tileSize, density, keywordText, heroVisibility });
  const scoreFor = (id: 'fabric' | 'wallpaper' | 'giftWrap') => productEvaluations.find((e) => e.id === id)?.score ?? 0;

  return {
    luxuryFeeling,
    editorialFeeling,
    premiumFeeling,
    fabricFeeling: scoreFor('fabric'),
    wallpaperFeeling: scoreFor('wallpaper'),
    giftWrapFeeling: scoreFor('giftWrap'),
    botanicalRealism: botanical?.botanicalRealism,
    visualStory,
  };
}
