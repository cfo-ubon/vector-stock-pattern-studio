import type { Placement } from './types';

// Build 023 (Premium Bouquet Silhouette & Visual Cohesion Upgrade),
// Finding 1 (BUILD_023_AUDIT.md): `critic/visualAnalysis.ts`'s
// `fragmentedSilhouette` detector measures connectivity on a
// `tileSize / (motifSize * 1.6)` grid using 4-connected (no diagonal),
// wraparound-aware flood fill. Empirical measurement
// (`clusterBaseRadius(motifSize, density)` vs that same cell size) found
// the two are close in magnitude for `luxuryFloral`'s real resolved
// params (baseRadius ~117px vs a ~112px cell) — meaning a `bouquet`
// archetype's own member-to-hero distances (0.4x-1.05x baseRadius, see
// `clusterEngine.ts`'s per-archetype offsets) routinely land a member in a
// *different* grid cell than its hero or its cluster siblings, well before
// any later composition-intelligence pass ever touches the placement. The
// fragmentation is baked into the raw cluster geometry's scale relative to
// the critic's own measurement granularity, not (primarily) a downstream
// eviction bug — confirmed by measuring zero change in
// `fragmentedSilhouette` rate after gating `applyNegativeSpaceCorrection`
// away from cluster members alone (see BUILD_023_AUDIT.md Section 2).
//
// This module builds the *same* connectivity graph the critic computes
// (same cell size, same 4-connected wraparound adjacency) but keeps the
// per-cluster membership (`Placement.clusterId`, Build 023) alongside it,
// so a caller can answer "which of *this bouquet's own* members are
// stranded in their own cell" — the real, actionable signal
// `engine/repairPass.ts` needs, and a real, more accurate cluster-aware
// signal `critic/visualAnalysis.ts`'s `fragmentedSilhouetteV2` reports
// alongside (never replacing) the original V1 detector.
//
// Deliberately duplicated (not imported) from critic/visualAnalysis.ts's
// private constants — this app's own established convention
// (engine/paletteContrastEngine.ts's `relativeLuminance` doc comment) for
// avoiding a critic/ -> engine/ layering inversion (critic/ already
// imports from engine/ elsewhere in this codebase, never the reverse).
export const SILHOUETTE_GRID_MIN = 4;
export const SILHOUETTE_GRID_MAX = 40;
export const SILHOUETTE_CELL_TO_MOTIF_RATIO = 1.6;

export function silhouetteGridN(tileSize: number, motifSize: number): number {
  return Math.max(
    SILHOUETTE_GRID_MIN,
    Math.min(SILHOUETTE_GRID_MAX, Math.round(tileSize / (motifSize * SILHOUETTE_CELL_TO_MOTIF_RATIO))),
  );
}

/** Exported so a caller that needs to test "would this OTHER point land in
 * the same or a neighboring cell" (Build 025, Phase 9b's
 * `connectivityRepair.ts`) uses the identical wraparound cell-index math
 * this module's own graph is built from, rather than a second
 * hand-derived copy that could drift out of sync. */
export function cellIndexOf(x: number, y: number, tileSize: number, gridN: number): number {
  const cell = tileSize / gridN;
  const gx = Math.min(gridN - 1, Math.floor((((x % tileSize) + tileSize) % tileSize) / cell));
  const gy = Math.min(gridN - 1, Math.floor((((y % tileSize) + tileSize) % tileSize) / cell));
  return gy * gridN + gx;
}

export interface BouquetSpatialGraph {
  gridN: number;
  cellSize: number;
  /** Cell index (wraparound-normalized) for each input placement, by index. */
  cellOf: number[];
  /** True for a placement whose own cell has no other occupied placement
   * AND no 4-connected (orthogonal, wraparound-aware) neighboring cell
   * occupied either — i.e. it is a genuinely isolated single-cell island,
   * the exact condition `computeSilhouetteCohesion` counts toward
   * `isolatedFraction`. */
  isIsolated: boolean[];
}

/** The same 4-connected, wraparound-aware neighbor set every isolation
 * check in this module (and `connectivityRepair.ts`) uses — extracted so
 * both call sites share one definition of "adjacent" rather than risking
 * two copies drifting apart. */
export function neighborCellsOf(cell: number, gridN: number): number[] {
  const gx = cell % gridN;
  const gy = Math.floor(cell / gridN);
  return [
    gy * gridN + ((gx + 1) % gridN),
    gy * gridN + ((gx - 1 + gridN) % gridN),
    ((gy + 1) % gridN) * gridN + gx,
    ((gy - 1 + gridN) % gridN) * gridN + gx,
  ];
}

