import type { BotanicalSpeciesProfile } from './botanicalFamilies';
import type { BotanicalPart } from './botanicalParts';

// Build 005, Section 5 (Illustration Family Engine): the brief asks for
// named composite objects -- "Rose Bouquet, Peony Spray, Olive Branch,
// Fern Cluster, Lavender Stem, Wildflower Spray" -- each acting as one
// placeable illustration rather than a loose pile of independently-picked
// shapes. `generators/premiumHero.ts`'s `buildPremiumHero` (Build 004,
// Section 8) already assembles one composite object per hero placement,
// but used exactly one part-role mapping for every species regardless of
// whether that species is a full bloom (Rose) or pure foliage (Olive,
// Fern) -- a foliage-only family could still get assigned `part: 'berry'`/
// `'bud'`/`'secondaryFlower'` for its supporting members, which either
// falls back to the unfiltered pool (a random unrelated flower/berry
// shape breaking the illustration's coherence) or draws parts that don't
// exist for that species.
//
// Rather than fabricate one distinct named template per individual
// species (6+ near-duplicate templates that would only really differ by
// label, not behavior -- the same "no padding" call Build 004 made when
// merging "Bouquet Type" into "Cluster Type"), this models the 3
// genuinely distinct part-role *behaviors* a real designer would use,
// keyed off each species' own real `bouquetRole` (already-shipped Build
// 005 Section 4 data, not a new fabricated field):
//  - `bouquet`: a full bloom as the hero, with a real Calyx (Section 3)
//    under it, buds/secondary blooms supporting it, berries as filler --
//    Rose Bouquet, Peony Spray (statement/supporting-role species).
//  - `spray`: smaller, more numerous blooms with no single dominant hero
//    treatment and no calyx (a loose spray reads as many small flowers,
//    not one premium bloom) -- Wildflower Spray, Lavender Stem
//    (filler-role species).
//  - `branch`: leaf/leaf-cluster parts throughout, no flower/bud/berry
//    parts at all -- Olive Branch, Fern Cluster, Eucalyptus (foliage-only
//    species), so a foliage species' composite never mixes in an
//    unrelated flower or berry shape.
export type IllustrationTemplateId = 'bouquet' | 'spray' | 'branch';

export interface IllustrationTemplate {
  id: IllustrationTemplateId;
  heroPart: BotanicalPart;
  secondaryParts: [BotanicalPart, BotanicalPart];
  fillerPart: BotanicalPart;
  accentPart: BotanicalPart;
  usesCalyx: boolean;
}

export const ILLUSTRATION_TEMPLATES: Record<IllustrationTemplateId, IllustrationTemplate> = {
  bouquet: {
    id: 'bouquet',
    heroPart: 'heroFlower',
    secondaryParts: ['bud', 'secondaryFlower'],
    fillerPart: 'berry',
    accentPart: 'tinyAccent',
    usesCalyx: true,
  },
  spray: {
    id: 'spray',
    heroPart: 'heroFlower',
    secondaryParts: ['secondaryFlower', 'bud'],
    fillerPart: 'berry',
    accentPart: 'tinyAccent',
    usesCalyx: false,
  },
  branch: {
    id: 'branch',
    heroPart: 'leafCluster',
    secondaryParts: ['leaf', 'leafCluster'],
    fillerPart: 'leaf',
    accentPart: 'tinyAccent',
    usesCalyx: false,
  },
};

/** Picks the real illustration template for a species' own `bouquetRole` --
 * `undefined` (no family hint) falls back to `bouquet`, the original
 * Build 004 Section 8 behavior, so an un-hinted premium hero is unchanged. */
export function illustrationTemplateForSpecies(species?: BotanicalSpeciesProfile): IllustrationTemplate {
  if (!species) return ILLUSTRATION_TEMPLATES.bouquet;
  if (species.bouquetRole === 'foliageOnly') return ILLUSTRATION_TEMPLATES.branch;
  if (species.bouquetRole === 'filler') return ILLUSTRATION_TEMPLATES.spray;
  return ILLUSTRATION_TEMPLATES.bouquet;
}
