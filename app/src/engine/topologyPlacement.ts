import type { Rng } from './types';
import { wrapCoord } from '../layouts/shared';
import { rngRange, rngInt, rngPick } from './rng';
import type { LuxuryCompositionProfile } from './luxuryCompositionProfiles';

// Build 025, Phase 4 (Topology-Aware Cluster Placement). BUILD_025_AUDIT.md's
// failure matrix found `clusterEngine.ts`'s existing `placeClusterAnchors`
// scatters anchors across a whole composition zone using only an
// *average*-size-based minimum-distance rule — nothing about that
// guarantees any two anchors end up close enough, in a consistent enough
// direction, to read as one connected arrangement. Two anchors can be
// numerically far apart yet each individually well-formed, which is exactly
// "numerically-close-but-visually-disconnected" inverted: anchors that are
// each fine in isolation but collectively read as scattered islands.
//
// This module replaces each UNIT's own secondary-anchor placement (not the
// whole-tile scatter, which stays `clusterEngine.ts`'s own zone-aware
// `placeClusterAnchors`, reused unchanged by the orchestrator) with
// placement that is connected BY CONSTRUCTION: every secondary anchor is
// placed at a bounded distance from its own unit's primary (or, for
// `dualMassConnected`, its secondary hub) — reachability isn't a downstream
// check that might fail, it's the placement rule itself.

export type LuxuryMassRole = 'primaryHero' | 'secondaryHero' | 'secondary' | 'satellite';

export interface LuxuryAnchor {
  x: number;
  y: number;
  /** Before `heroDominanceEngine.ts` runs, this carries the UNIT's own
   * relative scale (`primary.sizeMul` from `clusterEngine.ts`'s
   * `placeClusterAnchors` size rhythm) for every anchor in the unit --
   * `applyHeroDominance` multiplies its own profile-derived fraction by
   * this value rather than overwriting it, so a unit whose zone-anchor
   * rolled a smaller size rhythm step still produces a proportionally
   * smaller bouquet, preserving the large/medium/small rhythm across the
   * WHOLE tile's several units (an earlier version overwrote this
   * outright, collapsing every unit's hero to one identical size and
   * measurably tanking `scaleDiversity`/`hierarchy`). After
   * `applyHeroDominance` runs, this is the real, final render scale. */
  sizeMul: number;
  massRole: LuxuryMassRole;
  /** Index of the bouquet UNIT (one per tile-scattered primary anchor)
   * this anchor belongs to — repair/connector logic that must stay within
   * one unit groups by this, not by tile position. */
  unitIndex: number;
}

// A small, fixed, non-monotonic cycle of distance fractions within
// [minDist, maxDist] -- the same "few recurring beats, not a continuous
// random draw" convention `clusterEngine.ts`'s own `SIZE_RHYTHM` already
// established for cluster-anchor sizing. `critic/visualAnalysis.ts`'s
// `rhythmRegularity` metric measures exactly this: nearest-neighbor
// spacing forming a small number of recurring intervals scores high,
// spacing drawn continuously at random (a flat, all-different histogram)
// scores near zero.
const DIST_RHYTHM_FRACTIONS = [1.0, 0.62, 0.82, 0.45];

/** Places `count` anchors around `(governX, governY)` at a spread of
 * angles (never all bunched in one direction) and a distance always within
 * `[minDist, maxDist]` — the bounded reach that makes reachability to the
 * governing point a placement guarantee, not a hopeful average. */
function placeMassSecondaries(governX: number, governY: number, count: number, minDist: number, maxDist: number, tileSize: number, rng: Rng): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  const angleStep = (Math.PI * 2) / Math.max(count, 1);
  const startOffset = rngInt(rng, 0, DIST_RHYTHM_FRACTIONS.length - 1);
  const span = maxDist - minDist;
  for (let i = 0; i < count; i++) {
    const angle = i * angleStep + rngRange(rng, -angleStep * 0.35, angleStep * 0.35);
    const frac = DIST_RHYTHM_FRACTIONS[(i + startOffset) % DIST_RHYTHM_FRACTIONS.length];
    const dist = minDist + span * frac * (1 + rngRange(rng, -0.06, 0.06));
    pts.push({ x: wrapCoord(governX + Math.cos(angle) * dist, tileSize), y: wrapCoord(governY + Math.sin(angle) * dist, tileSize) });
  }
  return pts;
}

