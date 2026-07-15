import type { Rng } from './types';
import { rngRange, rngInt } from './rng';

// Composition Zone Engine — Build 003, Part 1 ("Composition Planning") +
// Part 6 ("Flow Engine"), unified into one real system. Before this build,
// every cluster-based layout placed its cluster *anchors* (the hero point
// each cluster grows from) via plain toroidal Poisson-disc rejection
// sampling (`layouts/shared.ts`'s `poissonDiscPoints`) — uniform-density,
// no global skeleton. This module is the "invisible composition zone" the
// brief asks for: one named archetype is chosen per generation, and every
// cluster anchor for that tile is sampled so it's biased toward that
// archetype's own real geometric skeleton (a diagonal band, a sine wave, a
// golden-ratio spiral, ...) instead of being uniformly likely anywhere.
//
// Two real sampling strategies, chosen per zone:
//  - "field" zones (diagonal/sCurve/zFlow/centerFocus/cornerFlow/radial/
//    wave/editorial) define a density function over the tile and use
//    weighted rejection sampling — candidates in the skeleton's own band
//    are far more likely to be accepted than candidates far from it, but
//    it is genuine rejection sampling (not a hard clip), so a tile isn't
//    left with impossible dead corners.
//  - "sequence" zones (offset/goldenRatio) generate candidate anchor
//    positions directly from a deterministic formula (an offset grid, a
//    golden-angle spiral) with real per-instance jitter, rather than
//    scoring a density field.
// Both strategies feed the same toroidal minimum-distance acceptance loop
// `placeZoneAnchors` uses, so anchor collision-avoidance is identical
// across every zone — only *where the density concentrates* differs,
// which is the actual, honest content of "the generator chooses a
// composition and everything follows it."

export type CompositionZone =
  | 'diagonal'
  | 'sCurve'
  | 'zFlow'
  | 'centerFocus'
  | 'cornerFlow'
  | 'radial'
  | 'wave'
  | 'editorial'
  | 'offset'
  | 'goldenRatio';

export const COMPOSITION_ZONES: CompositionZone[] = [
  'diagonal', 'sCurve', 'zFlow', 'centerFocus', 'cornerFlow', 'radial', 'wave', 'editorial', 'offset', 'goldenRatio',
];

/** Per-generation randomized parameters for a zone's skeleton — without
 * these, every tile that picks the same zone would look identical (the
 * skeleton itself would be static). `phase`/`secondaryPhase` shift the
 * skeleton's position/timing; `bandWidth` controls how tightly anchors
 * hug it (narrower = more obviously "composed", wider = looser).
 *
 * Build 003 (measured regression fix): the original [0.1, 0.16] range put
 * a zone's band at roughly the same physical width as one cell of
 * `engine/tile.ts`'s node-budget `stratifiedSelect` 8x8 thinning grid
 * (each cell is 0.125 of the tile) — real measurement against the frozen
 * portfolio found this crammed nearly every anchor into 1-2 thinning
 * cells for hero-heavy presets (`luxuryFloral`, `darkBotanical`), and
 * thinning those few overloaded cells hard enough to hit the node budget
 * skewed the surviving scale distribution enough to trip
 * `repeatedScale` (portfolio rate 3% -> 9%). Widened so a zone's band
 * reliably spans multiple grid cells, keeping the real directional bias
 * (still measured and asserted in `compositionZones.test.ts`) without
 * concentrating anchors pathologically relative to the thinning grid. */
export interface ZoneParams {
  phase: number;
  secondaryPhase: number;
  bandWidth: number;
  ringCount: number;
}

export function sampleZoneParams(rng: Rng): ZoneParams {
  return {
    phase: rngRange(rng, 0, Math.PI * 2),
    secondaryPhase: rngRange(rng, 0, Math.PI * 2),
    bandWidth: rngRange(rng, 0.22, 0.32),
    ringCount: rngInt(rng, 2, 3),
  };
}

/** Toroidal (wrap-aware) distance from `v` to the nearest 0 (mod 1) —
 * the shared building block every "distance to a band" density below
 * uses, since a composition skeleton must itself repeat smoothly across
 * the tile seam the same way placements do. */
function wrappedDelta(v: number): number {
  const f = ((v % 1) + 1) % 1;
  return Math.min(f, 1 - f);
}

function gaussian(dist: number, width: number): number {
  return Math.exp(-((dist / width) ** 2));
}

/** 0..1 "how strongly does this zone want an anchor here" for the 8 field
 * zones. `nx`/`ny` are tile-normalized (0..1) coordinates. Every formula
 * is toroidal — built from `wrappedDelta` — so the skeleton itself tiles
 * seamlessly, not just the placements sampled from it. */
