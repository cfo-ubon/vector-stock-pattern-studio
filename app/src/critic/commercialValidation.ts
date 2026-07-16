import type { DesignSpecification } from '../trend/designSpecTypes';
import type { CompositionMetrics } from '../engine/scoring';
import type { DesignSpecQualityReport } from '../trend/designSpecQuality';
import { computeHeroVisibilityScore } from '../engine/scoring';
import { evaluateProductTargets, type ProductUseId } from '../collection/productTargets';
import { findStylesForCategory, type StyleCoachCategory } from './styleCoach';

// Build 001.1, Section 7 (Commercial Validation). The brief asks for 8
// named numbers beyond Overall Score — every one of them is built by
// reusing a real, already-computed signal, never a fabricated new metric:
//
//   Commercial Readiness  -> `trend/designSpecQuality.ts`'s own field
//                            (already real, unmodified — just surfaced
//                            here alongside the other 7).
//   Wallpaper/Fabric/Gift
//   Wrap Score             -> `collection/productTargets.ts`'s
//                            `evaluateProductTargets` (Collection Engine
//                            Phase 4, Section 6) already scores exactly
//                            these 3 product uses (among 10) from real
//                            category/tileSize/density/keyword signals.
//   Luxury/Editorial
//   Feeling                -> `critic/styleCoach.ts`'s real
//                            `findStylesForCategory` match (Section 5),
//                            turned into a numeric closeness score instead
//                            of Section 5's textual coaching notes.
//   Premium Feeling         -> no dedicated Style DNA category exists for
//                            "premium" specifically (Section 5's brief-
//                            named 7 categories don't include it) — built
//                            instead from real construction-quality
//                            metrics (`svgHealth`, `cornerContinuity`,
//                            `heroDetailRatio`, `colorBalance`) that
//                            legitimately signal "polished" independent of
//                            any one style's aesthetic.
//   Commercial Score        -> the one genuinely new composite: a weighted
//                            blend of the real Overall Score, Commercial
//                            Readiness, and Section 5's Hero Visibility
//                            Score, since "commercially viable" depends on
//                            more than raw composition quality alone.

export interface CommercialValidationResult {
  /** 0-100 — weighted blend of Overall Score, Commercial Readiness, and
   * Hero Visibility Score. The one new composite this module adds. */
  commercialScore: number;
  /** 0-100 — read directly from `DesignSpecQualityReport.commercialReadiness`. */
  commercialReadiness: number;
  premiumFeeling: number;
  luxuryFeeling: number;
  editorialFeeling: number;
  wallpaperScore: number;
  fabricScore: number;
  giftWrapScore: number;
}

function clamp01to100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** How closely `spec` fits the best-matching real Style DNA preset for
 * `category` — a numeric version of `styleCoach.ts`'s textual coaching
 * comparison. Being literally built on one of the category's own presets
 * is worth the most; density/hierarchy/palette closeness to that preset's
 * real preferred fields fills in the rest. Returns a neutral 50 only in
 * the structurally-impossible case where the category has no matching
 * preset at all (never true today — see `styleCoach.ts`'s own note). */
function styleFitScore(spec: DesignSpecification, category: StyleCoachCategory): number {
  const matches = findStylesForCategory(category);
  if (matches.length === 0) return 50;
  const exactMatch = matches.find((s) => s.id === spec.styleDnaId);
  const style = exactMatch ?? matches[0];

  let score = exactMatch ? 55 : 30;
  const densityDelta = Math.abs(spec.density - style.preferredDensity);
  score += Math.max(0, 20 - densityDelta * 100);
  if (JSON.stringify(spec.hierarchy) === JSON.stringify(style.preferredHierarchy)) score += 15;
  if (style.preferredPalettes.length === 0 || style.preferredPalettes.includes(spec.palette.id)) score += 10;
  return clamp01to100(score);
}

const PRODUCT_SCORE_IDS: Record<'wallpaperScore' | 'fabricScore' | 'giftWrapScore', ProductUseId> = {
  wallpaperScore: 'wallpaper',
  fabricScore: 'fabric',
  giftWrapScore: 'giftWrap',
};

/** Runs the Section 7 Commercial Validation checks for one Design
 * Specification + its already-computed metrics/quality report. Pure
 * aggregation over other modules' real scores — no new geometry or spec
 * analysis of its own beyond `styleFitScore`/`commercialScore` above.
 *
 * Build 002, Section 7: feeds the already-computed `heroVisibility`
 * (this function computed it below anyway, for `commercialScore`) into
 * `evaluateProductTargets`'s `minHeroVisibility` rule (currently only on
 * `giftWrap`) — a real, measured signal, not a fabricated new metric.
 * `thumbnail200` marketplace-thumbnail readability was tried first and
 * rejected: a diagnostic sweep across every generator category found the
 * Design Spec pipeline's fixed `exportHints.tileSize` (3000px, a
 * deliberate stock-asset constant — buyers rescale the vector for
 * whatever they print) puts thumbnail200 in a narrow 31-40 band for
 * *every* category, giving a threshold-based rule almost no genuine
 * signal to reward or penalize. `heroVisibility` (already computed here)
 * varies meaningfully in real generation (67-86 measured across 8
 * categories x 3 seeds) and is a genuine, well-known gift-wrap
 * commercial concern — a gift-worthy print needs a real standout motif,
 * not a subtler all-over repeat the way wallpaper does. */
export function evaluateCommercialValidation(
  spec: DesignSpecification,
  metrics: CompositionMetrics,
  qualityReport: DesignSpecQualityReport,
): CommercialValidationResult {
  const heroVisibility = computeHeroVisibilityScore(metrics);
  const commercialScore = clamp01to100(qualityReport.overall * 0.4 + qualityReport.commercialReadiness * 0.35 + heroVisibility * 0.25);

  const luxuryFit = styleFitScore(spec, 'luxury');
  const editorialFit = styleFitScore(spec, 'editorial');
  const luxuryFeeling = clamp01to100(luxuryFit * 0.6 + (metrics.heroDetailRatio * 0.5 + metrics.paletteContrast * 0.5) * 0.4);
  const editorialFeeling = clamp01to100(editorialFit * 0.6 + metrics.flowCoherence * 0.4);
  const premiumFeeling = clamp01to100(metrics.svgHealth * 0.3 + metrics.cornerContinuity * 0.25 + metrics.heroDetailRatio * 0.25 + metrics.colorBalance * 0.2);

  const productEvaluations = evaluateProductTargets({
    categoryId: spec.keywordBundle.patternType,
    tileSize: spec.exportHints.tileSize,
    density: spec.density,
    keywordText: [spec.keywordBundle.commercialCategory, spec.keywordBundle.primaryKeyword, ...spec.keywordBundle.secondaryKeywords].join(' '),
    heroVisibility,
  });
  const scoreFor = (id: ProductUseId) => productEvaluations.find((e) => e.id === id)?.score ?? 0;

  return {
    commercialScore,
    commercialReadiness: qualityReport.commercialReadiness,
    premiumFeeling,
    luxuryFeeling,
    editorialFeeling,
    wallpaperScore: scoreFor(PRODUCT_SCORE_IDS.wallpaperScore),
    fabricScore: scoreFor(PRODUCT_SCORE_IDS.fabricScore),
    giftWrapScore: scoreFor(PRODUCT_SCORE_IDS.giftWrapScore),
  };
}
