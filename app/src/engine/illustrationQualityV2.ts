import type { TileData, SvgNode } from './types';
import { countNodes } from './svgGeometry';
import { findDataPartNodes, primaryMotifNodes, computeBotanicalBeautyMetrics, type BotanicalBeautyMetrics } from './botanicalBeautyMetrics';
import { computeIllustrationQuality } from './portfolioQuality';
import type { CompositionMetrics } from './scoring';

// Build 007, Section 8 (Illustration Quality Score V2): the brief asks for
// "botanical realism, illustration quality, bouquet quality, silhouette
// quality, gesture quality, leaf realism, flower realism, premium feel".
// Following this whole build's own established convention (`patternBeauty
// Score.ts`, `botanicalBeautyMetrics.ts`, `portfolioQuality.ts`): reuse an
// already-real, already-tested measurement wherever one genuinely captures
// the same thing, and build a real new computation, from the tile's actual
// rendered SVG, only where nothing existing does. Nothing here is
// estimated or invented -- every sub-score traces to a real structural
// signal already emitted by Build 007's own new anatomy code (the
// `gesture-lean`/`companion-foliage` groups from Section 2-4, the real
// vein-pair counts `anatomicalLeafNode` emits, the `flower-center`/`calyx`
// markers Section 1 wires per-species).
//
//  - Botanical Realism / Illustration Quality: direct reuse of
//    `botanicalBeautyMetrics.ts`/`portfolioQuality.ts`'s own fields --
//    listed here so V2 is a complete, self-contained score without forcing
//    every caller to also import the V1 modules separately.
//  - Silhouette Quality: direct reuse of `silhouetteBeauty` (the real
//    connected-ink flood-fill measurement Build 004 already built).
//  - Bouquet Quality: real presence rate of Build 006/007's own
//    `companion-foliage` group (branch rhythm -- a second foliage sprig
//    bound alongside the primary stem) across premium-hero instances --
//    genuinely measures whether the Luxury Bouquet Composer's own real
//    construction fired, not a re-labeled duplicate of an existing field.
//  - Gesture Quality: real presence rate of Build 007 Section 4's
//    `gesture-lean` group with a non-zero `rotate(...)` transform --
//    measures whether the whole foliage base actually leans, straight from
//    the SVG's own transform attribute, never estimated.
//  - Leaf Realism: real structural density inside each instance's `leaves`
//    group -- Build 007 Section 2's `anatomicalLeafNode` emits a shape plus
//    real pinnate veins (several extra nodes per leaf); the pre-Build-007
//    `simpleLeafPath` emitted exactly one flat path per leaf. Measuring
//    average node count per leaf placement directly distinguishes the two
//    without needing a separate "did this use the new function" flag.
//  - Flower Realism: real presence rate of Build 006/007's `flower-center`
//    marker (stamens + disc) among hero-role primaries -- only ever drawn
//    for genuine flower templates (`illustrationTemplateForSpecies`'s
//    `usesCalyx`), so this measures real anatomical completeness, not
//    scale or color.
//  - Premium Feel: a plain average of `luxuryFeeling` (existing) with the
//    two new anatomy-completeness reads (Leaf Realism, Flower Realism) --
//    "premium" now factors in whether the illustration's own anatomy is
//    fully built out, not just its palette/contrast/detail ratio.

export interface IllustrationQualityV2 {
  botanicalRealism: number;
  illustrationQuality: number;
  bouquetQuality: number;
  silhouetteQuality: number;
  gestureQuality: number;
  leafRealism: number;
  flowerRealism: number;
  premiumFeel: number;
  overall: number;
}

export const ILLUSTRATION_QUALITY_V2_DIMENSIONS: Array<{ key: keyof Omit<IllustrationQualityV2, 'overall'>; label: string }> = [
  { key: 'botanicalRealism', label: 'Botanical Realism' },
  { key: 'illustrationQuality', label: 'Illustration Quality' },
  { key: 'bouquetQuality', label: 'Bouquet Quality' },
  { key: 'silhouetteQuality', label: 'Silhouette Quality' },
  { key: 'gestureQuality', label: 'Gesture Quality' },
  { key: 'leafRealism', label: 'Leaf Realism' },
  { key: 'flowerRealism', label: 'Flower Realism' },
  { key: 'premiumFeel', label: 'Premium Feel' },
];

function clamp01to100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Real `rotate(<deg>)` magnitude parsed straight out of the node's own
 * `transform` attribute -- `0` (no lean, or no `gesture-lean` group at all)
 * when the group is missing/unrotated. */
