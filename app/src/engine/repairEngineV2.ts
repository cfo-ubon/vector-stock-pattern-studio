import type { Placement } from './types';
import { buildBouquetSpatialGraph, groupByCluster } from './bouquetSpatialGraph';

// Build 025, Phase 6 (Repair Engine V2). `repairPass.ts`'s existing bounded
// repair (Build 023/024, preserved unchanged and still running first — see
// `tile.ts`) nudges individual isolated MEMBERS toward their own cluster's
// anchor; it never moves a whole cluster's anchor relative to the rest of
// the tile, so two clusters that are each internally cohesive but land far
// from every other cluster still read as separate islands after it runs.
// This engine operates one level up: it treats a whole cluster (anchor +
// every one of its own members, moved together, rigidly) as the unit a
// repair action can reposition, with every candidate action SIMULATED
// first (measured against the identical isolation count the critic's own
// `fragmentedSilhouette` detector would compute) and only the single
// best-improving action applied per pass — never blind, never regressive,
// never a no-op.
//
// The brief names 8 priorities (restore hero dominance, connect major
// masses, reduce empty channel, redirect spine, suppress secondary
// competition, fix edge satellite, improve thumbnail silhouette, reduce
// repair-introduced clutter). Honest scope note: this engine implements 2
// concrete, simulated action FAMILIES (whole-cluster pull-toward-hero, and
// non-hero member scale suppression) rather than 8 fully independent
// mechanisms — every action taken is logged and classified against
// whichever of the 8 named priorities it most directly serves, but this is
// not 8 separately-coded repair strategies. Both families are strictly
// bounded (max 4 passes, each pass moves at most half the remaining
// distance, scale suppression never crosses a floor) and never invent new
// placements — Rule 8 ("no random filler objects") is honored by
// construction, since this engine only ever repositions or rescales
// EXISTING placements.

export type RepairV2ActionType =
  | 'restoreHeroDominance'
  | 'connectMajorMasses'
  | 'reduceEmptyChannel'
  | 'redirectSpine'
  | 'suppressSecondaryCompetition'
  | 'fixEdgeSatellite'
  | 'improveThumbnailSilhouette'
  | 'reduceRepairClutter';

export interface RepairV2Action {
  type: RepairV2ActionType;
  clusterId: number;
  predictedDelta: number;
  actualDelta: number;
  reason: string;
}

export interface RepairV2Result {
  placements: Placement[];
  passesUsed: number;
  appliedActions: RepairV2Action[];
  rejectedActionCount: number;
}

const MAX_PASSES = 4;
const MAX_STEP_FRACTION_OF_CELL = 0.55;
const SHRINK_FACTOR = 0.88;
const SHRINK_FLOOR = 0.15;

function measureIsolatedCount(placements: Placement[], tileSize: number, motifSize: number): number {
  return buildBouquetSpatialGraph(placements, tileSize, motifSize).isIsolated.filter(Boolean).length;
}

function wrapDelta(raw: number, tileSize: number): number {
  let d = raw % tileSize;
  if (d > tileSize / 2) d -= tileSize;
  if (d < -tileSize / 2) d += tileSize;
  return d;
}

function wrappedDist(ax: number, ay: number, bx: number, by: number, tileSize: number): number {
  return Math.hypot(wrapDelta(ax - bx, tileSize), wrapDelta(ay - by, tileSize));
}

/** Rigidly shifts every placement tagged with `clusterId` (and that
 * cluster's own anchor tag) toward `(targetX, targetY)` by up to half the
 * remaining distance, bounded by `maxStep` — moves the whole cluster as one
 * unit so its own internal (already cohesive) shape never changes, only
 * its position relative to the rest of the tile. */
function pullClusterToward(placements: Placement[], clusterId: number, anchorX: number, anchorY: number, targetX: number, targetY: number, tileSize: number, maxStep: number): Placement[] {
  const dx = wrapDelta(targetX - anchorX, tileSize);
  const dy = wrapDelta(targetY - anchorY, tileSize);
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) return placements;
  const step = Math.min(maxStep, dist * 0.5);
  const ux = dx / dist;
  const uy = dy / dist;
  const wrap = (v: number): number => ((v + ux * step) % tileSize + tileSize) % tileSize;
  const wrapY = (v: number): number => ((v + uy * step) % tileSize + tileSize) % tileSize;
  return placements.map((p) => {
    if (p.clusterId !== clusterId) return p;
    return {
      ...p,
      x: ((p.x + ux * step) % tileSize + tileSize) % tileSize,
      y: ((p.y + uy * step) % tileSize + tileSize) % tileSize,
      clusterAnchorX: p.clusterAnchorX !== undefined ? wrap(p.clusterAnchorX) : p.clusterAnchorX,
      clusterAnchorY: p.clusterAnchorY !== undefined ? wrapY(p.clusterAnchorY) : p.clusterAnchorY,
    };
  });
}

function shrinkClusterMembers(placements: Placement[], clusterId: number): Placement[] {
  return placements.map((p) => (p.clusterId === clusterId && p.role !== 'hero' ? { ...p, scale: Math.max(SHRINK_FLOOR, p.scale * SHRINK_FACTOR) } : p));
}

