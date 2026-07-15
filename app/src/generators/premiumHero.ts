import type { Motif, Rng } from '../engine/types';
import { h, round } from '../engine/svgAst';
import { rngPick, rngRange, rngInt } from '../engine/rng';
import { generateCluster } from '../engine/clusterEngine';
import { applyHeroDetailOverlay } from '../engine/heroComplexity';
import { generateStem, growLeaves, GROWTH_PRESETS } from './growth';
import { botanicalGenerator } from './botanical';
import type { BotanicalFamily } from './botanicalFamilies';

// Build 004, Section 8 (Premium Hero Builder): "Heroes should become
// botanical bouquets. Instead of one flower, construct Hero Flower +
// Supporting Leaves + Bud + Berry + Stem + Accent Flowers + Micro Details.
// Each hero becomes one artistic object." Every existing hero placement
// draws ONE independent variant via `botanicalGenerator.createMotif` --
// this module instead assembles a real composite: a Hero Flower plus
// several distinct supporting sub-parts, arranged and grouped into one SVG
// object.
//
// The sub-parts' arrangement reuses Section 4's own `bouquet` cluster
// archetype -- literally the same engine that arranges a bouquet of
// separate motifs across a tile, applied one level down to arrange one
// hero's own internal sub-parts. Each cluster member's role maps to a
// distinct real sub-part (never just "the same flower shape again, smaller"):
// hero -> Hero Flower, secondary -> Bud or Accent Flower (alternating,
// so both named parts appear), filler -> Berry, accent -> a tiny filler
// motif. "Micro Details" reuses `engine/heroComplexity.ts`'s existing,
// already-shipped detail overlay (ring/texture lines/decorative dots/
// nested contour/accent arc) rather than duplicating that logic.
//
// Not yet wired into `engine/tile.ts`'s per-placement rendering -- forcing
// EVERY hero into a premium bouquet would directly contradict Section 3's
// own Style DNA differentiation (Minimal Botanical explicitly wants "simple
// silhouettes, few elements"), so which presets opt into a premium hero is
// Section 9's job (Style DNA botanical grammar), not this section's.

function simpleLeafPath(len: number, width: number): string {
  return `M 0 0 Q ${round(width / 2)} ${round(-len * 0.4)} 0 ${round(-len)} Q ${round(-width / 2)} ${round(-len * 0.4)} 0 0 Z`;
}

export interface PremiumHeroOptions {
  colors: string[];
  size: number;
  family?: BotanicalFamily;
}

/** Assembles one hero as a real multi-part botanical bouquet: a grown stem
 * with supporting leaves, a Hero Flower, alternating Bud/Accent Flower
 * secondary parts, a Berry filler part, and a Micro Details overlay -- all
 * grouped into one SVG object, positioned via the real Bouquet cluster
 * archetype's own arrangement math. Deterministic for a given rng
 * sequence. */
export function buildPremiumHero(rng: Rng, opts: PremiumHeroOptions): Motif {
  const { colors, size, family } = opts;
  const accents = colors.length > 1 ? colors.slice(1) : colors;

  // A hero placement is already positioned by its OWN layout's spacing math
  // (which sized the gaps to its neighbors assuming a plain single-variant
  // motif's footprint) -- a hero drawn from a cluster-based layout
  // (bouquet/heroScatter) additionally sits inside that outer layout's own
  // cluster. Keeping this inner arrangement tight (not the ~size*0.4 a
  // freestanding cluster would use) keeps the assembled hero's overall
  // radius close to a plain hero's, so it reads as "one richer object" at
  // the same footprint rather than sprawling into space the outer layout
  // reserved for its other members.
  const members = generateCluster('bouquet', rng, {
    baseRadius: size * 0.2,
    rotationJitter: 12,
    scaleJitter: 0.15,
    memberCount: rngInt(rng, 4, 6),
  });

  // Kept short (a plain hero variant's own stems are similarly compact) --
  // a full-length stem (previously size*0.85, reaching ~size*0.42 from
  // center on its own) plus leaves extending further past its tip was the
  // real, dominant driver of an oversized rendered bounding radius
  // (confirmed via computeBoundingRadius, which re-measures actual SVG
  // geometry independent of the `radius` estimate below) -- not the
  // cluster member spread, which this function already keeps tight.
  const stem = generateStem(rng, size * 0.4, rngRange(rng, 0.05, 0.1));
  const stemColor = rngPick(rng, accents);
  const leafPreset = GROWTH_PRESETS.leafyBranch;
  const leaves = growLeaves(rng, stem, leafPreset);
  const leafColor = rngPick(rng, accents);
  const leafNodes = leaves.map((leaf) => {
    const leafLen = size * rngRange(rng, 0.12, 0.18) * leaf.scale;
    return h('g', { transform: `translate(${round(leaf.point.x)} ${round(leaf.point.y)}) rotate(${round(leaf.angle)})` }, [
      h('path', { d: simpleLeafPath(leafLen, leafLen * 0.5), fill: leafColor }),
    ]);
  });

  const parts = [
    h('g', { 'data-part': 'stem' }, [
      h('path', { d: stem.path, fill: 'none', stroke: stemColor, 'stroke-width': round(size * 0.02), 'stroke-linecap': 'round' }),
    ]),
    h('g', { 'data-part': 'leaves' }, leafNodes),
  ];

  let secondaryToggle = 0;
  let colorSeed = 1;
  for (const member of members) {
    let sub: Motif;
    if (member.role === 'hero') {
      sub = botanicalGenerator.createMotif(rng, colors, size, colorSeed++, { role: 'hero', part: 'heroFlower', family });
    } else if (member.role === 'secondary') {
      secondaryToggle++;
      const part = secondaryToggle % 2 === 1 ? 'bud' : 'secondaryFlower';
      sub = botanicalGenerator.createMotif(rng, colors, size * 0.55, colorSeed++, { role: 'secondary', part, family });
    } else if (member.role === 'filler') {
      sub = botanicalGenerator.createMotif(rng, colors, size * 0.4, colorSeed++, { role: 'filler', part: 'berry', family });
    } else {
      sub = botanicalGenerator.createMotif(rng, colors, size * 0.22, colorSeed++, { role: 'accent', part: 'tinyAccent', family });
    }
    parts.push(
      h(
        'g',
        { transform: `translate(${round(member.dx)} ${round(member.dy)}) rotate(${round(member.rotationDeg)}) scale(${round(member.scaleMul)})` },
        [sub.node],
      ),
    );
  }

  const reach = members.slice(1).reduce((max, m) => Math.max(max, Math.hypot(m.dx, m.dy) + size * 0.3 * m.scaleMul), 0);
  const baseRadius = Math.max(size * 0.55, reach);

  const assembled = h('g', { 'data-part': 'premium-hero' }, parts);
  const withMicroDetails = applyHeroDetailOverlay(assembled, { role: 'hero', radius: baseRadius, colors }, rng);

  return { node: withMicroDetails, radius: baseRadius };
}
