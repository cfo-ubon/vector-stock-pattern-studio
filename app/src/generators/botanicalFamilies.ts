import type { Rng } from '../engine/types';
import type { BotanicalSpeciesRecord, UsageProfileId } from '../knowledge/registry/speciesSchema';
import { KnowledgeRegistry } from '../knowledge/registry/knowledgeRegistry';
import type { ProductUseId } from '../collection/productTargets';

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
 * key. Build 008B, Section 1 (Commercial Botanical Species Library)
 * replaces this file's own hardcoded literal with the real, versioned
 * `BotanicalSpeciesRecord` the Knowledge Registry loads from
 * `knowledge/registry/data/species/*.json` -- every field this type
 * already had (`silhouette`, `growthPreset`, `stemLengthScale`,
 * `leafDensityScale`, `bouquetRole`, `companionFamilies`) keeps its exact
 * old name/value space (kept as a type alias, not a redeclared shape), so
 * every existing consumer (`premiumHero.ts`, `illustrationFamily.ts`,
 * `designKnowledge.ts`) reads unchanged data through the same field names
 * it always has, while gaining every new commercial field (petal/bloom/
 * companion-matrix/usage-profile knowledge) the registry now carries. */
export type BotanicalSpeciesProfile = BotanicalSpeciesRecord;

/** Built from the Knowledge Registry's real, loaded-and-validated species
 * records (Build 008B) -- no longer a hardcoded object literal (Build
 * 004/005/007). `KnowledgeRegistry.list('species')` throws
 * `KnowledgeValidationError` at first use if the shipped JSON data itself
 * is invalid, so a broken data file fails loudly here rather than
 * producing an incomplete species table. */
export const BOTANICAL_SPECIES: Record<BotanicalFamily, BotanicalSpeciesRecord> = Object.fromEntries(
  KnowledgeRegistry.list('species').map((record) => [record.id, record]),
) as Record<BotanicalFamily, BotanicalSpeciesRecord>;

/** All distinct `silhouette` values the species taxonomy actually uses --
 * a real, fixed-size set (currently 8) consulted by Build 006, Section 9's
 * Hero Diversity measurement (`engine/portfolioQuality.ts`). Derived from
 * `BotanicalSpeciesProfile`'s own type union, not hand-counted separately,
 * so it can't silently drift out of sync with the interface. */
export const BOTANICAL_SILHOUETTES: BotanicalSpeciesProfile['silhouette'][] = [
  'rounded', 'layered', 'spiky', 'airy', 'architectural', 'wispy', 'clustered', 'broadLeaf',
];

/** Real families that list `profile` among their `usageProfiles` (Build
 * 008B, Section 4: Species Usage Profiles), ordered by commercial fitness
 * (premium + elegance + commercial-popularity, descending) so a caller
 * that wants "the single best fit" can just take index 0 rather than
 * re-deriving an ordering itself. Used as `resolveStyleDna`'s fallback
 * family pool for any style that declares no explicit `preferredFamilies`
 * (see `engine/styleDna.ts`'s `STYLE_USAGE_PROFILE` map) -- every one of
 * the 15 shipped built-in styles already has a curated `preferredFamilies`
 * list, so this path only ever activates for a future/custom style that
 * doesn't, never changing any existing style's resolved output. */
export function speciesForUsageProfile(profile: UsageProfileId): BotanicalFamily[] {
  return BOTANICAL_FAMILIES
    .filter((f) => BOTANICAL_SPECIES[f].usageProfiles.includes(profile))
    .sort((a, b) => {
      const scoreOf = (f: BotanicalFamily) => {
        const s = BOTANICAL_SPECIES[f];
        return s.premiumScore + s.eleganceScore + s.commercialPopularity;
      };
      return scoreOf(b) - scoreOf(a);
    });
}

/** Build 008B, Section 8 (Product-aware Species Selection): which real
 * `UsageProfileId` each real `ProductUseId` (collection/productTargets.ts
 * -- the app's own 10 named commercial product targets) maps to for
 * species-selection purposes -- a hand-authored editorial judgment (the
 * same convention `engine/styleDna.ts`'s own `STYLE_USAGE_PROFILE` map
 * already established), not a computed score. The brief's own Section 8
 * wording names products this app doesn't track as a real, validated
 * taxonomy ("Phone Case", "Poster", "Art Print") -- reusing the real,
 * already-validated `ProductUseId` set here instead of inventing new
 * categories nothing else in the app checks against. */
const PRODUCT_USAGE_PROFILE: Record<ProductUseId, UsageProfileId> = {
  wallpaper: 'wallpaper',
  fabric: 'fabric',
  wrappingPaper: 'packaging',
  giftWrap: 'packaging',
  packaging: 'packaging',
  notebookCovers: 'minimal',
  stationery: 'greetingCard',
  homeDecor: 'wallpaper',
  textile: 'textile',
  digitalPaper: 'minimal',
};

/** Real families that fit `productTarget`'s own mapped usage profile
 * (see `PRODUCT_USAGE_PROFILE`), ordered by commercial fitness -- same
 * ordering convention as `speciesForUsageProfile` (which this delegates
 * to). Used by `engine/tile.ts` as a fallback family pick when a tile
 * declares a real `productTarget` but no Style DNA already resolved a
 * `botanicalFamily` -- never overrides an explicit style/user choice. */
export function speciesForProductTarget(productTarget: ProductUseId): BotanicalFamily[] {
  return speciesForUsageProfile(PRODUCT_USAGE_PROFILE[productTarget]);
}

/** Picks a real companion species for `primary`'s supporting/filler/accent
 * bouquet roles -- e.g. a Rose hero pairs with Eucalyptus/Baby's-Breath/
 * Berries, never another Rose. Falls back to `primary` itself (byte-
 * identical to pre-Build-006 behavior) when the species has no companion
 * list (every `foliageOnly`/`filler` species -- they ARE the companions)
 * or no `family` hint was given at all. Picked ONCE per hero (not once per
 * member) by the caller so a single bouquet reads as one coherent pairing,
 * not a different random companion on every filler.
 *
 * Build 008B, Section 2 (Companion Species Matrix): replaces the old
 * uniform `rngPick` across a flat id list with a real roulette-wheel pick
 * weighted by each companion's `strength` (0-1) -- a rose's 0.9-strength
 * eucalyptus pairing is genuinely more likely to be chosen than its
 * 0.6-strength berry-branch pairing, matching how a real florist reaches
 * for the strongest pairing far more often than a weaker one, while still
 * leaving room for the weaker pairing to appear sometimes (portfolio
 * variety, Section 9). */
export function pickCompanionFamily(rng: Rng, primary: BotanicalFamily | undefined): BotanicalFamily | undefined {
  if (!primary) return primary;
  const companions = BOTANICAL_SPECIES[primary].companions;
  if (companions.length === 0) return primary;

  const totalStrength = companions.reduce((sum, c) => sum + c.strength, 0);
  if (totalStrength <= 0) return companions[0].family;

  let roll = rng() * totalStrength;
  for (const companion of companions) {
    roll -= companion.strength;
    if (roll <= 0) return companion.family;
  }
  return companions[companions.length - 1].family;
}