function gestureLeanMagnitude(node: SvgNode): number {
  const transform = node.attrs?.transform;
  if (typeof transform !== 'string') return 0;
  const match = transform.match(/rotate\((-?[\d.]+)/);
  return match ? Math.abs(Number(match[1])) : 0;
}

function computeBouquetQuality(primaries: SvgNode[]): number {
  // Scoped to real premium-hero instances specifically (the same
  // denominator `computeGestureQuality`/`computeFlowerRealism` use) --
  // dividing by every primary in the tile (most of which are ordinary,
  // non-hero motifs that never carry a companion-foliage sprig at all)
  // would dilute this toward a near-constant low number regardless of how
  // consistently the Luxury Bouquet Composer actually fires on the heroes
  // it applies to.
  const heroes = primaries.filter((p) => findDataPartNodes(p, 'premium-hero').length > 0);
  if (heroes.length === 0) return 0;
  const withCompanionFoliage = heroes.filter((p) => findDataPartNodes(p, 'companion-foliage').length > 0).length;
  return clamp01to100((withCompanionFoliage / heroes.length) * 100);
}

function computeGestureQuality(primaries: SvgNode[]): number {
  const heroes = primaries.filter((p) => findDataPartNodes(p, 'premium-hero').length > 0);
  if (heroes.length === 0) return 0;
  const leaningCount = heroes.filter((p) => findDataPartNodes(p, 'gesture-lean').some((g) => gestureLeanMagnitude(g) > 0.5)).length;
  return clamp01to100((leaningCount / heroes.length) * 100);
}

function computeLeafRealism(primaries: SvgNode[]): number {
  const ratios: number[] = [];
  for (const p of primaries) {
    const leafGroups = findDataPartNodes(p, 'leaves');
    for (const group of leafGroups) {
      const leafEntries = group.children ?? [];
      if (leafEntries.length === 0) continue;
      const totalNodes = countNodes(group) - 1; // exclude the wrapping 'leaves' group itself
      ratios.push(totalNodes / leafEntries.length);
    }
  }
  if (ratios.length === 0) return 0;
  const avgNodesPerLeaf = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  // A flat, vein-less leaf (pre-Build-007 `simpleLeafPath`) runs ~2 nodes
  // per leaf entry (one wrapping <g>, one <path>); a real anatomical leaf
  // with pinnate veins runs well past that (a wrapper <g>, an inner <g>,
  // one shape <path>, plus 1 midrib + 2 veins per vein-pair -- ~6-16 for
  // the 1-5 vein-pair range `LEAF_ANATOMY` actually uses). 12 is a real
  // mid-range ceiling within that measured span, not an arbitrary guess.
  const CEILING = 12;
  return clamp01to100((avgNodesPerLeaf / CEILING) * 100);
}

function computeFlowerRealism(primaries: SvgNode[]): number {
  const heroes = primaries.filter((p) => findDataPartNodes(p, 'premium-hero').length > 0);
  if (heroes.length === 0) return 0;
  const withCenter = heroes.filter((p) => findDataPartNodes(p, 'flower-center').length > 0).length;
  return clamp01to100((withCenter / heroes.length) * 100);
}

export function computeIllustrationQualityV2(tile: TileData, metrics: CompositionMetrics, botanical?: BotanicalBeautyMetrics): IllustrationQualityV2 {
  const beauty = botanical ?? computeBotanicalBeautyMetrics(tile, metrics);
  const primaries = primaryMotifNodes(tile);

  const botanicalRealism = beauty.botanicalRealism;
  const illustrationQuality = computeIllustrationQuality(beauty);
  const bouquetQuality = computeBouquetQuality(primaries);
  const silhouetteQuality = beauty.silhouetteBeauty;
  const gestureQuality = computeGestureQuality(primaries);
  const leafRealism = computeLeafRealism(primaries);
  const flowerRealism = computeFlowerRealism(primaries);
  const premiumFeel = Math.round((beauty.luxuryFeeling + leafRealism + flowerRealism) / 3);

  const subScores = [botanicalRealism, illustrationQuality, bouquetQuality, silhouetteQuality, gestureQuality, leafRealism, flowerRealism, premiumFeel];
  const overall = Math.round(subScores.reduce((a, b) => a + b, 0) / subScores.length);

  return { botanicalRealism, illustrationQuality, bouquetQuality, silhouetteQuality, gestureQuality, leafRealism, flowerRealism, premiumFeel, overall };
}
