import type { Rng } from '../engine/types';
import { rngRange } from '../engine/rng';
import type { BotanicalFamily } from './botanicalFamilies';

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
 * (`bouquetRole` 'statement' or 'supporting') get a real entry -- a
 * `foliageOnly`/`filler` species has no flower-anatomy concept to define,
 * so listing one would be fabricated data, not a real gap. */
const FLOWER_ANATOMY: Partial<Record<BotanicalFamily, FlowerAnatomyProfile>> = {
  rose: { sepalCount: 5, filamentCount: 8, opennessRange: [0.55, 1] },
  peony: { sepalCount: 5, filamentCount: 10, opennessRange: [0.7, 1] },
  tulip: { sepalCount: 3, filamentCount: 6, opennessRange: [0.4, 0.85] },
  anemone: { sepalCount: 5, filamentCount: 12, opennessRange: [0.7, 1] },
  magnolia: { sepalCount: 3, filamentCount: 9, opennessRange: [0.5, 0.95] },
  hydrangea: { sepalCount: 4, filamentCount: 5, opennessRange: [0.6, 1] },
  berryBranch: { sepalCount: 4, filamentCount: 4, opennessRange: [0.6, 0.9] },
  ranunculus: { sepalCount: 5, filamentCount: 9, opennessRange: [0.65, 1] },
  protea: { sepalCount: 6, filamentCount: 4, opennessRange: [0.5, 0.8] },
};

export function flowerAnatomyFor(family: BotanicalFamily | undefined): FlowerAnatomyProfile {
  if (!family) return DEFAULT_FLOWER_ANATOMY;
  return FLOWER_ANATOMY[family] ?? DEFAULT_FLOWER_ANATOMY;
}

/** Real per-instance "bloom stage" roll within the species' own natural
 * range -- e.g. a Tulip's range stays mostly closed even at its own
 * maximum (tulips read as elegant precisely because they don't fully
 * flatten open the way a Peony does), so this never invents a value
 * outside what that species' own profile says is natural. */
export function rollOpenness(rng: Rng, profile: FlowerAnatomyProfile): number {
  return rngRange(rng, profile.opennessRange[0], profile.opennessRange[1]);
}
