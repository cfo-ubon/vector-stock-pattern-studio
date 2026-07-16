import type { BotanicalBeautyMetrics } from './botanicalBeautyMetrics';
import { BOTANICAL_FAMILIES, BOTANICAL_SPECIES, BOTANICAL_SILHOUETTES, type BotanicalFamily } from '../generators/botanicalFamilies';
import { illustrationTemplateForSpecies, type IllustrationTemplateId } from '../generators/illustrationFamily';
import { HERO_ARCHETYPE_POOL } from '../generators/premiumHero';
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

// Build 009, Section 6 (Silhouette Optimization) -- directly fulfills
// Build 008B, Section 7's own §15.2 deferred recommendation: "a real
// portfolio-level hero silhouette diversity metric" for
// `resolveHeroArchetype`'s roll. `Motif.heroArchetype` (threaded back
// through `buildPremiumHero` -> `TileData.premiumHeroArchetypes` ->
// `scripts/qualityReport.ts`) now carries the real archetype every premium
// hero actually resolved to, so this follows the exact same "fraction of
// the real, reachable taxonomy a run actually used" convention every other
// diversity metric in this module already established -- `HERO_ARCHETYPE_POOL`
// (premiumHero.ts) is the honest denominator (5 reachable archetypes, not
// the full 13-value `ClusterArchetype` union most of which `resolveHeroArchetype`
// can never actually return).

/** Fraction (0-100) of the 5 real, reachable hero-assembly archetypes
 * (`HERO_ARCHETYPE_POOL`) a portfolio run's premium heroes actually used.
 * `archetypes` is typically every `TileData.premiumHeroArchetypes` entry
 * flattened across a portfolio run; an empty input (no premium heroes
 * anywhere in the run) returns 0 rather than a misleading 100 -- nothing
 * was exercised, so nothing should read as "fully diverse". */
export function computeHeroArchetypeDiversity(archetypes: string[]): number {
  if (archetypes.length === 0 || HERO_ARCHETYPE_POOL.length === 0) return 0;
  const used = new Set(archetypes);
  return Math.round((used.size / HERO_ARCHETYPE_POOL.length) * 100);
}

/** Build 010, Section 9 (Commercial Validation Suite) — Signature Style
 * Engine (Section 8) measurement: the audit's own honesty requirement was
 * "verify each new field... produces a *measurably* distinct fingerprint
 * per preset... rather than 15 presets that all resolve to visually
 * indistinguishable output." Each entry is one Style DNA preset's own
 * `(depthStrength, professionalRules, premiumRhythm)` signature (Section 8's
 * new resolved fields); this counts the fraction (0-100) of all preset
 * PAIRS whose signatures genuinely differ -- 0 would mean every preset
 * resolved to the exact same fingerprint (the failure mode the audit
 * warned against), 100 would mean no two presets share a fingerprint at
 * all. A real, computed measurement of declared data (not a fabricated
 * score), following this module's own "fraction of an actual taxonomy
 * exercised" convention. */
export interface SignatureFingerprint {
  depthStrength: number | undefined;
  professionalRules: boolean | undefined;
  premiumRhythm: boolean | undefined;
}

export function computeSignatureFingerprintDistinctness(fingerprints: SignatureFingerprint[]): number {
  if (fingerprints.length < 2) return 0;
  const key = (f: SignatureFingerprint) => `${f.depthStrength ?? 'none'}|${f.professionalRules ?? 'none'}|${f.premiumRhythm ?? 'none'}`;
  let distinctPairs = 0;
  let totalPairs = 0;
  for (let i = 0; i < fingerprints.length; i++) {
    for (let j = i + 1; j < fingerprints.length; j++) {
      totalPairs++;
      if (key(fingerprints[i]) !== key(fingerprints[j])) distinctPairs++;
    }
  }
  return totalPairs === 0 ? 0 : Math.round((distinctPairs / totalPairs) * 100);
}

// Build 011, Section 8 (Portfolio Consistency Engine): the brief asks
// whether 1000 generated images "feel like one premium brand" -- the
// opposite question from Section 5's Silhouette Diversity / this file's
// own `computeSignatureFingerprintDistinctness` above (which measure
// whether *different* presets stay genuinely distinct from each other).
// Here the question is whether *the same* preset's own many independent
// generations stay tight around one coherent quality/character, or
// visibly scatter -- reusing the exact "coefficient of variation,
// inverted" idiom `scoring.ts`'s own `computeSpacing` already established
// (low variance relative to the mean = high consistency), applied to a
// small set of already-real headline commercial metrics instead of
// inventing a new "brand consistency" concept from scratch.

