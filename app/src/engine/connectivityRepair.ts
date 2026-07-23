import type { Placement } from './types';
import { buildBouquetSpatialGraph, cellIndexOf, neighborCellsOf, silhouetteGridN } from './bouquetSpatialGraph';

// Build 025, Phase 9b (Connectivity-Aware Thinning Repair). Root cause,
// found by direct instrumentation of a real 30-seed `luxuryFloral` sample:
// of every post-thinning isolated instance (the exact condition
// `critic/visualAnalysis.ts`'s `fragmentedSilhouette` detector penalizes),
// 92% carried NO `clusterId` at all — they were `role: 'filler'` ambient
// scatter instances (`layouts/heroScatter.ts`'s independent Poisson-disc
// filler layer, deliberately spread at a MINIMUM distance from every other
// point so it never clumps — see that layout's own header comment). Only
// 18 of 239 isolated instances (7.5%) belonged to a cluster that still had
// >=2 surviving members, and zero belonged to a single-member cluster —
// meaning `bouquetSpatialGraph.ts`'s existing `reserveClusterCompanions`
// (Build 023) was already doing its job; the dominant, previously
// undiagnosed driver was ambient filler eviction, not cluster-companion
// selection.
//
// `tile.ts`'s Section-10 thinning (`stratifiedSelect`) distributes
// survivors proportionally across a FIXED coarse 8x8 grid (for corner/
// edge-density reasons unrelated to this metric) — a resolution coarser
// than the critic's own finer silhouette grid
// (`round(tileSize / (motifSize * 1.6))`, often 10-14 cells per axis for
// `luxuryFloral`'s real params). Being spatially representative at the
// coarse 8x8 resolution says nothing about whether any two *specific*
// survivors land in adjacent cells at the critic's finer resolution — so
// the existing selection can (and empirically does) leave a filler
// survivor stranded with no neighbor even while "fairly" distributed by
// the coarse grid's own standard.
//
// This module runs AFTER thinning has already picked `keptIndices` (never
// changing WHICH TOTAL COUNT survives, only swapping specific membership),
// swapping in an available never-kept candidate for a currently-isolated
// survivor whenever doing so lands it in an occupied or adjacent cell —
// and only ever COMMITS a swap that measurably reduces the real isolated
// count, verified by rebuilding the exact same graph
// `critic/visualAnalysis.ts` reads, the same "simulate, then keep only a
// strict improvement" discipline `repairEngineV2.ts` already established
// for whole-cluster repositioning. Total instance count (and therefore
// export node budget) is completely unchanged — only which specific
// instances render shifts.

export interface ConnectivityRepairResult {
  keptIndices: Set<number>;
  swapsApplied: number;
}

const MAX_SWAP_PASSES = 80;
const MAX_VICTIM_ATTEMPTS = 15;

function countIsolated(placements: Placement[], tileSize: number, motifSize: number): number {
  return buildBouquetSpatialGraph(placements, tileSize, motifSize).isIsolated.filter(Boolean).length;
}

/** Builds the (placements, originalIndex) pair for every currently-active
 * (kept-or-protected) index, in `paintOrderedPlacements` order — the same
 * "filter, but remember where each survivor came from" step
 * `tile.ts`'s own `survivingPlacements` construction already performs,
 * duplicated here (not imported) only because this needs the index
 * mapping alongside the filtered array, which `survivingPlacements` alone
 * doesn't carry. */
function activeSet(paintOrderedPlacements: Placement[], kept: Set<number>, protectedSet: Set<number>) {
  const activeOriginalIndices: number[] = [];
  const activePlacements: Placement[] = [];
  paintOrderedPlacements.forEach((p, i) => {
    if (kept.has(i) || protectedSet.has(i)) {
      activeOriginalIndices.push(i);
      activePlacements.push(p);
    }
  });
  return { activeOriginalIndices, activePlacements };
}

/** Runs up to `MAX_SWAP_PASSES` rounds of candidate-simulated swap repair.
 * Each pass: find the currently-isolated active instances, and for each
 * one (in order), look through every never-kept thinnable candidate for
 * one whose OWN cell is the isolated instance's cell or a 4-connected
 * neighbor of it — a real adjacency fix, not a distance heuristic that
 * could still land diagonally (which the critic's own 4-connected rule
 * would still count as isolated). Among qualifying candidates, prefer the
 * nearest (real wrapped distance) to the isolated instance. To make room
 * without changing the total kept count, swap out the current kept
 * thinnable instance whose own cell already holds >=2 active occupants
 * (so removing it cannot itself create a new isolated cell) — preferring
 * whichever such victim's cell is most crowded, spreading the "donation"
 * from the least-affected part of the tile. Only commits a swap that
 * strictly reduces the real isolated count (verified by rebuilding the
 * graph); never a blind swap. */
