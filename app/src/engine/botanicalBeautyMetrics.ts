import type { TileData, SvgNode } from './types';
import { findMotifGroups, extractInstances, type MotifInstance } from './svgGeometry';
import { computeSilhouetteCohesion } from '../critic/visualAnalysis';
import type { CompositionMetrics } from './scoring';
import { computeOverallScore } from './scoring';

// Botanical Beauty Metrics V2 — Build 004, Section 9. The brief names 11
// dimensions (Botanical Realism, Flower Hierarchy, Leaf Diversity, Natural
// Growth, Cluster Harmony, Organic Flow, Silhouette Beauty, Luxury
// Feeling, Commercial Appeal, Botanical Complexity, Asset Harmony), the
// same "every metric must be measurable" mandate `engine/patternBeautyScore
// .ts` (Build 003, Part 12) already established for its own 11-dimension
// composite. Following that file's own precedent exactly: reuse an
// existing, already-tested `CompositionMetrics` field wherever one
// genuinely measures the same thing (labeled honestly, not silently
// renamed), and build a real new computation only where nothing existing
// does.
//
// 5 dimensions are direct reuse:
//  - Flower Hierarchy = `metrics.hierarchy` (scale tiering between roles).
//  - Natural Growth = `metrics.flowCoherence` — the same directional-
//    coherence measurement `engine/rotationFamilies.ts`'s Section 7 already
//    treats as one shared concept with "growth direction" (see that
//    module's own doc comment on `growthAngleFromOffset`).
//  - Cluster Harmony = `metrics.clusterCohesion`.
//  - Commercial Appeal = `computeOverallScore(metrics, 'stockClean').score`
//    — the exact same "Absolute Commercial Quality" number
//    `patternBeautyScore.ts`'s own `commercialLook` already uses, under
//    this composite's own name.
//  - Asset Harmony = `metrics.colorBalance` — whether the different
//    botanical assets in view (flowers/leaves/stems/berries) read as one
//    coherent palette rather than a clashing assortment.
//
// 6 dimensions are genuinely new, built directly from the tile's real
// rendered SVG (never randomised, never a re-derived duplicate of an
// existing field):
//  - Botanical Realism: fraction of motif instances whose own SVG actually
//    contains a grown structure (`data-part="stem"`/`"leaves"`, the same
//    markers `generators/growth.ts`-based variants already emit) rather
//    than a flat generic shape.
//  - Leaf Diversity: among leaf-bearing instances, how much the *number*
//    of individual leaves varies from one instance to the next (a real
//    coefficient-of-variation statistic, the same technique
//    `engine/scoring.ts`'s own `computeSpacing`/`computeHierarchyAndScale
//    Diversity` already use) — a uniform "every leaf cluster has exactly
//    N leaves" pattern reads as mechanical, real botanical variety doesn't.
//  - Organic Flow: average of `gridAppearanceScore` (not axis-aligned) and
//    `rhythmRegularity` (a real periodic "beat", not arrhythmic noise) —
//    together, "has real rhythm without reading as a mechanical grid".
//  - Silhouette Beauty: turns `critic/visualAnalysis.ts`'s own connected-
//    ink-region flood fill (`computeSilhouetteCohesion`, exported from
//    there for exactly this reuse) into a continuous 0-100 score instead
//    of only a pass/fail issue.
//  - Luxury Feeling: average of `paletteContrast`, `colorBalance`, and
//    `heroDetailRatio` — rich, well-contrasted, genuinely more-detailed
//    heroes read as "premium" the same way Section 8's Premium Hero
//    Builder does structurally.
//  - Botanical Complexity: average real SVG node count across every
//    instance (not just hero-vs-filler, unlike `heroDetailRatio`),
//    normalized against a reasonable ceiling.

export interface BotanicalBeautyMetrics {
  botanicalRealism: number;
  flowerHierarchy: number;
  leafDiversity: number;
  naturalGrowth: number;
  clusterHarmony: number;
  organicFlow: number;
  silhouetteBeauty: number;
  luxuryFeeling: number;
  commercialAppeal: number;
  botanicalComplexity: number;
  assetHarmony: number;
  overall: number;
}

/** Every named dimension paired with its display label, in the brief's own
 * Section 9 order — the same "single source of truth to iterate over"
 * pattern `PATTERN_BEAUTY_DIMENSIONS`/`DESIGN_CRITIQUE_DIMENSIONS` already
 * establish. */
export const BOTANICAL_BEAUTY_DIMENSIONS: Array<{ key: keyof Omit<BotanicalBeautyMetrics, 'overall'>; label: string }> = [
  { key: 'botanicalRealism', label: 'Botanical Realism' },
  { key: 'flowerHierarchy', label: 'Flower Hierarchy' },
  { key: 'leafDiversity', label: 'Leaf Diversity' },
  { key: 'naturalGrowth', label: 'Natural Growth' },
  { key: 'clusterHarmony', label: 'Cluster Harmony' },
  { key: 'organicFlow', label: 'Organic Flow' },
  { key: 'silhouetteBeauty', label: 'Silhouette Beauty' },
  { key: 'luxuryFeeling', label: 'Luxury Feeling' },
  { key: 'commercialAppeal', label: 'Commercial Appeal' },
  { key: 'botanicalComplexity', label: 'Botanical Complexity' },
  { key: 'assetHarmony', label: 'Asset Harmony' },
];

