import type { Placement } from './types';
import { silhouetteGridN, groupByCluster } from './bouquetSpatialGraph';

// Build 023 (Premium Bouquet Silhouette & Visual Cohesion Upgrade),
// Phase: Deterministic Bounded Repair Pass. Runs on the FULL, pre-thinning
// placement list (tile.ts wires this in right after
// `applyCompositionIntelligence`, before `tile.ts`'s Section-10 node-budget
// thinning ever runs) and tightens any cluster member sitting farther from
// its own anchor than `COHESION_TARGET_FRACTION_OF_CELL` allows — never
// toward some other cluster's anchor, never past a bounded per-iteration
// step, and never touching the hero itself (the hero is the fixed
// reference every other member repairs against).
//
// This deliberately does NOT gate on `bouquetSpatialGraph.ts`'s
// `isIsolated` flag: BUILD_023_AUDIT.md Section 3 measured that a
// `luxuryFloral` bouquet-layout tile keeps ~500+ raw cluster placements
// before thinning discards ~90% of them down to the ~40-55 survivors that
// actually reach the critic — at that raw, pre-thinning density, almost
// nothing registers as isolated (most cells have *some* occupant from
// *some* cluster), so an isolation-gated repair pass measured zero real
// effect (see the audit's Section 3 empirical trace). Distance-from-anchor
// is a property of a single member alone, unaffected by how many other
// clusters happen to be nearby, so tightening every member's own spread
// pre-thinning is what actually makes *whichever* subset survives thinning
// (an independent, later selection — see `reserveClusterCompanions`)
// likely to already share a grid cell with its hero.
//
// Fully deterministic given its input `Placement[]` (no RNG): the same
// placements always produce the same repair, satisfying the brief's
// "deterministic bounded repair passes" requirement literally.

const MAX_ITERATIONS = 3;
/** A non-hero cluster member farther than this fraction of the silhouette
 * detector's own cell size from its anchor is a repair candidate. */
const COHESION_TARGET_FRACTION_OF_CELL = 0.5;
/** Per-iteration cap on how far a single member may move, as a fraction of
 * the silhouette detector's own cell size — small enough that a repaired
 * bouquet still reads as "the same arrangement, tightened," never a
 * different composition or a snap-to-anchor collapse. */
const MAX_STEP_FRACTION_OF_CELL = 0.6;

/** Wraps a raw (target - current) delta into the shortest signed distance
 * on a periodic `tileSize` axis — without this, "move toward the anchor"
 * could pick the long way around a wrapped tile edge. */
function wrapDelta(raw: number, tileSize: number): number {
  let d = raw % tileSize;
  if (d > tileSize / 2) d -= tileSize;
  if (d < -tileSize / 2) d += tileSize;
  return d;
}

export interface RepairPassOptions {
  /** Upper bound on the fraction of a single cluster's non-hero members
   * that may be repaired in total across all iterations — see
   * `engine/richnessBudget.ts`. Left undefined lets the caller (tile.ts)
   * supply a style-aware budget; a bare call in tests may omit it to
   * exercise "repair everything isolated," which is what
   * `richnessBudget.ts` itself validates against as its own ceiling case. */
  maxRepairFraction?: number;
  maxIterations?: number;
}

export interface RepairPassResult {
  placements: Placement[];
  /** Total placements moved, summed across all iterations. */
  repairedCount: number;
  iterationsUsed: number;
}

/** Deterministic bounded repair: finds cluster members farther from their
 * own anchor than `COHESION_TARGET_FRACTION_OF_CELL` allows and nudges
 * each one toward that anchor by a bounded step, re-measuring after each
 * iteration and stopping as soon as nothing changed (a natural fixed
 * point) or the iteration cap is hit — never all the way to the anchor,
 * and never more placements per cluster than `maxRepairFraction` allows
 * (worst-offenders first, so a bounded budget spends on the members that
 * need it most). Strict no-op (identical array reference) for a
 * placement list with no cluster-tagged members at all (every
 * lattice-layout tile, `heroScatter`'s pure ambient-filler case). */
export function applyBouquetRepairPass(placements: Placement[], tileSize: number, motifSize: number, options: RepairPassOptions = {}): RepairPassResult {
  const hasAnyCluster = placements.some((p) => p.clusterId !== undefined);
  if (!hasAnyCluster) return { placements, repairedCount: 0, iterationsUsed: 0 };

  const maxIterations = options.maxIterations ?? MAX_ITERATIONS;
  const maxRepairFraction = options.maxRepairFraction ?? 1;
  const cellSize = tileSize / silhouetteGridN(tileSize, motifSize);
  const targetDist = cellSize * COHESION_TARGET_FRACTION_OF_CELL;
  const maxStep = cellSize * MAX_STEP_FRACTION_OF_CELL;

  let current = placements;
  let repairedCount = 0;
  let iterationsUsed = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    const groups = groupByCluster(current);
    const next = current.slice();
    let changed = 0;

    for (const group of groups) {
      const nonHero = group.memberIndexes.filter((i) => current[i].role !== 'hero');
      const maxRepairs = Math.max(0, Math.floor(nonHero.length * maxRepairFraction));
      const withDist = nonHero
        .map((i) => {
          const p = current[i];
          const dx = wrapDelta(group.anchorX - p.x, tileSize);
          const dy = wrapDelta(group.anchorY - p.y, tileSize);
          return { i, dx, dy, dist: Math.hypot(dx, dy) };
        })
        .filter((e) => e.dist > targetDist)
        .sort((a, b) => b.dist - a.dist)
        .slice(0, maxRepairs);

      for (const { i, dx, dy, dist } of withDist) {
        if (dist < 1e-6) continue;
        const p = current[i];
        const step = Math.min(maxStep, dist - targetDist);
        const nx = (p.x + (dx / dist) * step + tileSize) % tileSize;
        const ny = (p.y + (dy / dist) * step + tileSize) % tileSize;
        next[i] = { ...p, x: nx, y: ny };
        changed++;
      }
    }

    current = next;
    iterationsUsed++;
    repairedCount += changed;
    if (changed === 0) break;
  }

  return { placements: current, repairedCount, iterationsUsed };
}
