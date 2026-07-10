import type { Placement } from './types';
import { periodicDist } from './svgGeometry';

// Composition Intelligence Engine (Roadmap Phase 2) — where Phase 1's
// Scoring Engine only *measures* composition quality after a tile is built,
// this module *acts* on the raw placement list before it's turned into SVG:
// a deterministic, geometry-only refinement pass that corrects severe
// quadrant-weight imbalance and smooths isolated-motif spacing outliers.
// Pure functions, no rng — it only ever reshapes the placements the layout
// and hierarchy pass already produced, never adds/removes any or consumes
// additional random draws, so it never disturbs seed determinism upstream.

export interface CompositionIntelligenceParams {
  /** 0 = no quadrant-balance correction, 1 = strongest correction. */
  balanceStrength: number;
  /** 0 = no spacing-rhythm smoothing, 1 = strongest smoothing. */
  rhythmStrength: number;
}

export const DEFAULT_COMPOSITION_INTELLIGENCE: CompositionIntelligenceParams = {
  balanceStrength: 0.5,
  rhythmStrength: 0.35,
};

/** A hero motif reads as visually heavier than its raw area alone would
 * suggest (it's the piece the eye is meant to land on first) — a small,
 * documented perceptual bump on top of the scale^2 area proxy, not an
 * arbitrary hardcoded score. */
const ROLE_WEIGHT: Record<string, number> = { hero: 1.5, secondary: 1.15, filler: 0.85, accent: 0.6 };

export function computeWeight(p: Placement): number {
  const bump = p.role ? (ROLE_WEIGHT[p.role] ?? 1) : 1;
  return p.scale * p.scale * bump;
}

function quadrantOf(x: number, y: number, tileSize: number): number {
  const px = ((x % tileSize) + tileSize) % tileSize;
  const py = ((y % tileSize) + tileSize) % tileSize;
  const qx = px < tileSize / 2 ? 0 : 1;
  const qy = py < tileSize / 2 ? 0 : 1;
  return qy * 2 + qx;
}

/** Mirrors a point across whichever tile mid-line separates `fromQ` from
 * `toQ`, preserving its distance-from-edge relationship on the axis that
 * doesn't change quadrant — a locally-consistent relocation (not a random
 * jump), and one that's guaranteed to land in the target quadrant since a
 * full mirror always crosses to the opposite side of that mid-line. */
function reflectIntoQuadrant(p: { x: number; y: number }, fromQ: number, toQ: number, tileSize: number): { x: number; y: number } {
  const fromQx = fromQ % 2;
  const fromQy = Math.floor(fromQ / 2);
  const toQx = toQ % 2;
  const toQy = Math.floor(toQ / 2);
  const px = ((p.x % tileSize) + tileSize) % tileSize;
  const py = ((p.y % tileSize) + tileSize) % tileSize;
  return {
    x: fromQx !== toQx ? tileSize - px : p.x,
    y: fromQy !== toQy ? tileSize - py : p.y,
  };
}

/** Redistributes a bounded number of the lightest placements out of the
 * heaviest quadrant into the lightest one, blending most (never all) of the
 * way to a guaranteed-crossing reflected position rather than snapping —
 * only fires when the imbalance is severe (mild unevenness reads as
 * designed, not machine-stamped). */