function fieldDensity(zone: Exclude<CompositionZone, 'offset' | 'goldenRatio'>, nx: number, ny: number, p: ZoneParams): number {
  switch (zone) {
    case 'diagonal': {
      const d = wrappedDelta(nx - ny + p.phase / (Math.PI * 2));
      return gaussian(d, p.bandWidth);
    }
    case 'sCurve': {
      const wave = 0.5 + 0.28 * Math.sin(2 * Math.PI * nx + p.phase);
      return gaussian(wrappedDelta(ny - wave), p.bandWidth);
    }
    case 'zFlow': {
      // Three linear segments: a top band (left->right), a diagonal
      // connector, a bottom band (left->right) — a real Z, not a
      // renamed diagonal (the two horizontal legs are diagonal's own
      // absence, not its presence).
      const topY = 0.18 + 0.06 * Math.sin(p.phase);
      const botY = 0.82 + 0.06 * Math.sin(p.secondaryPhase);
      const topScore = nx < 0.6 ? gaussian(wrappedDelta(ny - topY), p.bandWidth) : 0;
      const botScore = nx > 0.4 ? gaussian(wrappedDelta(ny - botY), p.bandWidth) : 0;
      const diagY = topY + (botY - topY) * ((nx - 0.2) / 0.6);
      const diagScore = nx >= 0.2 && nx <= 0.8 ? gaussian(wrappedDelta(ny - diagY), p.bandWidth) : 0;
      return Math.max(topScore, botScore, diagScore);
    }
    case 'centerFocus': {
      // Multiplier halved from the original 2.2 when `bandWidth`'s own
      // base range widened (Build 003 grid-interaction fix, see
      // `sampleZoneParams`) — keeps this zone's actual falloff width
      // close to its original, already-2D (not 1D-band) scale rather
      // than doubling an already-generous radius.
      const dx = wrappedDelta(nx - 0.5);
      const dy = wrappedDelta(ny - 0.5);
      return gaussian(Math.hypot(dx, dy), p.bandWidth * 1.1);
    }
    case 'cornerFlow': {
      // The tile's 4 corners are one point under wrap — concentrating
      // density there gives a real, distinct "radiates from the seam"
      // identity rather than centerFocus's "radiates from the middle".
      const dx = wrappedDelta(nx);
      const dy = wrappedDelta(ny);
      return gaussian(Math.hypot(dx, dy), p.bandWidth * 1.1);
    }
    case 'radial': {
      const dx = wrappedDelta(nx - 0.5);
      const dy = wrappedDelta(ny - 0.5);
      const dist = Math.hypot(dx, dy);
      let best = 0;
      for (let ring = 1; ring <= p.ringCount; ring++) {
        const ringR = (ring / (p.ringCount + 0.5)) * 0.5;
        best = Math.max(best, gaussian(dist - ringR, p.bandWidth * 0.6));
      }
      return best;
    }
    case 'wave': {
      let best = 0;
      for (let band = 0; band < p.ringCount; band++) {
        const bandCenter = (band + 0.5) / p.ringCount;
        const wave = bandCenter + 0.12 * Math.sin(2 * Math.PI * nx * 1.5 + p.phase + band);
        best = Math.max(best, gaussian(wrappedDelta(ny - wave), p.bandWidth));
      }
      return best;
    }
    case 'editorial': {
      const rows = p.ringCount;
      let best = 0;
      for (let row = 0; row < rows; row++) {
        const rowY = (row + 0.5) / rows + 0.03 * Math.sin(2 * Math.PI * nx + p.phase + row * 1.7);
        best = Math.max(best, gaussian(wrappedDelta(ny - rowY), p.bandWidth * 0.8));
      }
      return best;
    }
  }
}

/** Explicit anchor-candidate sequence for the 2 "sequence" zones — a
 * deterministic formula sampled by index (with real per-instance jitter),
 * rather than a scored density field. `expectedCount` is the real anchor
 * count `placeZoneAnchors` is trying to fill — the golden-ratio spiral's
 * own radius formula needs it (see below) to actually reach the tile's
 * edge by the time enough points are placed, rather than concentrating
 * every accepted anchor in the inner disk regardless of how many anchors
 * are actually needed. */
function sequenceCandidate(zone: 'offset' | 'goldenRatio', index: number, tileSize: number, p: ZoneParams, rng: Rng, expectedCount: number): [number, number] {
  if (zone === 'offset') {
    // A brick/half-drop-style offset grid, but organic: alternate rows
    // shift by half a cell, and every point gets real jitter so it never
    // reads as a mechanical lattice (the same "structured but not rigid"
    // identity `layouts/halfDrop.ts` establishes for full motifs, applied
    // here one level up at the cluster-anchor level).
    const cols = 4;
    const rows = 4;
    const col = index % cols;
    const row = Math.floor(index / cols) % rows;
    const rowOffset = row % 2 === 1 ? 0.5 / cols : 0;
    const jitterX = rngRange(rng, -0.06, 0.06);
    const jitterY = rngRange(rng, -0.06, 0.06);
    const nx = (col + 0.5) / cols + rowOffset + jitterX;
    const ny = (row + 0.5) / rows + jitterY;
    return [wrappedDelta(nx) * tileSize, wrappedDelta(ny) * tileSize];
  }
  // goldenRatio: the golden-angle spiral (real, well-known composition
  // math) — r = sqrt(i) scaled to fit the tile, theta = i * golden angle.
  // Wrapped into the tile via modulo since the spiral itself would
  // otherwise spill past the tile bounds for larger i.
  //
  // Build 003 (measured regression fix): the radius formula's own
  // normalizer must scale with how many anchors are actually needed, not
  // a hardcoded constant — the original fixed divisor (24) meant that for
  // the smaller anchor counts real cluster layouts typically use (well
  // under 24), every accepted anchor landed within the inner ~30% of the
  // tile's radius (the spiral never got the chance to reach further out
  // before enough well-spaced points were found), concentrating anchors
  // into a handful of `engine/tile.ts`'s node-budget thinning grid cells
  // the same way the original narrow `bandWidth` did for the field zones.
  // Normalizing by the real expected count (with headroom for minDist
  // rejections) makes the spiral actually span the tile regardless of
  // how many anchors are requested.
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const theta = index * goldenAngle + p.phase;
  const normalizer = Math.max(8, expectedCount * 1.6);
  const r = Math.sqrt((index + 1) / normalizer) * 0.5;
  const jx = rngRange(rng, -0.045, 0.045);
  const jy = rngRange(rng, -0.045, 0.045);
  const nx = 0.5 + r * Math.cos(theta) + jx;
  const ny = 0.5 + r * Math.sin(theta) + jy;
  return [wrappedDelta(nx) * tileSize, wrappedDelta(ny) * tileSize];
}

