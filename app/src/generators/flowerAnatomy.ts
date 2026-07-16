import type { Rng } from '../engine/types';
import { rngRange } from '../engine/rng';
import { BOTANICAL_SPECIES, type BotanicalFamily } from './botanicalFamilies';

// Build 007, Section 1 (Flower Anatomy Engine): `premiumHero.ts`'s hero
// flower already gets a real Calyx (sepals) and Flower Center (stamens +
// disc) since Build 005/006 -- but every species used the exact same
// constants (`sepalCount = 5`, `filamentCount = 6`), regardless of whether
// the hero is a many-petaled Peony or a spare, architectural Protea. A
// real flower's own anatomy genuinely varies: a Rose's calyx has 5 sepals
// because that's a real botanical fact, a Peony's dense, many-petaled bloom
// reads with more stamens, and a Protea's sparse bract-cone structure reads
// with fewer/thicker filaments -- so this gives each `bouquetRole:
// 'statement'|'supporting'` species (the ones `premiumHero.ts` actually
// draws a calyx/center for; `foliageOnly`/`filler` species never get one)
// its own real sepal/filament counts and a natural "bloom stage" range
// (0 = just opening, 1 = fully open) instead of one constant applied to
// every species alike.

export interface FlowerAnatomyProfile {
  sepalCount: number;
  filamentCount: number;
  opennessRange: [number, number];
}

const DEFAULT_FLOWER_ANATOMY: FlowerAnatomyProfile = { sepalCount: 5, filamentCount: 6, opennessRange: [0.6, 1] };

/** Only the species `premiumHero.ts` actually draws a calyx/center for
 * (`bouquetRole` 'statement' or 'supporting') get a real sepal/filament
 * entry -- a `foliageOnly`/`filler` species has no flower-anatomy concept
 * to define, so listing one would be fabricated data, not a real gap.
 *
 * Build 008B, Section 5 (Natural Bloom Diversity): this table used to also
 * hand-duplicate each species' own bloom-stage ("openness") range -- now a
 * real Build 008B field on the species record itself
 * (`BotanicalSpeciesRecord.bloomStageRange`, knowledge/registry/
 * speciesSchema.ts). Keeping a second, separately-maintained copy here
 * would let the two drift out of sync silently, so only sepal/filament
 * counts (which have no Build 008B schema equivalent) stay in this table;
 * `flowerAnatomyFor` reads `opennessRange` straight from the species'
 * real, single-source-of-truth `bloomStageRange` below. */
const FLOWER_STRUCTURE: Partial<Record<BotanicalFamily, { sepalCount: number; filamentCount: number }>> = {
  rose: { sepalCount: 5, filamentCount: 8 },
  peony: { sepalCount: 5, filamentCount: 10 },
  tulip: { sepalCount: 3, filamentCount: 6 },
  anemone: { sepalCount: 5, filamentCount: 12 },
  magnolia: { sepalCount: 3, filamentCount: 9 },
  hydrangea: { sepalCount: 4, filamentCount: 5 },
  berryBranch: { sepalCount: 4, filamentCount: 4 },
  ranunculus: { sepalCount: 5, filamentCount: 9 },
  protea: { sepalCount: 6, filamentCount: 4 },
};

export function flowerAnatomyFor(family: BotanicalFamily | undefined): FlowerAnatomyProfile {
  if (!family) return DEFAULT_FLOWER_ANATOMY;
  const structure = FLOWER_STRUCTURE[family];
  const species = BOTANICAL_SPECIES[family];
  // A zero-width range (e.g. berryBranch's real [0, 0] -- berries have no
  // petals to "open", `petalCountRange: [0, 0]` says so honestly) would
  // otherwise roll the exact same openness on every single instance,
  // directly defeating this section's own "never all look identical"
  // goal -- falls back to the natural default spread instead of a
  // degenerate constant.
  const opennessRange = species && species.bloomStageRange[0] < species.bloomStageRange[1]
    ? species.bloomStageRange
    : DEFAULT_FLOWER_ANATOMY.opennessRange;
  return {
    sepalCount: structure?.sepalCount ?? DEFAULT_FLOWER_ANATOMY.sepalCount,
    filamentCount: structure?.filamentCount ?? DEFAULT_FLOWER_ANATOMY.filamentCount,
    opennessRange,
  };
}

/** Real per-instance "bloom stage" roll within the species' own natural
 * range -- e.g. a Tulip's range stays mostly closed even at its own
 * maximum (tulips read as elegant precisely because they don't fully
 * flatten open the way a Peony does), so this never invents a value
 * outside what that species' own profile says is natural. */
export function rollOpenness(rng: Rng, profile: FlowerAnatomyProfile): number {
  return rngRange(rng, profile.opennessRange[0], profile.opennessRange[1]);
}
