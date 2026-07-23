import type { Placement } from './types';
import { buildBouquetSpatialGraph, groupByCluster } from './bouquetSpatialGraph';

// Build 023 (Premium Bouquet Silhouette & Visual Cohesion Upgrade):
// fragmentedSilhouetteV2 — an ADDITIVE, cluster-aware companion to
// `critic/visualAnalysis.ts`'s existing `fragmentedSilhouette` (V1)
// detector. V1 is never modified, suppressed, or replaced anywhere in
// this build (per the brief's own explicit rule) — it keeps measuring
// exactly what it always measured (4-connected, wraparound-aware grid
// components over rendered SVG instances). This module answers a
// related but distinct question this build's own evidence showed V1
// cannot: of the members V1 counts as isolated singletons, how many
// actually belong to a real, deliberately-placed cluster whose OTHER
// members are simply a bit further away than one strict grid cell —
// i.e. "read by a human as one loose bouquet" rather than "confetti."
//
// Necessarily operates on the engine's own `Placement[]` (which carries
// `clusterId`/`clusterAnchorX/Y`, Build 023's own tag), not the critic's
// post-render `MotifInstance[]` (reconstructed from the rendered SVG,
// which does not carry cluster identity) — this is a generation-time /
// benchmark diagnostic, not a UI-facing critic detector; see
// `docs/BUILD_023_PREMIUM_BOUQUET_COHESION.md` for the scoping note.

const CLUSTER_COHESION_RADIUS_CELLS = 1.75;

export interface FragmentedSilhouetteV2Result {
  /** Same isolatedFraction/largestFraction definition V1 uses (positional,
   * not the same numeric run as V1 since it's computed from placements
   * rather than rendered SVG groups — used for A/B comparison, not as a
   * literal re-measurement of the exact same call). */
  isolatedFraction: number;
  largestFraction: number;
  /** Of the isolated members, the fraction that are cluster-explained —
   * isolated on the strict grid, but within `CLUSTER_COHESION_RADIUS_CELLS`
   * cells of another member of their own cluster. */
  clusterExplainedFraction: number;
  /** The cluster-aware verdict: true only when a real fraction of
   * isolated members have NO nearby same-cluster explanation at all —
   * genuine confetti, not a loosely (but deliberately) grouped bouquet. */
  detected: boolean;
  evidence: string;
}

export function detectFragmentedSilhouetteV2(placements: Placement[], tileSize: number, motifSize: number): FragmentedSilhouetteV2Result {
  if (placements.length < 3) {
    return { isolatedFraction: 0, largestFraction: 1, clusterExplainedFraction: 0, detected: false, evidence: 'Too few instances to assess.' };
  }
  const graph = buildBouquetSpatialGraph(placements, tileSize, motifSize);
  const isolatedIndexes = graph.isIsolated.map((iso, i) => (iso ? i : -1)).filter((i) => i >= 0);
  const isolatedFraction = isolatedIndexes.length / placements.length;

  const groups = groupByCluster(placements);
  const clusterOf = new Map<number, number>();
  groups.forEach((g) => g.memberIndexes.forEach((i) => clusterOf.set(i, g.clusterId)));

  const cellSize = graph.cellSize;
  const cohesionRadius = cellSize * CLUSTER_COHESION_RADIUS_CELLS;
  let clusterExplainedCount = 0;
  for (const i of isolatedIndexes) {
    const cid = clusterOf.get(i);
    if (cid === undefined) continue;
    const group = groups.find((g) => g.clusterId === cid)!;
    const p = placements[i];
    const hasNearbyClusterMate = group.memberIndexes.some((j) => {
      if (j === i) return false;
      const other = placements[j];
      return Math.hypot(p.x - other.x, p.y - other.y) <= cohesionRadius;
    });
    if (hasNearbyClusterMate) clusterExplainedCount++;
  }
  const clusterExplainedFraction = isolatedIndexes.length > 0 ? clusterExplainedCount / isolatedIndexes.length : 0;
  const trueFragmentedFraction = isolatedFraction * (1 - clusterExplainedFraction);

  return {
    isolatedFraction: Math.round(isolatedFraction * 1000) / 1000,
    largestFraction: 1, // computed by V1; not re-derived here (positional-only pass has no component-size sense of "largest")
    clusterExplainedFraction: Math.round(clusterExplainedFraction * 1000) / 1000,
    detected: trueFragmentedFraction > 0.45,
    evidence: `${isolatedIndexes.length} isolated instance(s) out of ${placements.length}, ${Math.round(clusterExplainedFraction * 100)}% of them explained by a nearby same-cluster member (within ${CLUSTER_COHESION_RADIUS_CELLS} cells of their anchor group).`,
  };
}
