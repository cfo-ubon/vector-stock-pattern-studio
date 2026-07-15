import type { Rng } from './types';
import { COMPOSITION_ZONES, type CompositionZone } from './compositionZones';

// Portfolio Variety — Build 003, Part 13. Before this build, every batch
// item (App.tsx's "Generate 9 Variations") picked its own Composition Zone
// (see engine/compositionZones.ts) independently: a plain random pick among
// 10 zones with no style active, or `pickPreferred` over a Style DNA
// preset's own small `preferredZones` pool (2-3 zones, see
// engine/styleDna.ts's Style Grammar) when one is. Neither path has any
// memory of what earlier items in the *same* batch already chose, so nine
// independent draws from a pool of 2-3 zones very plausibly repeat the same
// composition several times over — the reviewer looking at all nine
// thumbnails together would see two or more literally share their whole-tile
// skeleton, which reads as "the generator ran out of ideas" rather than as
// nine deliberately different compositions.
//
// This module is the fix: a "shuffled bag" assignment, the same
// without-replacement-until-exhausted convention lotteries and card games
// use. It makes one real, honest guarantee — every zone in the candidate
// pool is used once before any zone repeats, and a repeat never lands
// immediately next to its own prior occurrence (checked across a bag
// reshuffle boundary too) — rather than a false "never repeats at all"
// claim, which would be mathematically impossible whenever the batch is
// larger than the candidate pool (exactly the Style DNA case, whose
// `preferredZones` pools are only 2-3 zones).
export function assignBatchCompositionZones(
  rng: Rng,
  count: number,
  candidates: CompositionZone[] = COMPOSITION_ZONES,
): CompositionZone[] {
  if (candidates.length === 0) {
    throw new Error('assignBatchCompositionZones requires at least one candidate zone');
  }
  const assigned: CompositionZone[] = [];
  let bag: CompositionZone[] = [];
  let lastZone: CompositionZone | undefined;
  while (assigned.length < count) {
    if (bag.length === 0) {
      bag = shuffle(rng, candidates);
      if (candidates.length > 1 && bag[0] === lastZone) {
        const swapIndex = 1 + Math.floor(rng() * (bag.length - 1));
        [bag[0], bag[swapIndex]] = [bag[swapIndex], bag[0]];
      }
    }
    const zone = bag.shift()!;
    assigned.push(zone);
    lastZone = zone;
  }
  return assigned;
}

/** Fisher-Yates, using the same seeded `Rng` every other deterministic
 * shuffle/pick in this engine uses — so a batch's zone assignment is
 * reproducible from its own seed like everything else the app generates. */
function shuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