export function applyBalanceCorrection(placements: Placement[], tileSize: number, strength: number): Placement[] {
  if (strength <= 0 || placements.length < 4) return placements;

  const weights = placements.map(computeWeight);
  const quadWeights = [0, 0, 0, 0];
  const quadIndex = placements.map((p, i) => {
    const q = quadrantOf(p.x, p.y, tileSize);
    quadWeights[q] += weights[i];
    return q;
  });
  const totalWeight = quadWeights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) return placements;

  const meanWeight = totalWeight / 4;
  const heaviest = quadWeights.indexOf(Math.max(...quadWeights));
  const lightest = quadWeights.indexOf(Math.min(...quadWeights));
  const imbalance = (quadWeights[heaviest] - quadWeights[lightest]) / (meanWeight || 1);
  if (heaviest === lightest || imbalance < 0.5) return placements;

  const movable = placements
    .map((_, i) => ({ i, w: weights[i] }))
    .filter((e) => quadIndex[e.i] === heaviest)
    // Move the lightest placements out first — relieves crowding without
    // disturbing the quadrant's own anchor/hero motifs.
    .sort((a, b) => a.w - b.w);

  const excessWeight = (quadWeights[heaviest] - meanWeight) * strength;
  const maxMoves = Math.max(1, Math.floor(placements.length * 0.15));
  // A blend of exactly 50% toward a full mirror reflection lands exactly on
  // the mid-line (ambiguous quadrant) — anything above 50% is guaranteed to
  // cross into the target quadrant, so this always actually relocates the
  // placement's region while still leaving room for `strength` to control
  // how much of the *rest* of its position (the non-flipping axis, and how
  // far past the mid-line) follows along.
  const pullFrac = 0.5 + 0.45 * strength;

  const result = placements.slice();
  let movedWeight = 0;
  let moved = 0;
  for (const entry of movable) {
    if (moved >= maxMoves || movedWeight >= excessWeight) break;
    const p = result[entry.i];
    const reflected = reflectIntoQuadrant(p, heaviest, lightest, tileSize);
    result[entry.i] = {
      ...p,
      x: p.x + (reflected.x - p.x) * pullFrac,
      y: p.y + (reflected.y - p.y) * pullFrac,
    };
    movedWeight += entry.w;
    moved++;
  }
  return result;
}

/** The shortest periodic (wrap-aware) vector from a to b — same neighbor
 * relationship `periodicDist` measures, but returning the offset itself
 * instead of just its length, since the smoothing pass needs a direction to
 * pull along. */
function shortestOffset(a: { x: number; y: number }, b: { x: number; y: number }, tileSize: number): { dx: number; dy: number } {
  let bestDx = 0;
  let bestDy = 0;
  let best = Infinity;
  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      const dx = b.x + ox * tileSize - a.x;
      const dy = b.y + oy * tileSize - a.y;
      const d = Math.hypot(dx, dy);
      if (d < best) {
        best = d;
        bestDx = dx;
        bestDy = dy;
      }
    }
  }
  return { dx: bestDx, dy: bestDy };
}

/** Pulls placements that sit unusually far from their nearest neighbor
 * (isolated outliers that break the pattern's spacing rhythm) a bounded
 * fraction of the way toward that neighbor. Placements whose spacing is
 * already within a normal range are left untouched. */
export function applyRhythmSmoothing(placements: Placement[], tileSize: number, strength: number): Placement[] {
  if (strength <= 0 || placements.length < 3) return placements;

  const nearest = placements.map((p, i) => {
    let best = Infinity;
    let other: Placement | null = null;
    placements.forEach((o, j) => {
      if (i === j) return;
      const d = periodicDist(p, o, tileSize);
      if (d < best) {
        best = d;
        other = o;
      }
    });
    return { distance: best, other };
  });

  const finite = nearest.map((n) => n.distance).filter((d) => Number.isFinite(d));
  if (finite.length === 0) return placements;
  const mean = finite.reduce((a, b) => a + b, 0) / finite.length;
  const variance = finite.reduce((a, d) => a + (d - mean) ** 2, 0) / finite.length;
  const stdev = Math.sqrt(variance);
  if (stdev <= 0) return placements;
  const threshold = mean + stdev * 1.25;

  const result = placements.slice();
  const maxMoves = Math.max(1, Math.floor(placements.length * 0.2));
  const pullFrac = 0.3 * strength;
  let moved = 0;
  for (let i = 0; i < placements.length && moved < maxMoves; i++) {
    const { distance, other } = nearest[i];
    if (!Number.isFinite(distance) || distance <= threshold || !other) continue;
    const p = result[i];
    const { dx, dy } = shortestOffset(p, other, tileSize);
    result[i] = { ...p, x: p.x + dx * pullFrac, y: p.y + dy * pullFrac };
    moved++;
  }
  return result;
}

/** Orchestrator: balance correction first (coarse, region-level), then
 * rhythm smoothing (fine, neighbor-level) — undefined params is a strict
 * no-op, returning the exact same array reference, so old saved patterns
 * that predate this field reproduce identically. */
export function applyCompositionIntelligence(
  placements: Placement[],
  tileSize: number,
  params?: CompositionIntelligenceParams,
): Placement[] {
  if (!params) return placements;
  const balanced = applyBalanceCorrection(placements, tileSize, params.balanceStrength);
  return applyRhythmSmoothing(balanced, tileSize, params.rhythmStrength);
}
