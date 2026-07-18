import type { Rng } from '../engine/types';
import { h } from '../engine/svgAst';
import { rngBool } from '../engine/rng';
import { pinnateVeins } from './shared';
import { ovateLeafPath, serratedLeafPath } from './botanical';
import type { BotanicalFamily } from './botanicalFamilies';

// Build 007, Section 2 (Leaf Anatomy Engine): `premiumHero.ts` (the highest-
// visibility hero/bouquet construction path) drew every leaf with its own
// local `simpleLeafPath` -- a plain two-curve teardrop with NO venation and
// no per-species variation at all, while `botanical.ts`'s ordinary variants
// have used a real ovate/serrated silhouette + pinnate venation
// (`ovateLeafPath`/`serratedLeafPath`/`pinnateVeins`) since Build 004/005.
// A hero's own leaves -- the most visible foliage in the whole tile -- were
// genuinely LESS botanically detailed than an ordinary filler leaf. This is
// the real gap Section 2 closes: give every species a real leaf anatomy
// profile (edge style, vein-pair count, width proportion) and use the
// SAME already-tested shape functions the rest of the app already trusts,
// not a new, unverified leaf silhouette.

export interface LeafAnatomyProfile {
  /** 'smooth' = plain ovate edge, 'serrated' = toothed edge (the same two
   * real silhouettes `botanical.ts` already draws for ordinary leaves). */
  edge: 'smooth' | 'serrated';
  /** Real vein-pair count passed straight to `pinnateVeins` -- narrow
   * wispy foliage (eucalyptus, lavender) reads correctly with fewer, finer
   * veins; broad leaves (tropical, hydrangea) carry more. */
  veinPairs: number;
  /** width / length ratio -- a narrow wispy leaf and a broad leaf are not
   * just "the same shape at different scale", they have a different
   * silhouette proportion entirely. */
  widthRatio: number;
}

/** One real profile per named family (the same "every species owns its own
 * data" convention `BOTANICAL_SPECIES` already established) plus a neutral
 * `default` for when no family hint is available (reproduces a reasonable
 * mid-range leaf, never a fabricated per-species value). */
export const LEAF_ANATOMY: Record<BotanicalFamily, LeafAnatomyProfile> = {
  rose: { edge: 'serrated', veinPairs: 3, widthRatio: 0.42 },
  peony: { edge: 'smooth', veinPairs: 3, widthRatio: 0.48 },
  tulip: { edge: 'smooth', veinPairs: 2, widthRatio: 0.28 },
  anemone: { edge: 'serrated', veinPairs: 2, widthRatio: 0.4 },
  magnolia: { edge: 'smooth', veinPairs: 4, widthRatio: 0.52 },
  hydrangea: { edge: 'serrated', veinPairs: 4, widthRatio: 0.55 },
  cosmos: { edge: 'smooth', veinPairs: 2, widthRatio: 0.25 },
  wildflower: { edge: 'smooth', veinPairs: 2, widthRatio: 0.3 },
  daisy: { edge: 'serrated', veinPairs: 2, widthRatio: 0.32 },
  lavender: { edge: 'smooth', veinPairs: 1, widthRatio: 0.18 },
  eucalyptus: { edge: 'smooth', veinPairs: 2, widthRatio: 0.32 },
  olive: { edge: 'smooth', veinPairs: 1, widthRatio: 0.22 },
  fern: { edge: 'smooth', veinPairs: 2, widthRatio: 0.35 },
  berryBranch: { edge: 'serrated', veinPairs: 3, widthRatio: 0.4 },
  herb: { edge: 'smooth', veinPairs: 2, widthRatio: 0.3 },
  ranunculus: { edge: 'serrated', veinPairs: 3, widthRatio: 0.4 },
  protea: { edge: 'smooth', veinPairs: 2, widthRatio: 0.3 },
  tropicalLeaf: { edge: 'smooth', veinPairs: 5, widthRatio: 0.6 },
  babysBreath: { edge: 'smooth', veinPairs: 1, widthRatio: 0.2 },
};

export const DEFAULT_LEAF_ANATOMY: LeafAnatomyProfile = { edge: 'smooth', veinPairs: 3, widthRatio: 0.5 };

export function leafAnatomyFor(family: BotanicalFamily | undefined): LeafAnatomyProfile {
  return family ? LEAF_ANATOMY[family] : DEFAULT_LEAF_ANATOMY;
}

/** Builds one real anatomical leaf -- ovate or serrated silhouette (per the
 * profile's `edge`), sized from the profile's own `widthRatio` rather than
 * a fixed proportion, plus real pinnate venation at the profile's own
 * `veinPairs` count. Replaces `premiumHero.ts`'s local `simpleLeafPath` --
 * same call signature shape (length + fill color in, one grouped node out)
 * so it's a drop-in upgrade at each existing call site. */
export function anatomicalLeafNode(rng: Rng, fill: string, veinColor: string, length: number, profile: LeafAnatomyProfile): ReturnType<typeof h> {
  const width = length * profile.widthRatio;
  const shape = profile.edge === 'serrated' ? serratedLeafPath(length, width, rng) : ovateLeafPath(length, width);
  return h('g', {}, [h('path', { d: shape, fill }), ...pinnateVeins(length, width, veinColor, fill, profile.veinPairs)]);
}

/** A handful of real profiles genuinely differ only in scale/rhythm, not
 * silhouette -- picking between the family's own profile and a slightly
 * varied edge on some leaves (real plants don't have every single leaf
 * perfectly identical either) reuses `rngBool` the same way `leafNode` in
 * botanical.ts already does, kept here so `premiumHero.ts` doesn't need to
 * duplicate the "occasionally serrated even on a smooth-edge species"
 * judgment call itself. */
export function pickLeafEdge(rng: Rng, profile: LeafAnatomyProfile): LeafAnatomyProfile['edge'] {
  return rngBool(rng, 0.85) ? profile.edge : (profile.edge === 'smooth' ? 'serrated' : 'smooth');
}