function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean <= 0) return 0;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

export interface PortfolioConsistencySample {
  absoluteCommercialQuality: number;
  luxuryCompositionOverall: number;
  luxuryFeeling: number;
  /** Optional per-tile Style DNA drift-vs-intent score
   * (`computeStyleDnaConsistency`, `styleDna.ts`) -- folded in as a second,
   * genuinely different signal alongside cross-tile spread: low spread
   * between tiles isn't really "one coherent brand" if every tile also
   * drifted equally far from what that brand's own Style DNA declared.
   * Omitted for a portfolio with no active Style DNA (no drift-vs-intent
   * concept applies without one). */
  styleDnaConsistency?: number;
}

/** How tightly one preset's own portfolio slice of `samples` clusters
 * around a shared quality/character, 0-100 (100 = every sample reads
 * identically, following the same scale `computeSpacing` uses for its own
 * inverted coefficient-of-variation). Requires >= 2 samples to have any
 * spread to measure at all; a single-tile "portfolio" trivially reads as
 * 100 (nothing for it to disagree with). When at least one sample supplies
 * `styleDnaConsistency`, the mean of those per-tile drift-vs-intent scores
 * is averaged in as a second real signal; otherwise this is the spread
 * score alone. */
export function computePortfolioConsistency(samples: PortfolioConsistencySample[]): number {
  if (samples.length < 2) return 100;
  const cvs = [
    coefficientOfVariation(samples.map((s) => s.absoluteCommercialQuality)),
    coefficientOfVariation(samples.map((s) => s.luxuryCompositionOverall)),
    coefficientOfVariation(samples.map((s) => s.luxuryFeeling)),
  ];
  const meanCv = cvs.reduce((a, b) => a + b, 0) / cvs.length;
  const spreadConsistency = Math.max(0, Math.min(100, 100 - meanCv * 100));
  const driftScores = samples.map((s) => s.styleDnaConsistency).filter((v): v is number => v !== undefined);
  if (driftScores.length === 0) return Math.round(spreadConsistency);
  const meanDrift = driftScores.reduce((a, b) => a + b, 0) / driftScores.length;
  return Math.round((spreadConsistency + meanDrift) / 2);
}

export interface SequentialDriftResult {
  /** Mean of the first half of the ordered sequence. */
  firstHalfMean: number;
  /** Mean of the second half. */
  secondHalfMean: number;
  /** |secondHalfMean - firstHalfMean| as a fraction of the overall mean
   * (0 = no shift). */
  driftMagnitude: number;
  /** True once `driftMagnitude` crosses 0.15 (a 15% relative shift between
   * halves) -- the same order of magnitude `scoring.ts`'s own
   * `computeSpacingUniformity` uses (0.35 coefficient-of-variation) to mark
   * "a real, noticeable effect" rather than ordinary sample noise. */
  driftDetected: boolean;
}

/** Build 011, Section 8's other genuinely missing half: every existing
 * quality measurement in this codebase is a flat, order-independent
 * aggregate over a sample -- nothing asks "does quality/character degrade
 * or wander as you generate seed 1 through seed 1000, in that order."
 * `orderedValues` should be one already-real headline metric (e.g.
 * `absoluteCommercialQuality`) taken in actual generation order; this
 * compares the sequence's first half against its second half -- a real,
 * honest first-vs-second-half comparison, not a fabricated "trend score".
 * Fewer than 4 samples has no meaningful half-vs-half comparison to make. */
export function detectSequentialStyleDrift(orderedValues: number[]): SequentialDriftResult {
  if (orderedValues.length < 4) {
    return { firstHalfMean: 0, secondHalfMean: 0, driftMagnitude: 0, driftDetected: false };
  }
  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const mid = Math.floor(orderedValues.length / 2);
  const firstHalfMean = mean(orderedValues.slice(0, mid));
  const secondHalfMean = mean(orderedValues.slice(mid));
  const overallMean = mean(orderedValues);
  const driftMagnitude = overallMean > 0 ? Math.abs(secondHalfMean - firstHalfMean) / overallMean : 0;
  return {
    firstHalfMean: Math.round(firstHalfMean),
    secondHalfMean: Math.round(secondHalfMean),
    driftMagnitude: Math.round(driftMagnitude * 1000) / 1000,
    driftDetected: driftMagnitude > 0.15,
  };
}