/** Builds one bouquet unit's full anchor set (primary + bounded-reach
 * secondaries + satellites + optional dual-mass secondary hero) around a
 * single tile-scattered primary position. `primary` is one of the anchors
 * `clusterEngine.ts`'s `placeClusterAnchors` already placed across the
 * whole tile (its own `sizeMul` from the size rhythm there is reused as
 * this unit's own relative scale, so bigger zone-anchors get bigger
 * bouquets, exactly like the pre-Build-025 pipeline). */
export function buildLuxuryUnit(primary: { x: number; y: number; sizeMul: number }, unitIndex: number, profile: LuxuryCompositionProfile, tileSize: number, baseRadius: number, rng: Rng): LuxuryAnchor[] {
  const unitRadius = baseRadius * primary.sizeMul;
  const anchors: LuxuryAnchor[] = [{ x: primary.x, y: primary.y, sizeMul: primary.sizeMul, massRole: 'primaryHero', unitIndex }];

  const secondaryCount = rngInt(rng, profile.secondaryAnchorCount[0], profile.secondaryAnchorCount[1]);
  const minDist = unitRadius * profile.minSecondaryDistanceMul;
  const maxDist = unitRadius * profile.maxSecondaryDistanceMul;
  for (const p of placeMassSecondaries(primary.x, primary.y, secondaryCount, minDist, maxDist, tileSize, rng)) {
    anchors.push({ ...p, sizeMul: primary.sizeMul, massRole: 'secondary', unitIndex });
  }

  let hub: { x: number; y: number } | undefined;
  if (profile.heroCount === 2) {
    // The second connected mass sits at a bounded distance from the
    // primary too (same reach band as the outer secondaries) so it is
    // guaranteed reachable for the Connector Quality Engine's bridge —
    // never a fixed whole-tile position, since this unit itself repeats
    // across the tile.
    const hubAngle = rngRange(rng, 0, Math.PI * 2);
    const hubDist = maxDist * rngRange(rng, 0.85, 1.0);
    hub = { x: wrapCoord(primary.x + Math.cos(hubAngle) * hubDist, tileSize), y: wrapCoord(primary.y + Math.sin(hubAngle) * hubDist, tileSize) };
    anchors.push({ x: hub.x, y: hub.y, sizeMul: primary.sizeMul, massRole: 'secondaryHero', unitIndex });
    const hubSecondaryCount = Math.max(1, Math.round(secondaryCount * 0.5));
    for (const p of placeMassSecondaries(hub.x, hub.y, hubSecondaryCount, minDist, maxDist, tileSize, rng)) {
      anchors.push({ ...p, sizeMul: primary.sizeMul, massRole: 'secondary', unitIndex });
    }
  }

  // Satellites: the profile's own small, explicit allowance of far-flung
  // anchors (a real bouquet's stray sprig), placed just beyond the
  // guaranteed-connected radius -- close enough to still read as
  // belonging to this unit, never a second competing arrangement.
  const masses = hub ? [primary, hub] : [primary];
  for (let i = 0; i < profile.allowedSatellites; i++) {
    const governor = rngPick(rng, masses);
    const angle = rngRange(rng, 0, Math.PI * 2);
    const dist = rngRange(rng, maxDist * 1.15, maxDist * 1.6);
    anchors.push({
      x: wrapCoord(governor.x + Math.cos(angle) * dist, tileSize),
      y: wrapCoord(governor.y + Math.sin(angle) * dist, tileSize),
      sizeMul: 1,
      massRole: 'satellite',
      unitIndex,
    });
  }

  return anchors;
}
