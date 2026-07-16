import type { BotanicalBeautyMetrics } from './botanicalBeautyMetrics';
import { BOTANICAL_FAMILIES, type BotanicalFamily } from '../generators/botanicalFamilies';

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
