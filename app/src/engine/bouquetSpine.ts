import type { Placement, Rng, SvgNode } from './types';
import { rngPick } from './rng';
import { h, round } from './svgAst';
import { accentColors } from '../palettes/palettes';
import { groupByCluster } from './bouquetSpatialGraph';
import { buildClusterStem, type ClusterMember, type StemTopology } from './clusterEngine';

// Build 023 (Premium Bouquet Silhouette & Visual Cohesion Upgrade):
// "bouquet anchor and spine system" / "foliage and stem connector engine"
// deliverable. `clusterEngine.ts`'s own Section 6 comment names this exact
// gap: a hero and its supporting cluster members had relative dx/dy offsets
// but no shared connective geometry drawn between them, and its
// `buildClusterStem` was built but "not yet wired into the tile rendering
// pipeline." This module is that wiring — a thin rendering-side adapter,
// not a new geometry system: it regroups the tile's own already-thinned,
// already-repaired `Placement[]` back into per-cluster member sets (reusing
// `bouquetSpatialGraph.ts`'s `groupByCluster`, the same grouping
// `reserveClusterCompanions` already relies on) and asks `buildClusterStem`
// for a connective path per cluster, exactly the way a `PatternGenerator`
// already asks for a single motif's own internal stem.
//
// Deliberately gated to `params.premiumHero` at the call site in `tile.ts`
// (never called at all for non-premium styles) so it can never perturb the
// RNG draw sequence -- and therefore never change a single pixel -- for any
// style that hasn't opted in, preserving the byte-identical-output
// invariant every other Build 023 mechanism already holds itself to.
//
// Coordinates are computed in the cluster's own *unwrapped* local space
// (`wrapDelta` below) before being handed to `buildClusterStem`, which
// otherwise has no notion of tile wraparound -- a bouquet whose companion
// member landed on the opposite tile edge (a real, observed case for
// wide-anchor-spacing premium clusters) would otherwise produce an absurd
// cross-tile stem line rather than the short local connector it actually is.

const WRAP_OFFSETS = [-1, 0, 1];

const MULTI_BRANCH_TOPOLOGIES: StemTopology[] = ['ySplit', 'branching', 'doubleBranch', 'organicCurve'];
const SIMPLE_TOPOLOGIES: StemTopology[] = ['straight', 'arc', 'sCurve', 'organicCurve'];

// Build 023 (Visual Beauty & Premium Art Direction Engine), visual QA
// finding: the anchor-spacing fix (clusterEngine.ts/bouquet.ts/heroScatter.ts)
// deliberately widens the distance between a hero and its surviving
// companions so they no longer collide in the same silhouette grid cell --
// but a companion that lands genuinely far from its hero (well beyond a
// plausible single-stem reach) produced a long, bare, visibly artificial
// line crossing open background when connected literally (confirmed by
// rendering `darkBotanical`/`m22-2`: a thin diagonal line spanning ~1/4 of
// the tile with nothing else on it -- a P1 defect worse than the confetti
// look it was meant to soften). A real bouquet stem only ever bridges
// members that are close enough to read as "one loose grouping"; beyond
// that it must NOT draw a connector at all, matching this build's own
// fragmentedSilhouetteV2 "cluster-explained" cohesion radius rather than
// inventing a second, disconnected notion of "close enough."
const MAX_STEM_REACH_MOTIF_MULTIPLE = 2.2;

/** Shortest signed delta from `b` to `a` on a `tileSize`-periodic axis --
 * the "minimal image" convention every wraparound-aware distance in this
 * codebase (e.g. `bouquetSpatialGraph.ts`'s own cell math) already uses. */
function wrapDelta(a: number, b: number, tileSize: number): number {
  let d = a - b;
  if (d > tileSize / 2) d -= tileSize;
  if (d < -tileSize / 2) d += tileSize;
  return d;
}

/** Builds the SVG connective-stem layer for every surviving bouquet cluster
 * with 2+ members (a lone surviving hero has nothing to connect to and is
 * skipped, same as `buildClusterStem`'s own no-op for an empty `others`).
 * Returns `null` (never an empty `<g>`) when there is nothing to draw, so
 * callers can treat the result as a strict no-op check. */
export function buildBouquetSpineLayer(placements: Placement[], tileSize: number, motifSize: number, rng: Rng, colors: string[]): SvgNode | null {
  const groups = groupByCluster(placements).filter((g) => g.memberIndexes.length >= 2);
  if (groups.length === 0) return null;

  const stemColor = rngPick(rng, accentColors(colors));
  const strokeWidth = round(Math.max(0.6, motifSize * 0.018));
  const clusterNodes: SvgNode[] = [];

  const maxReach = motifSize * MAX_STEM_REACH_MOTIF_MULTIPLE;

  for (const group of groups) {
    const heroIndex = group.memberIndexes.find((i) => placements[i].role === 'hero');
    if (heroIndex === undefined) continue;
    const hero = placements[heroIndex];
    const others = group.memberIndexes.filter((i) => {
      if (i === heroIndex) return false;
      const p = placements[i];
      const dist = Math.hypot(wrapDelta(p.x, hero.x, tileSize), wrapDelta(p.y, hero.y, tileSize));
      return dist <= maxReach;
    });
    if (others.length === 0) continue;

    const members: ClusterMember[] = [
      { dx: 0, dy: 0, rotationDeg: hero.rotationDeg, scaleMul: hero.scale, role: hero.role ?? 'hero', overlapsHero: false },
      ...others.map((i) => {
        const p = placements[i];
        return {
          dx: wrapDelta(p.x, hero.x, tileSize),
          dy: wrapDelta(p.y, hero.y, tileSize),
          rotationDeg: p.rotationDeg,
          scaleMul: p.scale,
          role: p.role ?? 'filler',
          overlapsHero: false,
        };
      }),
    ];

    const topology = rngPick(rng, members.length >= 3 ? MULTI_BRANCH_TOPOLOGIES : SIMPLE_TOPOLOGIES);
    const stem = buildClusterStem(rng, members, topology);
    if (stem.branches.length === 0) continue;

    const branchPaths = stem.branches.map((b) =>
      h('path', { d: b.path, fill: 'none', stroke: stemColor, 'stroke-width': strokeWidth, 'stroke-linecap': 'round', opacity: 0.8 }),
    );

    for (const oi of WRAP_OFFSETS) {
      for (const oj of WRAP_OFFSETS) {
        const wx = hero.x + oi * tileSize;
        const wy = hero.y + oj * tileSize;
        // Conservative bounding-box test (generous fixed reach rather than
        // per-branch measurement, matching the cheap-and-safe convention
        // `tile.ts`'s own per-instance wrap culling already uses) -- never
        // under-inclusive, just skips copies that provably can't touch the
        // tile rect.
        const reach = motifSize * 3;
        const intersects = wx + reach >= 0 && wx - reach <= tileSize && wy + reach >= 0 && wy - reach <= tileSize;
        if (!intersects) continue;
        clusterNodes.push(h('g', { transform: `translate(${round(wx)}, ${round(wy)})` }, branchPaths));
      }
    }
  }

  if (clusterNodes.length === 0) return null;
  return h('g', { id: 'layer-bouquet-spine' }, clusterNodes);
}
