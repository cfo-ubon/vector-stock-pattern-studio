// Build 004, Section 3 (Botanical DNA Engine): the 14 named hierarchy
// levels the brief asks for. Deliberately kept orthogonal to
// `engine/hierarchy.ts`'s existing `MotifRole` (hero/secondary/filler/
// accent) rather than replacing it -- expanding MotifRole itself to 14
// values would touch every dependent (clusterEngine.ts, patternPhysics.ts,
// heroComplexity.ts, scoring.ts) for a change that's really about *which
// shape* gets drawn, not *how big or important* it is. MotifRole keeps
// governing scale/importance exactly as before; BotanicalPart governs
// which species-specific shape gets drawn within a family for a given
// role (see `generators/botanical.ts`'s `poolForHints`).
export type BotanicalPart =
  | 'heroFlower'
  | 'secondaryFlower'
  | 'bud'
  | 'halfBloom'
  | 'leaf'
  | 'leafCluster'
  | 'stem'
  | 'branch'
  | 'berry'
  | 'seed'
  | 'tinyAccent'
  | 'connector'
  | 'silhouette'
  | 'textureAccent';

export const BOTANICAL_PARTS: BotanicalPart[] = [
  'heroFlower',
  'secondaryFlower',
  'bud',
  'halfBloom',
  'leaf',
  'leafCluster',
  'stem',
  'branch',
  'berry',
  'seed',
  'tinyAccent',
  'connector',
  'silhouette',
  'textureAccent',
];

/** The real, distinct shape categories every botanical `Variant` already
 * falls into (see `generators/botanical.ts`'s `TaggedVariant.category`).
 * Several of the 14 named parts share one category on purpose -- hero vs.
 * secondary flower is a scale/role distinction (already handled by
 * `ROLE_SCALE_RANGE`), not a different shape, so both map to `'flower'`. */
export type PartShapeCategory = 'flower' | 'bud' | 'leaf' | 'branch' | 'berry';

/** Maps a named part to the real shape category that selects it, or
 * `undefined` for the 3 parts this build's variant library has no
 * dedicated geometry for yet (a standalone stem-only piece, a pure
 * connector, or a silhouette-only fill) -- honestly documented here rather
 * than silently falling back with no explanation. `poolForHints` treats
 * `undefined` as "don't further narrow by part," not as an error. */
export function shapeCategoryForPart(part: BotanicalPart): PartShapeCategory | undefined {
  switch (part) {
    case 'heroFlower':
    case 'secondaryFlower':
      return 'flower';
    case 'bud':
    case 'halfBloom':
      return 'bud';
    case 'leaf':
    case 'tinyAccent':
    case 'textureAccent':
      return 'leaf';
    case 'leafCluster':
    case 'branch':
      return 'branch';
    case 'berry':
    case 'seed':
      return 'berry';
    case 'stem':
    case 'connector':
    case 'silhouette':
      return undefined;
    default: {
      const exhaustive: never = part;
      return exhaustive;
    }
  }
}
