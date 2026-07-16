import type { CommercialPatternCritique } from './commercialPatternCritic';

// Build 011, Section 9 (Commercial Appeal Score V2): every one of the
// brief's 6 named dimensions already exists somewhere in this codebase
// (see BUILD_011_AUDIT.md §9's own "already shipped, three times over"
// findings) -- Luxury Feel/Editorial Quality/Premium Impression/Product
// Suitability all live on `CommercialPatternCritique`
// (commercialPatternCritic.ts, same directory), Shelf Impact is
// `computeHeroVisibilityScore` (engine/scoring.ts — "does the hero motif
// read as the focal point at a glance" is exactly what a stock
// thumbnail's shelf impact means), and Collection Consistency is Section
// 8's own `computePortfolioConsistency` (engine/portfolioQuality.ts). What
// was genuinely missing was a single umbrella combining all six under the
// brief's own names -- this module is exactly that combination and
// nothing more: no new geometry, no new SVG analysis, every value traced
// straight back to an already-computed, already-tested real signal.

export interface CommercialAppealScoreV2Inputs {
  /** Already-computed critique for this same tile
   * (`evaluateCommercialPatternCritique`, commercialPatternCritic.ts). */
  critique: CommercialPatternCritique;
  /** Real Hero Visibility Score (`computeHeroVisibilityScore`,
   * engine/scoring.ts) for this same tile. */
  heroVisibility: number;
  /** Optional real Portfolio Consistency score
   * (`computePortfolioConsistency`, engine/portfolioQuality.ts) for the
   * preset this tile belongs to -- "Collection Consistency" is inherently
   * a *portfolio*-level concept, not a single-tile one, so this stays
   * undefined for a lone tile scored outside any portfolio context and is
   * simply excluded from `overall` in that case rather than padded with a
   * fabricated default. */
  collectionConsistency?: number;
}

export interface CommercialAppealScoreV2 {
  luxuryFeel: number;
  editorialQuality: number;
  shelfImpact: number;
  premiumImpression: number;
  productSuitability: number;
  collectionConsistency?: number;
  overall: number;
}

/** Combines the brief's 6 named commercial-evaluation dimensions from
 * already-real, already-computed sub-scores -- see this module's own top
 * comment for exactly where each one comes from. `overall` averages
 * whichever dimensions are actually defined for this call (5 when
 * `collectionConsistency` is omitted, 6 when a real portfolio context
 * supplies one) -- never padded with an invented number. */
export function computeCommercialAppealScoreV2(inputs: CommercialAppealScoreV2Inputs): CommercialAppealScoreV2 {
  const { critique, heroVisibility, collectionConsistency } = inputs;
  const luxuryFeel = critique.luxuryFeeling;
  const editorialQuality = critique.editorialFeeling;
  const shelfImpact = Math.round(heroVisibility);
  const premiumImpression = critique.premiumFeeling;
  const productSuitability = Math.round((critique.fabricFeeling + critique.wallpaperFeeling + critique.giftWrapFeeling) / 3);

  const dimensions = [luxuryFeel, editorialQuality, shelfImpact, premiumImpression, productSuitability];
  if (collectionConsistency !== undefined) dimensions.push(collectionConsistency);
  const overall = Math.round(dimensions.reduce((a, b) => a + b, 0) / dimensions.length);

  return {
    luxuryFeel,
    editorialQuality,
    shelfImpact,
    premiumImpression,
    productSuitability,
    collectionConsistency,
    overall,
  };
}