/** Finds, for cluster `group`, the nearest cluster tagged `isPrimaryCluster`
 * (wrap-aware anchor-to-anchor distance) — a tile can contain several
 * Luxury Floral bouquet UNITS (one per tile-scattered primary), so "the"
 * primary a given secondary should repair toward is whichever one governs
 * its own unit, not a single tile-wide id. Returns `undefined` if no
 * primary-tagged cluster exists in `groups` at all. */
function findNearestPrimary(group: { anchorX: number; anchorY: number }, groups: Array<{ clusterId: number; anchorX: number; anchorY: number }>, primaryClusterIds: Set<number>, tileSize: number) {
  let best: { clusterId: number; anchorX: number; anchorY: number } | undefined;
  let bestDist = Infinity;
  for (const g of groups) {
    if (!primaryClusterIds.has(g.clusterId)) continue;
    const d = wrappedDist(group.anchorX, group.anchorY, g.anchorX, g.anchorY, tileSize);
    if (d < bestDist) {
      bestDist = d;
      best = g;
    }
  }
  return best;
}

/** Runs up to `MAX_PASSES` rounds of candidate-simulated repair against
 * every non-primary cluster (any cluster whose placements don't carry
 * `isPrimaryCluster: true` — see `luxuryFloralCompositionEngine.ts`). Each
 * pass tries, for every remaining cluster, a "pull whole cluster toward its
 * own unit's nearest primary anchor" candidate and (for the single largest
 * remaining cluster) a "shrink its non-hero members" candidate, measures
 * each candidate's real effect on the critic's own isolated-cell count, and
 * applies only the single action with the largest strictly-positive
 * improvement — a natural fixed point (no candidate improves anything)
 * stops the loop early, exactly like `repairPass.ts`'s own convention. */
export function applyRepairEngineV2(placements: Placement[], tileSize: number, motifSize: number): RepairV2Result {
  const hasCluster = placements.some((p) => p.clusterId !== undefined);
  if (!hasCluster) return { placements, passesUsed: 0, appliedActions: [], rejectedActionCount: 0 };

  let current = placements;
  const applied: RepairV2Action[] = [];
  let rejectedActionCount = 0;
  const gridN = Math.max(4, Math.min(40, Math.round(tileSize / (motifSize * 1.6))));
  const cellSize = tileSize / gridN;
  const maxStep = cellSize * MAX_STEP_FRACTION_OF_CELL;

  let passesUsed = 0;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    passesUsed = pass + 1;
    const beforeIsolated = measureIsolatedCount(current, tileSize, motifSize);
    const groups = groupByCluster(current);
    const primaryClusterIds = new Set(
      current.filter((p) => p.isPrimaryCluster && p.clusterId !== undefined).map((p) => p.clusterId as number),
    );
    const others = groups.filter((g) => !primaryClusterIds.has(g.clusterId));
    if (primaryClusterIds.size === 0 || others.length === 0) break;

    let best: { type: RepairV2ActionType; clusterId: number; candidate: Placement[]; delta: number } | null = null;

    for (const group of others) {
      const primaryGroup = findNearestPrimary(group, groups, primaryClusterIds, tileSize);
      if (!primaryGroup) continue;
      const candidate = pullClusterToward(current, group.clusterId, group.anchorX, group.anchorY, primaryGroup.anchorX, primaryGroup.anchorY, tileSize, maxStep);
      const afterIsolated = measureIsolatedCount(candidate, tileSize, motifSize);
      const delta = beforeIsolated - afterIsolated;
      if (delta > 0 && (!best || delta > best.delta)) {
        best = { type: 'connectMajorMasses', clusterId: group.clusterId, candidate, delta };
      } else if (delta <= 0) {
        rejectedActionCount++;
      }
    }

    const meanScaleByCluster = others
      .map((g) => {
        const members = current.filter((p) => p.clusterId === g.clusterId);
        const meanScale = members.length ? members.reduce((s, p) => s + p.scale, 0) / members.length : 0;
        return { g, meanScale };
      })
      .sort((a, b) => b.meanScale - a.meanScale);
    if (meanScaleByCluster[0]) {
      const target = meanScaleByCluster[0].g;
      const candidate = shrinkClusterMembers(current, target.clusterId);
      const afterIsolated = measureIsolatedCount(candidate, tileSize, motifSize);
      const delta = beforeIsolated - afterIsolated;
      if (delta > 0 && (!best || delta > best.delta)) {
        best = { type: 'suppressSecondaryCompetition', clusterId: target.clusterId, candidate, delta };
      } else if (delta <= 0) {
        rejectedActionCount++;
      }
    }

    if (!best) break;
    current = best.candidate;
    applied.push({ type: best.type, clusterId: best.clusterId, predictedDelta: best.delta, actualDelta: best.delta, reason: `reduced isolated-cell count by ${best.delta} (from ${beforeIsolated})` });
  }

  return { placements: current, passesUsed, appliedActions: applied, rejectedActionCount };
}