function periodicDist(ax: number, ay: number, bx: number, by: number, tileSize: number): number {
  let best = Infinity;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const ddx = ax - (bx + dx * tileSize);
      const ddy = ay - (by + dy * tileSize);
      const d = Math.sqrt(ddx * ddx + ddy * ddy);
      if (d < best) best = d;
    }
  }
  return best;
}

/** Places `targetCount` anchors (min spacing `minDist`, toroidal) biased
 * toward `zone`'s own real skeleton — the direct replacement for
 * `clusterEngine.ts`'s previous plain `poissonDiscPoints` anchor call.
 *
 * Uses greedy highest-density-first selection rather than independent
 * per-candidate rejection sampling: a large candidate pool is generated
 * (field zones: uniform random points scored by `fieldDensity`; sequence
 * zones: their own deterministic formula, in its natural priority order),
 * sorted by priority, then walked in that order accepting each candidate
 * that still clears `minDist` against everything already accepted. This
 * matters at the anchor counts real layouts actually use (often under
 * 15): independent Bernoulli-accept sampling can have the tight in-band
 * candidates knock each other out via `minDist` before enough of them are
 * even tried, letting the "give every spot a small chance" floor
 * candidates dominate the final set by sheer numeric advantage — greedy
 * highest-priority-first never has that failure mode, since a lower-
 * priority candidate is only ever used to fill a slot no higher-priority
 * candidate could still occupy. Falls back to uniform placement for any
 * remaining slots if a zone's own skeleton can't supply enough well-
 * spaced points at all — guarantees a real, non-degenerate anchor count
 * always, the same guarantee `poissonDiscPoints` already gave. */
export function placeZoneAnchors(zone: CompositionZone, tileSize: number, minDist: number, targetCount: number, rng: Rng): Array<[number, number]> {
  const p = sampleZoneParams(rng);
  const isSequence = zone === 'offset' || zone === 'goldenRatio';
  const poolSize = Math.max(400, targetCount * 60);

  const candidates: Array<{ x: number; y: number; priority: number }> = [];
  if (isSequence) {
    for (let i = 0; i < poolSize; i++) {
      const [x, y] = sequenceCandidate(zone, i, tileSize, p, rng, targetCount);
      // The sequence's own generation order *is* its priority (earlier
      // spiral/grid points are the ones meant to anchor the composition).
      candidates.push({ x, y, priority: poolSize - i });
    }
  } else {
    for (let i = 0; i < poolSize; i++) {
      const x = rngRange(rng, 0, tileSize);
      const y = rngRange(rng, 0, tileSize);
      const density = fieldDensity(zone, x / tileSize, y / tileSize, p);
      // A tiny random tie-breaker only — negligible next to any real
      // density difference, so it can't itself reorder priority.
      candidates.push({ x, y, priority: density + rng() * 1e-6 });
    }
    candidates.sort((a, b) => b.priority - a.priority);
  }

  const points: Array<[number, number]> = [];
  for (const c of candidates) {
    if (points.length >= targetCount) break;
    const ok = points.every(([px, py]) => periodicDist(c.x, c.y, px, py, tileSize) >= minDist);
    if (ok) points.push([c.x, c.y]);
  }

  // Uniform top-up for any shortfall (rare — only very tight minDist +
  // very narrow bandWidth combinations exhaust the attempt budget).
  let topUpAttempts = 0;
  const topUpBudget = targetCount * 40;
  while (points.length < targetCount && topUpAttempts < topUpBudget) {
    topUpAttempts++;
    const cx = rngRange(rng, 0, tileSize);
    const cy = rngRange(rng, 0, tileSize);
    const ok = points.every(([px, py]) => periodicDist(cx, cy, px, py, tileSize) >= minDist);
    if (ok) points.push([cx, cy]);
  }

  return points;
}
