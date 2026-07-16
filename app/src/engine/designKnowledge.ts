import type { StyleDna } from './styleDna';
import { HIERARCHY_PRESETS } from './hierarchy';
import { BOTANICAL_SPECIES } from '../generators/botanicalFamilies';

// Build 005, Section 1 (Design Knowledge Engine): the brief's own framing
// is that Build 001-004 already gave the engine composition intelligence
// (zones, rotation families, cluster archetypes, hierarchy ratios...) but
// none of it is expressed as a *design language* -- a professional surface
// pattern designer doesn't think "heroRatio 0.3, clusterDensity 0.6"; they
// think "large bouquets, calm rhythm, balanced negative space." Every
// `StyleDna` preset already carries the real numbers that produce that
// read (hierarchyPreset, density, negativeSpace, clusterDensity,
// motifComplexity, premiumHero, flowProfile, and -- since Build 005
// Section 4 -- each preferred Botanical Family's own stem/leaf design
// data). This module is the missing translation layer: a real,
// deterministic function from a Style DNA's own already-real fields into
// a named `DesignKnowledgeProfile` -- never a second, independently-tuned
// copy of numbers that could drift from what the engine actually does.
//
// Deliberately NOT a per-style hand-authored table (that would be exactly
// the "second copy that can drift" this build's own predecessors always
// avoid) -- every dimension below is *computed* from the style's existing
// fields via documented, honest thresholds.

export type HeroCountTier = 'single' | 'few' | 'many';
export type DensityTier = 'sparse' | 'moderate' | 'dense';
export type SpaceTier = 'minimal' | 'balanced' | 'generous';
export type SizeTier = 'small' | 'medium' | 'large';
export type LengthTier = 'short' | 'medium' | 'long';
export type BouquetSizeTier = 'single' | 'small' | 'full';

export interface DesignKnowledgeProfile {
  /** How many placements per tile read as a hero, from the resolved
   * HierarchyParams' own `heroRatio` -- not a separate invented count. */
  heroCount: HeroCountTier;
  /** The style's own `clusterDensity` dial (already real), tiered. */
  clusterDensity: DensityTier;
  /** The style's own `negativeSpace` dial (already real), tiered. */
  negativeSpaceLevel: SpaceTier;
  /** From the resolved hierarchy's own `heroScale` -- how large a hero
   * reads relative to a baseline motif. */
  flowerSize: SizeTier;
  /** Averaged from `BOTANICAL_SPECIES[family].stemLengthScale` across the
   * style's `preferredFamilies` (Build 005, Section 4's real per-species
   * data) -- 'medium' (neutral) for a style with no botanical family
   * preference at all. */
  stemLength: LengthTier;
  /** Averaged from `BOTANICAL_SPECIES[family].leafDensityScale` the same
   * way as `stemLength`. */
  leafDensity: DensityTier;
  /** Whether/how full a hero's own multi-part bouquet assembly should
   * read -- 'single' when the style doesn't opt into `premiumHero` at
   * all (a plain independent hero, not a bouquet), otherwise tiered by
   * `clusterDensity`. */
  bouquetSize: BouquetSizeTier;
  /** The style's own `flowProfile` (already a real, named enum) -- kept
   * under its own name here since "rhythm" is how a designer would
   * actually describe it, not renamed to hide that it's the same field. */
  rhythm: StyleDna['flowProfile'];
  /** Short, human-readable design notes assembled from the tiers above --
   * the "Large bouquets / Calm rhythm / Balanced negative space" reading
   * the brief asks for. Informational (drives no further behavior itself;
   * `resolveDesignRules` below consumes the typed tiers, not this list). */
  traits: string[];
}

function tier3(value: number, lowMax: number, midMax: number): 0 | 1 | 2 {
  if (value <= lowMax) return 0;
  if (value <= midMax) return 1;
  return 2;
}

