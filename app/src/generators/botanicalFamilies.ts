import type { Rng } from '../engine/types';
import { rngPick } from '../engine/rng';
import type { GROWTH_PRESETS } from './growth';

// Build 004, Section 2: the original 15 named botanical families -- a real
// taxonomy (as opposed to `motifFactory.ts`'s coarse `'flower'` MotifFamily
// or a plain `rngPick`), but each family owned nothing of its own beyond a
// label used to filter `botanical.ts`'s variant pool.
//
// Build 005, Section 4 (Botanical Species Engine): every family now owns
// real design data -- `BOTANICAL_SPECIES` below -- instead of being just a
// filter key. Adds 3 first-class species the brief names that previously
// had no real geometry of their own: `ranunculus` (previously only a
// variant *tagged* `family: 'rose'`; `botanical.ts` now gives `'rose'` its
// own distinct bloom and retags the tight-spiral variant to `ranunculus`,
// so both read as genuinely different species rather than one shape
// answering to two names), `protea` (new bract-cone bloom), and
// `tropicalLeaf` (reuses `generators/tropical.ts`'s real palm-frond/
// monstera geometry -- already-shipped illustration quality, just not
// previously reachable through the Botanical Family taxonomy).
// Build 006, Section 3 (Natural Botanical Relationships): adds `babysBreath`
// -- the archetypal real-florist filler species (Gypsophila) named in the
// brief's own pairing example ("rose paired with eucalyptus, baby's
// breath, berries, olive leaves") that had no first-class species of its
// own before this build (previously only reachable as generic
// `wildflower`/`cosmos` filler geometry).
export type BotanicalFamily =
  | 'rose'
  | 'peony'
  | 'tulip'
  | 'anemone'
  | 'magnolia'
  | 'hydrangea'
  | 'cosmos'
  | 'wildflower'
  | 'daisy'
  | 'lavender'
  | 'eucalyptus'
  | 'olive'
  | 'fern'
  | 'berryBranch'
  | 'herb'
  | 'ranunculus'
  | 'protea'
  | 'tropicalLeaf'
  | 'babysBreath';

export const BOTANICAL_FAMILIES: BotanicalFamily[] = [
  'rose',
  'peony',
  'tulip',
  'anemone',
  'magnolia',
  'hydrangea',
  'cosmos',
  'wildflower',
  'daisy',
  'lavender',
  'eucalyptus',
  'olive',
  'fern',
  'berryBranch',
  'herb',
  'ranunculus',
  'protea',
  'tropicalLeaf',
  'babysBreath',
];

/** A species' real, owned design knowledge -- not just a shape-pool filter
 * key. `growthPreset` points at an actual `GROWTH_PRESETS` entry
 * (generators/growth.ts), so a species genuinely drives which stem
 * curvature/leaf arrangement/leaf taper gets used wherever this profile is
 * consulted (see `generators/premiumHero.ts`'s `buildPremiumHero`, Build
 * 005 Section 4's wiring point), rather than every family sharing one
 * hardcoded preset regardless of species. `stemLengthScale`/
 * `leafDensityScale` are relative multipliers (1 = a size-neutral
 * baseline); `silhouette` and `bouquetRole` are the real, honest read a
 * surface pattern designer would give the species at a glance -- used by
 * later Build 005 sections (Design Knowledge/Rule Engine, Designer Brain)
 * to make composition choices instead of a uniform random pick, not
 * decorative labels. */
export interface BotanicalSpeciesProfile {
  label: string;
  silhouette: 'rounded' | 'layered' | 'spiky' | 'airy' | 'architectural' | 'wispy' | 'clustered' | 'broadLeaf';
  growthPreset: keyof typeof GROWTH_PRESETS;
  stemLengthScale: number;
  leafDensityScale: number;
  bouquetRole: 'statement' | 'supporting' | 'filler' | 'foliageOnly';
  /** Build 006, Section 3 (Natural Botanical Relationships): the real
   * companion species a professional florist/surface designer would pair
   * this one WITH for its supporting foliage/filler roles -- e.g. a rose
   * bouquet's non-hero members are traditionally eucalyptus/baby's-breath/
   * berries, never another rose. `foliageOnly`/`filler` species are the
   * companions themselves (that's what they're for), so their own list is
   * intentionally empty rather than fabricated -- documented here, not
   * silently omitted. Consulted by `pickCompanionFamily` below; a species
   * with an empty list simply keeps using its own family for every role,
   * reproducing pre-Build-006 behavior exactly. */
  companionFamilies: BotanicalFamily[];
}