function clamp01to100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Depth-first collection of every descendant (including the node itself)
 * whose `data-part` attribute matches `part`. */
function findDataPartNodes(node: SvgNode, part: string): SvgNode[] {
  const found: SvgNode[] = [];
  if (node.attrs?.['data-part'] === part) found.push(node);
  for (const child of node.children ?? []) found.push(...findDataPartNodes(child, part));
  return found;
}

/** The first wrap-clone copy of each motif — the one real drawn shape
 * every wrap-around repeat of that instance shares — reusing
 * `svgGeometry.ts`'s own exported `findMotifGroups` rather than
 * re-deriving which top-level nodes are motifs. */
function primaryMotifNodes(tile: TileData): SvgNode[] {
  return findMotifGroups(tile.svg)
    .map((g) => (g.children ?? [])[0])
    .filter((n): n is SvgNode => n !== undefined);
}

function coefficientOfVariation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

function computeBotanicalRealism(primaries: SvgNode[]): number {
  if (primaries.length === 0) return 0;
  const grownCount = primaries.filter((p) => findDataPartNodes(p, 'stem').length > 0 || findDataPartNodes(p, 'leaves').length > 0).length;
  return clamp01to100((grownCount / primaries.length) * 100);
}

function computeLeafDiversity(primaries: SvgNode[]): number {
  const leafCounts: number[] = [];
  for (const p of primaries) {
    const leafGroups = findDataPartNodes(p, 'leaves');
    if (leafGroups.length === 0) continue;
    const count = leafGroups.reduce((sum, g) => sum + (g.children?.length ?? 0), 0);
    if (count > 0) leafCounts.push(count);
  }
  // Fewer than 2 leaf-bearing instances means nothing to compare variety
  // against — neutral, not a penalty.
  if (leafCounts.length < 2) return leafCounts.length === 1 ? 50 : 0;
  const cv = coefficientOfVariation(leafCounts);
  // A cv of ~0 (every instance has exactly the same leaf count) reads as
  // mechanical; real variety typically lands around cv ~0.3-0.6 for this
  // kind of small-integer count data, so that range maps to the top of
  // the scale rather than requiring unbounded variance for a high score.
  return clamp01to100((cv / 0.5) * 100);
}

function computeBotanicalComplexity(instances: MotifInstance[]): number {
  if (instances.length === 0) return 0;
  const avgNodeCount = instances.reduce((sum, i) => sum + i.nodeCount, 0) / instances.length;
  // A plain single-variant motif typically runs 5-15 nodes; a grown
  // stem+leaves structure or a Premium Hero assembly runs well past that.
  // 45 nodes/instance is a generous, real ceiling for "fully botanically
  // detailed" without rewarding runaway node bloat beyond it.
  const COMPLEXITY_CEILING = 45;
  return clamp01to100((avgNodeCount / COMPLEXITY_CEILING) * 100);
}

/** Builds the Botanical Beauty Score from a tile's real `CompositionMetrics`
 * plus its actual rendered SVG structure — every sub-dimension traces back
 * to an existing, tested measurement or a real new computation over
 * already-emitted markup (see module doc comment); `overall` is a plain
 * unweighted average of the other 10, the same "simple and transparent"
 * choice `computePatternBeautyScore` already made. */
export function computeBotanicalBeautyMetrics(tile: TileData, metrics: CompositionMetrics): BotanicalBeautyMetrics {
  const instances = extractInstances(tile);
  const primaries = primaryMotifNodes(tile);

  const botanicalRealism = computeBotanicalRealism(primaries);
  const flowerHierarchy = metrics.hierarchy;
  const leafDiversity = computeLeafDiversity(primaries);
  const naturalGrowth = metrics.flowCoherence;
  const clusterHarmony = metrics.clusterCohesion;
  const organicFlow = Math.round((metrics.gridAppearanceScore + metrics.rhythmRegularity) / 2);
  const cohesion = computeSilhouetteCohesion(tile, instances);
  const silhouetteBeauty = cohesion ? clamp01to100(100 - cohesion.isolatedFraction * 100) : 100;
  const luxuryFeeling = Math.round((metrics.paletteContrast + metrics.colorBalance + metrics.heroDetailRatio) / 3);
  const commercialAppeal = computeOverallScore(metrics, 'stockClean').score;
  const botanicalComplexity = computeBotanicalComplexity(instances);
  const assetHarmony = metrics.colorBalance;

  const subScores = [
    botanicalRealism,
    flowerHierarchy,
    leafDiversity,
    naturalGrowth,
    clusterHarmony,
    organicFlow,
    silhouetteBeauty,
    luxuryFeeling,
    commercialAppeal,
    botanicalComplexity,
    assetHarmony,
  ];
  const overall = Math.round(subScores.reduce((a, b) => a + b, 0) / subScores.length);

  return {
    botanicalRealism,
    flowerHierarchy,
    leafDiversity,
    naturalGrowth,
    clusterHarmony,
    organicFlow,
    silhouetteBeauty,
    luxuryFeeling,
    commercialAppeal,
    botanicalComplexity,
    assetHarmony,
    overall,
  };
}