export function repairIsolatedSurvivors(
  paintOrderedPlacements: Placement[],
  initialKept: Set<number>,
  protectedIndices: number[],
  thinnableIndices: number[],
  tileSize: number,
  motifSize: number,
): ConnectivityRepairResult {
  const protectedSet = new Set(protectedIndices);
  const thinnableSet = new Set(thinnableIndices);
  let kept = new Set(initialKept);
  let swapsApplied = 0;
  const gridN = silhouetteGridN(tileSize, motifSize);

  for (let pass = 0; pass < MAX_SWAP_PASSES; pass++) {
    const { activeOriginalIndices, activePlacements } = activeSet(paintOrderedPlacements, kept, protectedSet);
    const graph = buildBouquetSpatialGraph(activePlacements, tileSize, motifSize);
    const isolatedOriginalIndices = graph.isIsolated
      .map((iso, localIdx) => (iso ? activeOriginalIndices[localIdx] : null))
      .filter((v): v is number => v !== null);
    if (isolatedOriginalIndices.length === 0) break;

    let appliedThisPass = 0;
    for (const isoOriginalIdx of isolatedOriginalIndices) {
      // Positions/membership may already have shifted earlier in this same
      // pass — re-derive this instance's current cell fresh rather than
      // trusting the pass-start `graph` snapshot.
      const isoPlacement = paintOrderedPlacements[isoOriginalIdx];
      const isoCell = cellIndexOf(isoPlacement.x, isoPlacement.y, tileSize, gridN);
      const acceptCells = new Set([isoCell, ...neighborCellsOf(isoCell, gridN)]);

      let bestCandidate: number | null = null;
      let bestDist = Infinity;
      for (const cand of thinnableIndices) {
        if (kept.has(cand)) continue;
        const p = paintOrderedPlacements[cand];
        const cell = cellIndexOf(p.x, p.y, tileSize, gridN);
        if (!acceptCells.has(cell)) continue;
        let dx = p.x - isoPlacement.x;
        let dy = p.y - isoPlacement.y;
        if (Math.abs(dx) > tileSize / 2) dx -= Math.sign(dx) * tileSize;
        if (Math.abs(dy) > tileSize / 2) dy -= Math.sign(dy) * tileSize;
        const dist = Math.hypot(dx, dy);
        if (dist < bestDist) {
          bestDist = dist;
          bestCandidate = cand;
        }
      }
      if (bestCandidate === null) continue; // no reachable candidate for this isolated survivor

      // Victim: try every currently-kept thinnable instance as a candidate
      // donor. Ordered by (1) same `role` as the rescuing candidate first —
      // a like-for-like swap leaves the tile's overall role mix (hero/
      // secondary/filler/accent proportions, what `tooManyFillers` reads)
      // untouched, whereas donating a differently-roled instance to make
      // room for (disproportionately filler-role) ambient scatter would
      // systematically skew the survivor mix toward filler over repeated
      // swaps — measured directly: an earlier role-agnostic version of
      // this victim search pushed `tooManyFillers`'s rate up substantially
      // as an unintended side effect of fixing fragmentation — then (2)
      // most-crowded-cell first (a donor from an already-crowded cell is
      // least likely to itself create a new isolated cell, so trying it
      // first finds a working swap in the fewest simulations for the
      // common case). Never assumed: each is verified by simulation below,
      // and the loop stops at the first one that actually helps rather
      // than requiring either heuristic to guarantee success. Recomputed
      // fresh (not from the pass-start graph) since earlier swaps this
      // pass may have changed occupancy. Bounded to `MAX_VICTIM_ATTEMPTS`
      // candidates so one stubborn isolated survivor can't blow up this
      // pass's cost.
      const { activeOriginalIndices: curActiveIdx, activePlacements: curActive } = activeSet(paintOrderedPlacements, kept, protectedSet);
      const curCellOf = curActive.map((p) => cellIndexOf(p.x, p.y, tileSize, gridN));
      const cellCounts = new Map<number, number>();
      curCellOf.forEach((c) => cellCounts.set(c, (cellCounts.get(c) ?? 0) + 1));
      const candidateRole = paintOrderedPlacements[bestCandidate].role;
      const victimCandidates: Array<{ idx: number; cellCount: number; sameRole: boolean }> = [];
      curActiveIdx.forEach((idx, localIdx) => {
        if (!thinnableSet.has(idx) || idx === bestCandidate || !kept.has(idx)) return;
        victimCandidates.push({ idx, cellCount: cellCounts.get(curCellOf[localIdx]) ?? 0, sameRole: paintOrderedPlacements[idx].role === candidateRole });
      });
      victimCandidates.sort((a, b) => (a.sameRole === b.sameRole ? b.cellCount - a.cellCount : a.sameRole ? -1 : 1));

      const beforeIsolated = countIsolated(curActive, tileSize, motifSize);
      let applied = false;
      for (const { idx: victim } of victimCandidates.slice(0, MAX_VICTIM_ATTEMPTS)) {
        const candidateKept = new Set(kept);
        candidateKept.delete(victim);
        candidateKept.add(bestCandidate);
        const { activePlacements: candidateActive } = activeSet(paintOrderedPlacements, candidateKept, protectedSet);
        const afterIsolated = countIsolated(candidateActive, tileSize, motifSize);
        if (afterIsolated < beforeIsolated) {
          kept = candidateKept;
          swapsApplied++;
          appliedThisPass++;
          applied = true;
          break;
        }
      }
      if (!applied) continue; // no donor (of any cell-crowding) actually helps for this candidate
    }
    if (appliedThisPass === 0) break; // fixed point: nothing improvable this pass
  }

  return { keptIndices: kept, swapsApplied };
}