/** Builds the connectivity graph over `placements` using the identical
 * cell size and 4-connected wraparound adjacency rule
 * `critic/visualAnalysis.ts`'s `computeSilhouetteCohesion` uses — so
 * `isIsolated[i]` means exactly "the critic's flood fill would count this
 * placement's cell as its own size-1 component," not an approximation. */
export function buildBouquetSpatialGraph(placements: Placement[], tileSize: number, motifSize: number): BouquetSpatialGraph {
  const gridN = silhouetteGridN(tileSize, motifSize);
  const cellSize = tileSize / gridN;
  const cellOf = placements.map((p) => cellIndexOf(p.x, p.y, tileSize, gridN));
  const occupied = new Set(cellOf);
  const isIsolated = cellOf.map((c) => {
    const neighbors = neighborCellsOf(c, gridN);
    const hasOccupiedNeighbor = neighbors.some((n) => n !== c && occupied.has(n));
    // A cell with >1 placement in it is never isolated (they already share
    // one component by construction); otherwise isolation depends on
    // whether any neighboring cell is occupied.
    const sameCellCount = cellOf.filter((cc) => cc === c).length;
    return sameCellCount === 1 && !hasOccupiedNeighbor;
  });
  return { gridN, cellSize, cellOf, isIsolated };
}

export interface ClusterGroup {
  clusterId: number;
  anchorX: number;
  anchorY: number;
  memberIndexes: number[];
}

/** Groups placement indexes by `clusterId` (Build 023's tag, set only by
 * `clusterEngine.ts`'s `buildClusterPlacements`) — placements with no
 * `clusterId` (every lattice-layout placement, `heroScatter`'s
 * independent ambient-filler layer, `connectClusters`' bridge accents)
 * are simply absent from the result, not an error case. */
export function groupByCluster(placements: Placement[]): ClusterGroup[] {
  const byId = new Map<number, ClusterGroup>();
  placements.forEach((p, i) => {
    if (p.clusterId === undefined) return;
    let group = byId.get(p.clusterId);
    if (!group) {
      group = { clusterId: p.clusterId, anchorX: p.clusterAnchorX ?? p.x, anchorY: p.clusterAnchorY ?? p.y, memberIndexes: [] };
      byId.set(p.clusterId, group);
    }
    group.memberIndexes.push(i);
  });
  return [...byId.values()].sort((a, b) => a.clusterId - b.clusterId);
}

/** Build 023, Finding 2 (BUILD_023_AUDIT.md Section 3): `tile.ts`'s
 * Section-10 node-budget thinning pass (`stratifiedSelect`) selects
 * survivors from a coarse 8x8 spatial grid with no cluster awareness at
 * all. Because a `premiumHero` tile's hero itself costs many SVG nodes,
 * the thinnable (non-hero) budget after protecting every hero is often
 * small relative to the number of surviving hero clusters — frequently
 * small enough that most clusters get *zero* surviving companions,
 * leaving each hero to stand alone as a single-cell island (the direct,
 * measured mechanism behind `luxuryFloral`'s 100% `fragmentedSilhouette`
 * rate; see the audit's Section 3 for the real instance-count evidence:
 * ~55 total surviving instances across ~40-56 clusters).
 *
 * This reserves, deterministically and up to `maxReservations`, the
 * single nearest-to-anchor thinnable member of each cluster — called
 * *before* the existing `stratifiedSelect` proportional pass runs on
 * whatever thinnable budget remains, so the total kept-instance count
 * (and therefore the total SVG node count / export size) is completely
 * unchanged; only *which* instances survive shifts, biased toward "every
 * hero keeps at least one companion" over "some heroes keep three
 * companions, others keep none." A strict no-op for any placement list
 * with no `clusterId` at all (every lattice-layout tile). */
export function reserveClusterCompanions(thinnableIndices: number[], placements: Placement[], maxReservations: number): Set<number> {
  const reserved = new Set<number>();
  if (maxReservations <= 0) return reserved;
  const thinnableSet = new Set(thinnableIndices);
  const groups = groupByCluster(placements).filter((g) => g.memberIndexes.some((i) => thinnableSet.has(i)));
  for (const group of groups) {
    if (reserved.size >= maxReservations) break;
    const candidates = group.memberIndexes.filter((i) => thinnableSet.has(i));
    if (candidates.length === 0) continue;
    let best = candidates[0];
    let bestDist = Infinity;
    for (const i of candidates) {
      const p = placements[i];
      const d = Math.hypot(p.x - group.anchorX, p.y - group.anchorY);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    reserved.add(best);
  }
  return reserved;
}
