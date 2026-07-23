import type { Placement } from './types';
import { groupByCluster } from './bouquetSpatialGraph';

// Build 025, Phase 7 (Wrap-Aware Cohesion). A tile repeats seamlessly, so a
// cluster whose members straddle the left/right or top/bottom seam can
// visually "continue" across the repeat boundary the same way a single
// cluster's members read as connected within one tile. The naive check --
// "do these two clusters' bounding boxes overlap once you shift one by
// tileSize?" -- produces false positives: two clusters can have
// wrap-overlapping bounding boxes while their actual members sit nowhere
// near each other once the wrap offset is undone, and false negatives: a
// cluster that DOES continue naturally across the seam can fail a
// same-cluster-id check if thinning happened to keep members on only one
// side. This module measures the REAL member-to-member distance across
// each wrap axis, not a bounding-box heuristic.

export interface WrapCohesionResult {
  /** For each axis, whether at least one pair of DIFFERENT clusters has
   * members close enough (after undoing the wrap offset) to read as
   * visually continuing across that seam. */
  leftRightContinuity: boolean;
  topBottomContinuity: boolean;
  cornerContinuity: boolean;
  /** Count of candidate pairs whose bounding boxes overlap after a wrap
   * shift but whose real (unwrapped) member distance is too large to
   * actually read as connected -- the false-positive case this module
   * exists to catch. */
  falsePositiveWrapPairs: number;
}

const EDGE_BAND_FRACTION = 0.12;

function nearEdge(v: number, tileSize: number, band: number): 'low' | 'high' | null {
  if (v < tileSize * band) return 'low';
  if (v > tileSize * (1 - band)) return 'high';
  return null;
}

/** Real minimum member-to-member distance between two clusters once a
 * candidate wrap offset (`dxWrap`/`dyWrap`, each 0 or +/-tileSize) is
 * applied to the second cluster's members -- the "undo the wrap, then
 * measure honestly" step the naive bounding-box check skips. */
function minWrappedMemberDistance(aMembers: Placement[], bMembers: Placement[], dxWrap: number, dyWrap: number): number {
  let min = Infinity;
  for (const a of aMembers) {
    for (const b of bMembers) {
      const d = Math.hypot(a.x - (b.x + dxWrap), a.y - (b.y + dyWrap));
      if (d < min) min = d;
    }
  }
  return min;
}

/** Measures wrap continuity across all 3 seam types using each cluster's
 * REAL member positions (not bounding boxes) — a pair is judged connected
 * across a seam only when the closest real member-to-member distance,
 * after undoing that seam's wrap offset, is within `connectThreshold`
 * (the same order of magnitude as a normal in-tile cluster's own cohesion
 * target — callers pass the tile's `clusterBaseRadius`-derived value). */
export function computeWrapCohesion(placements: Placement[], tileSize: number, connectThreshold: number): WrapCohesionResult {
  const groups = groupByCluster(placements);
  const membersByCluster = new Map<number, Placement[]>();
  for (const g of groups) membersByCluster.set(g.clusterId, g.memberIndexes.map((i) => placements[i]));

  let leftRight = false;
  let topBottom = false;
  let corner = false;
  let falsePositives = 0;
  const band = EDGE_BAND_FRACTION;

  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const a = groups[i];
      const b = groups[j];
      const aMembers = membersByCluster.get(a.clusterId)!;
      const bMembers = membersByCluster.get(b.clusterId)!;

      const aEdgeX = nearEdge(a.anchorX, tileSize, band);
      const bEdgeX = nearEdge(b.anchorX, tileSize, band);
      const aEdgeY = nearEdge(a.anchorY, tileSize, band);
      const bEdgeY = nearEdge(b.anchorY, tileSize, band);

      // Bounding-box wrap candidate: opposite edges on the same axis.
      const bboxCandidateLR = aEdgeX && bEdgeX && aEdgeX !== bEdgeX;
      const bboxCandidateTB = aEdgeY && bEdgeY && aEdgeY !== bEdgeY;

      if (bboxCandidateLR) {
        const dxWrap = bEdgeX === 'high' ? -tileSize : tileSize;
        const realDist = minWrappedMemberDistance(aMembers, bMembers, dxWrap, 0);
        if (realDist <= connectThreshold) leftRight = true;
        else falsePositives++;
      }
      if (bboxCandidateTB) {
        const dyWrap = bEdgeY === 'high' ? -tileSize : tileSize;
        const realDist = minWrappedMemberDistance(aMembers, bMembers, 0, dyWrap);
        if (realDist <= connectThreshold) topBottom = true;
        else falsePositives++;
      }
      if (bboxCandidateLR && bboxCandidateTB) {
        const dxWrap = bEdgeX === 'high' ? -tileSize : tileSize;
        const dyWrap = bEdgeY === 'high' ? -tileSize : tileSize;
        const realDist = minWrappedMemberDistance(aMembers, bMembers, dxWrap, dyWrap);
        if (realDist <= connectThreshold) corner = true;
      }
    }
  }

  return { leftRightContinuity: leftRight, topBottomContinuity: topBottom, cornerContinuity: corner, falsePositiveWrapPairs: falsePositives };
}
