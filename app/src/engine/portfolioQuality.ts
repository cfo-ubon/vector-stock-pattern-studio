import type { BotanicalBeautyMetrics } from './botanicalBeautyMetrics';
import { BOTANICAL_FAMILIES, BOTANICAL_SPECIES, BOTANICAL_SILHOUETTES, type BotanicalFamily } from '../generators/botanicalFamilies';
import { illustrationTemplateForSpecies, type IllustrationTemplateId } from '../generators/illustrationFamily';
import type { LayoutId } from './types';

// Build 005, Section 9 (Quality Validation): the brief asks the 100-
// pattern portfolio comparison to measure "Species Diversity", "Visual
// Richness", and "Illustration Quality" alongside the pre-existing
// Commercial Quality/Hero/SVG Quality numbers. Following this whole
// build's own established convention (patternBeautyScore.ts,
// botanicalBeautyMetrics.ts): reuse an already-real, already-tested
// measurement wherever one genuinely captures the same thing, and build a
// real new computation only where nothing existing does.
//
// Illustration Quality and Visual Richness are both real composites of
// `computeBotanicalBeautyMetrics`'s own already-computed sub-dimensions
// (Build 004, Section 10) -- not two independently re-derived numbers
// that could silently drift from what that module actually measures:
//  - Illustration Quality: how much a tile's botanical shapes read as
//    crafted illustrations rather than generic icons -- averages
//    `botanicalRealism` (has real grown structure), `botanicalComplexity`
//    (real SVG detail per instance), and `assetHarmony` (the different
//    botanical assets read as one coherent palette).
//  - Visual Richness: how visually rewarding the overall composition
//    reads -- averages `silhouetteBeauty` (connected, non-fragmented
//    ink), `luxuryFeeling` (contrast/detail/palette richness), and
//    `organicFlow` (real rhythm without reading as a mechanical grid).
//
// Species Diversity is genuinely new: nothing in this codebase previously
// tracked which Botanical Family a *portfolio* of many tiles collectively
// used (a single tile commits to one family via `botanicalFamily`, by the
// Build 004 design Section 4/9 established -- "species diversity within
// one tile" isn't a concept the engine produces). This measures the
// fraction of the engine's own real 18-family taxonomy a portfolio
// (or any batch of resolved params) actually exercised -- a portfolio
// that only ever resolves to 2 of 18 families reads as repetitive no
// matter how good any single tile looks.

export function computeIllustrationQuality(botanical: BotanicalBeautyMetrics): number {
  return Math.round((botanical.botanicalRealism + botanical.botanicalComplexity + botanical.assetHarmony) / 3);
}

export function computeVisualRichness(botanical: BotanicalBeautyMetrics): number {
  return Math.round((botanical.silhouetteBeauty + botanical.luxuryFeeling + botanical.organicFlow) / 3);
}

/** Fraction (0-100) of the engine's real `BOTANICAL_FAMILIES` taxonomy
 * that actually appears across `families` (typically one portfolio run's
 * worth of resolved botanical families, `undefined` entries from
 * non-botanical patterns filtered out before counting). */
export function computeSpeciesDiversity(families: Array<BotanicalFamily | undefined>): number {
  const used = new Set(families.filter((f): f is BotanicalFamily => f !== undefined));
  if (BOTANICAL_FAMILIES.length === 0) return 0;
  return Math.round((used.size / BOTANICAL_FAMILIES.length) * 100);
}

// Build 006, Section 9 (Large Portfolio Evaluation): the brief asks for
// "composition diversity", "cluster diversity", and "hero diversity"
// alongside the pre-existing species diversity, on the 300-pattern
// portfolio. Following the exact same honesty convention Species
// Diversity established (measure the real fraction of an already-real,
// fixed taxonomy a run actually exercised -- never an invented score):
//
//  - Composition Diversity: fraction of the engine's real `LayoutId`
//    taxonomy (see engine/types.ts) a run's resolved layouts actually used.
//  - Cluster Diversity: fraction of the real 3-value Illustration Family
//    template taxonomy (bouquet/spray/branch -- Build 005, Section 5) a
//    run's botanical hero species actually resolved to, via the exact same
//    `illustrationTemplateForSpecies` `buildPremiumHero` itself calls (not
//    a re-derived duplicate rule).
//  - Hero Diversity: fraction of the real 8-value botanical silhouette
//    taxonomy (Build 005, Section 4) a run's botanical hero species
//    actually covered -- a genuinely different facet from Species
//    Diversity (a portfolio could use many distinct species that all
//    happen to share one silhouette, or few species spanning many
//    silhouettes; this measures the latter).

/** Fraction (0-100) of the engine's real `LayoutId` taxonomy that actually
 * appears across `layoutIds` (typically one portfolio run's worth of
 * resolved layouts). `totalLayoutCount` is the real, current size of that
 * taxonomy (pass `Object.keys(LAYOUTS).length`, never hand-counted) so this
 * can never silently drift out of sync with the engine's own layout list. */
export function computeCompositionDiversity(layoutIds: LayoutId[], totalLayoutCount: number): number {
  if (totalLayoutCount === 0) return 0;
  const used = new Set(layoutIds);
  return Math.round((used.size / totalLayoutCount) * 100);
}

/** Fraction (0-100) of the 3 real Illustration Family templates
 * (bouquet/spray/branch) a run's botanical hero species actually resolved
 * to, via the same `illustrationTemplateForSpecies` the hero-assembly code
 * itself calls. `undefined` entries (non-botanical patterns) are ignored. */
export function computeClusterDiversity(families: Array<BotanicalFamily | undefined>): number {
  const templateIds = new Set<IllustrationTemplateId>();
  for (const f of families) {
    if (f === undefined) continue;
    templateIds.add(illustrationTemplateForSpecies(BOTANICAL_SPECIES[f]).id);
  }
  const TOTAL_TEMPLATES = 3;
  return Math.round((templateIds.size / TOTAL_TEMPLATES) * 100);
}

/** Fraction (0-100) of the engine's real 8-value botanical silhouette
 * taxonomy (`BOTANICAL_SILHOUETTES`) a run's botanical hero species
 * actually covered -- distinct from Species Diversity (species count),
 * since several species can share one silhouette or a few species can
 * span many. `undefined` entries (non-botanical patterns) are ignored. */
export function computeHeroDiversity(families: Array<BotanicalFamily | undefined>): number {
  const silhouettes = new Set(
    families.filter((f): f is BotanicalFamily => f !== undefined).map((f) => BOTANICAL_SPECIES[f].silhouette),
  );
  if (BOTANICAL_SILHOUETTES.length === 0) return 0;
  return Math.round((silhouettes.size / BOTANICAL_SILHOUETTES.length) * 100);
}