export const BOTANICAL_SPECIES: Record<BotanicalFamily, BotanicalSpeciesProfile> = {
  rose: { label: 'Rose', silhouette: 'layered', growthPreset: 'leafyBranch', stemLengthScale: 1.0, leafDensityScale: 0.9, bouquetRole: 'statement', companionFamilies: ['eucalyptus', 'babysBreath', 'berryBranch'] },
  peony: { label: 'Peony', silhouette: 'rounded', growthPreset: 'leafyBranch', stemLengthScale: 0.9, leafDensityScale: 0.85, bouquetRole: 'statement', companionFamilies: ['eucalyptus', 'fern', 'olive'] },
  tulip: { label: 'Tulip', silhouette: 'architectural', growthPreset: 'leafyBranch', stemLengthScale: 1.1, leafDensityScale: 0.5, bouquetRole: 'supporting', companionFamilies: ['eucalyptus', 'fern'] },
  anemone: { label: 'Anemone', silhouette: 'rounded', growthPreset: 'sage', stemLengthScale: 1.0, leafDensityScale: 0.7, bouquetRole: 'supporting', companionFamilies: ['olive', 'fern', 'babysBreath'] },
  magnolia: { label: 'Magnolia', silhouette: 'layered', growthPreset: 'laurel', stemLengthScale: 0.8, leafDensityScale: 0.6, bouquetRole: 'statement', companionFamilies: ['olive', 'fern'] },
  hydrangea: { label: 'Hydrangea', silhouette: 'rounded', growthPreset: 'leafyBranch', stemLengthScale: 0.85, leafDensityScale: 0.8, bouquetRole: 'statement', companionFamilies: ['eucalyptus', 'fern', 'berryBranch'] },
  cosmos: { label: 'Cosmos', silhouette: 'airy', growthPreset: 'sage', stemLengthScale: 1.2, leafDensityScale: 0.4, bouquetRole: 'filler', companionFamilies: ['wildflower', 'babysBreath', 'herb'] },
  wildflower: { label: 'Wild Meadow', silhouette: 'airy', growthPreset: 'sage', stemLengthScale: 1.1, leafDensityScale: 0.5, bouquetRole: 'filler', companionFamilies: ['cosmos', 'babysBreath', 'herb', 'lavender'] },
  daisy: { label: 'Daisy', silhouette: 'rounded', growthPreset: 'sage', stemLengthScale: 1.0, leafDensityScale: 0.5, bouquetRole: 'filler', companionFamilies: ['wildflower', 'babysBreath', 'herb'] },
  lavender: { label: 'Lavender', silhouette: 'spiky', growthPreset: 'herbWhorl', stemLengthScale: 1.15, leafDensityScale: 0.6, bouquetRole: 'filler', companionFamilies: ['olive', 'herb', 'wildflower'] },
  eucalyptus: { label: 'Eucalyptus', silhouette: 'wispy', growthPreset: 'eucalyptus', stemLengthScale: 1.2, leafDensityScale: 1.1, bouquetRole: 'foliageOnly', companionFamilies: [] },
  olive: { label: 'Olive', silhouette: 'wispy', growthPreset: 'olive', stemLengthScale: 1.1, leafDensityScale: 1.0, bouquetRole: 'foliageOnly', companionFamilies: [] },
  fern: { label: 'Fern', silhouette: 'clustered', growthPreset: 'fern', stemLengthScale: 0.9, leafDensityScale: 1.4, bouquetRole: 'foliageOnly', companionFamilies: [] },
  berryBranch: { label: 'Berry Branch', silhouette: 'clustered', growthPreset: 'laurel', stemLengthScale: 1.0, leafDensityScale: 0.7, bouquetRole: 'supporting', companionFamilies: ['eucalyptus', 'olive'] },
  herb: { label: 'Herb', silhouette: 'wispy', growthPreset: 'sage', stemLengthScale: 0.9, leafDensityScale: 0.9, bouquetRole: 'foliageOnly', companionFamilies: [] },
  ranunculus: { label: 'Ranunculus', silhouette: 'layered', growthPreset: 'leafyBranch', stemLengthScale: 0.95, leafDensityScale: 0.7, bouquetRole: 'statement', companionFamilies: ['eucalyptus', 'babysBreath', 'berryBranch'] },
  protea: { label: 'Protea', silhouette: 'architectural', growthPreset: 'basalRosette', stemLengthScale: 1.0, leafDensityScale: 0.5, bouquetRole: 'statement', companionFamilies: ['eucalyptus', 'fern', 'tropicalLeaf'] },
  tropicalLeaf: { label: 'Tropical Leaf', silhouette: 'broadLeaf', growthPreset: 'leafyBranch', stemLengthScale: 1.0, leafDensityScale: 0.3, bouquetRole: 'foliageOnly', companionFamilies: [] },
  babysBreath: { label: "Baby's Breath", silhouette: 'airy', growthPreset: 'sage', stemLengthScale: 1.1, leafDensityScale: 0.3, bouquetRole: 'filler', companionFamilies: [] },
};

/** All distinct `silhouette` values the species taxonomy actually uses --
 * a real, fixed-size set (currently 8) consulted by Build 006, Section 9's
 * Hero Diversity measurement (`engine/portfolioQuality.ts`). Derived from
 * `BotanicalSpeciesProfile`'s own type union, not hand-counted separately,
 * so it can't silently drift out of sync with the interface. */
export const BOTANICAL_SILHOUETTES: BotanicalSpeciesProfile['silhouette'][] = [
  'rounded', 'layered', 'spiky', 'airy', 'architectural', 'wispy', 'clustered', 'broadLeaf',
];

/** Picks a real companion species for `primary`'s supporting/filler/accent
 * bouquet roles -- e.g. a Rose hero pairs with Eucalyptus/Baby's-Breath/
 * Berries, never another Rose. Falls back to `primary` itself (byte-
 * identical to pre-Build-006 behavior) when the species has no companion
 * list (every `foliageOnly`/`filler` species -- they ARE the companions)
 * or no `family` hint was given at all. Picked ONCE per hero (not once per
 * member) by the caller so a single bouquet reads as one coherent pairing,
 * not a different random companion on every filler. */
export function pickCompanionFamily(rng: Rng, primary: BotanicalFamily | undefined): BotanicalFamily | undefined {
  if (!primary) return primary;
  const companions = BOTANICAL_SPECIES[primary].companionFamilies;
  if (companions.length === 0) return primary;
  return rngPick(rng, companions);
}