function averageSpeciesField(families: string[] | undefined, field: 'stemLengthScale' | 'leafDensityScale'): number | undefined {
  if (!families || families.length === 0) return undefined;
  const values = families.map((f) => BOTANICAL_SPECIES[f as keyof typeof BOTANICAL_SPECIES]?.[field]).filter((v): v is number => v !== undefined);
  if (values.length === 0) return undefined;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Computes a Style DNA's real Design Knowledge Profile. Pure function of
 * the style's own already-shipped fields -- calling this twice for the
 * same `dna` always returns the same profile (no randomness involved;
 * knowledge is a fixed property of the style, not a per-seed roll). */
export function computeDesignKnowledgeProfile(dna: StyleDna): DesignKnowledgeProfile {
  const hierarchy = HIERARCHY_PRESETS[dna.hierarchyPreset].value;

  const heroCountIdx = tier3(hierarchy.heroRatio, 0.05, 0.15);
  const heroCount: HeroCountTier = (['single', 'few', 'many'] as const)[heroCountIdx];

  const clusterDensityIdx = tier3(dna.clusterDensity, 0.25, 0.45);
  const clusterDensity: DensityTier = (['sparse', 'moderate', 'dense'] as const)[clusterDensityIdx];

  const spaceIdx = tier3(dna.negativeSpace, 0.15, 0.35);
  const negativeSpaceLevel: SpaceTier = (['minimal', 'balanced', 'generous'] as const)[spaceIdx];

  const flowerSizeIdx = tier3(hierarchy.heroScale, 1.5, 2.0);
  const flowerSize: SizeTier = (['small', 'medium', 'large'] as const)[flowerSizeIdx];

  const avgStemScale = averageSpeciesField(dna.preferredFamilies, 'stemLengthScale');
  const stemLengthIdx = avgStemScale === undefined ? 1 : tier3(avgStemScale, 0.95, 1.1);
  const stemLength: LengthTier = (['short', 'medium', 'long'] as const)[stemLengthIdx];

  const avgLeafScale = averageSpeciesField(dna.preferredFamilies, 'leafDensityScale');
  const leafDensityIdx = avgLeafScale === undefined ? 1 : tier3(avgLeafScale, 0.6, 1.0);
  const leafDensity: DensityTier = (['sparse', 'moderate', 'dense'] as const)[leafDensityIdx];

  const bouquetSize: BouquetSizeTier = !dna.premiumHero ? 'single' : dna.clusterDensity < 0.4 ? 'small' : 'full';

  const traits: string[] = [];
  if (bouquetSize === 'full' && flowerSize === 'large') traits.push('Large bouquets');
  if (dna.rhythmProfile === 'organic') traits.push('Soft movement');
  if (negativeSpaceLevel !== 'minimal') traits.push(negativeSpaceLevel === 'generous' ? 'Generous negative space' : 'Balanced negative space');
  if (heroCount !== 'single' && hierarchy.heroScale >= 2.0) traits.push('Premium hierarchy');
  if (dna.premiumHero) traits.push('Layered flowers');
  if (dna.flowProfile === 'calm') traits.push('Calm rhythm');
  if (stemLength === 'long' && leafDensity === 'sparse') traits.push('Long branches');
  if (stemLength === 'short') traits.push('Thin stems');
  if (clusterDensity === 'sparse' && negativeSpaceLevel === 'generous') traits.push('Maximum whitespace', 'Simple silhouettes');
  if (dna.rhythmProfile === 'regular' && dna.clusterStyle === 'none') traits.push('Repeat rhythm');

  return { heroCount, clusterDensity, negativeSpaceLevel, flowerSize, stemLength, leafDensity, bouquetSize, rhythm: dna.flowProfile, traits };
}

// Build 005, Section 2 (Design Rule Engine): converts the Design Knowledge
// Profile above into concrete generation-rule numbers -- the part the
// brief means by "Every Style DNA must generate using its own rules,"
// distinct from Section 1's descriptive read. Consumed today by
// `generators/premiumHero.ts`'s `buildPremiumHero` (see its own
// `designRules` option) so a style's hero-count/bouquet-size/stem-length/
// leaf-density knowledge genuinely changes the assembled hero's geometry,
// on top of (not instead of) the per-species scaling Section 4 already
// wired in -- the two multiply together, so a "long stem" style drawing a
// naturally long-stemmed species (e.g. Eucalyptus) reads as longer still,
// while a "long stem" style forced into a naturally short species still
// reads longer than that same style's own short-stem counterpart.
export interface DesignGenerationRules {
  heroMemberCountRange: [number, number];
  bouquetBaseRadiusScale: number;
  stemLengthMultiplier: number;
  leafDensityMultiplier: number;
}

const HERO_COUNT_MEMBER_RANGE: Record<HeroCountTier, [number, number]> = {
  single: [3, 4],
  few: [4, 6],
  many: [5, 7],
};
const BOUQUET_SIZE_RADIUS_SCALE: Record<BouquetSizeTier, number> = {
  single: 0.85,
  small: 1.0,
  full: 1.2,
};
const STEM_LENGTH_MULTIPLIER: Record<LengthTier, number> = {
  short: 0.75,
  medium: 1.0,
  long: 1.3,
};
const LEAF_DENSITY_MULTIPLIER: Record<DensityTier, number> = {
  sparse: 0.7,
  moderate: 1.0,
  dense: 1.3,
};

export function resolveDesignRules(profile: DesignKnowledgeProfile): DesignGenerationRules {
  return {
    heroMemberCountRange: HERO_COUNT_MEMBER_RANGE[profile.heroCount],
    bouquetBaseRadiusScale: BOUQUET_SIZE_RADIUS_SCALE[profile.bouquetSize],
    stemLengthMultiplier: STEM_LENGTH_MULTIPLIER[profile.stemLength],
    leafDensityMultiplier: LEAF_DENSITY_MULTIPLIER[profile.leafDensity],
  };
}
