import type { Rng } from './types';

// Build 005, Section 6 (Designer Brain): "Before placing anything the
// engine should ask 'What would a professional surface pattern designer
// do?' ... Never place objects only because random says so."
//
// Every `StyleDna` preferred-list field (`categories`, `layouts`,
// `paletteIds`, `preferredZones`, `preferredFamilies`,
// `preferredClusterArchetypes`) is documented as "first = primary/
// default" -- but `engine/styleDna.ts`'s own resolver (`pickPreferred`)
// picked among the whole list with a plain uniform random draw, so that
// "primary" designation was purely decorative and never actually
// influenced generation: a style's 4th-listed, least-typical family was
// exactly as likely to appear as its own signature first choice. A real
// designer treats a stated signature choice as the default, reached for
// most of the time, with occasional deliberate variation -- not a coin
// flip among equals. `weightedPickPreferred` is that real, small
// behavioral difference: the primary entry is chosen roughly half the
// time on any multi-entry list; the remaining half is split evenly across
// every other entry (still a real, seeded, reproducible choice, not
// removed -- variation is still genuinely possible, just no longer as
// likely as the signature pick).
export function weightedPickPreferred<T>(rng: Rng, list: readonly T[]): T {
  if (list.length <= 1) return list[0];
  if (rng() < 0.5) return list[0];
  return list[1 + Math.floor(rng() * (list.length - 1))];
}
