import type { Rng } from './types';
import { rngRange, rngInt, rngPick } from './rng';

// Rotation Angle Families — Build 003, Part 9. Before this build, every
// placement that needed "some rotation, not aligned to a fixed direction"
// picked a completely fresh, independent uniform angle in [0, 360) per
// instance (`jitter(rng, rngRange(rng, 0, 360), rotationJitter)`,
// repeated at nearly a dozen call sites). That reads as pure noise, not a
// designer's deliberate choice — real surface-pattern design usually
// commits to a small set of "natural" directions a motif tends to face
// (a few families, not one fixed angle and not fully random), which is
// what this module makes real: one small set of base angles is chosen
// once per tile generation, and every placement that wants "varied but
// not chaotic" rotation picks one of those bases (never an angle
// suspiciously close to the grid-aligned 0/45/90/... directions) plus its
// own normal per-instance jitter.
//
// Deliberately keeps the *same* per-instance jitter width every call site
// already used (`rotationJitter`) — this only changes what the jitter is
// centered on (a handful of shared bases instead of a fresh independent
// base every time), so it doesn't fight `critic/visualAnalysis.ts`'s
// `repeatedRotation` detector (12 buckets of 30 degrees, flags a bucket
// holding over 40% of all instances). A first version allowed as few as 2
// families — an even split then puts ~50% of instances in one family, and
// at the default rotationJitter (15, i.e. a +/-15 band that regularly lands
// entirely inside one 30-degree bucket) that alone tripped the detector,
// measurably raising its portfolio-wide rate instead of lowering it. The
// floor is 3 families: an even split there is ~33%, comfortably under 40%.

export interface AngleFamily {
  /** 3-4 base angles (degrees) by default, well-separated, each away from an
   * exact grid-aligned direction. */
  angles: number[];
}

/** Angles a strict grid layout would use — the "obvious repeated
 * rotation" this module exists to avoid landing near. */
const GRID_ALIGNED_DEGREES = [0, 45, 90, 135, 180, 225, 270, 315, 360];
const GRID_AVOIDANCE_MARGIN = 10;

function angularDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

/** Builds one tile-generation's set of 3-4 real, well-separated rotation
 * families — call once per `buildTile()`/layout `generate()` and thread
 * the result into every placement that wants family-based rotation, so
 * the whole tile commits to the same small set of "natural" directions
 * rather than each cluster/placement inventing its own. */
export function createAngleFamily(rng: Rng, count?: number): AngleFamily {
  const n = count ?? rngInt(rng, 3, 4);
  const minSeparation = (360 / n) * 0.6;
  const angles: number[] = [];
  let attempts = 0;
  while (angles.length < n && attempts < 300) {
    attempts++;
    const candidate = rngRange(rng, 0, 360);
    if (GRID_ALIGNED_DEGREES.some((g) => angularDistance(candidate, g) < GRID_AVOIDANCE_MARGIN)) continue;
    if (angles.some((a) => angularDistance(candidate, a) < minSeparation)) continue;
    angles.push(candidate);
  }
  // Exceedingly rare fallback (the avoidance/separation constraints
  // couldn't all be satisfied within the attempt budget) — still returns
  // a real, usable family rather than leaving it short.
  while (angles.length < n) angles.push(rngRange(rng, 0, 360));
  return { angles };
}

/** Picks one of the family's base angles (uniformly, so instances spread
 * roughly evenly across every family in aggregate) and applies the same
 * per-instance jitter width every call site already used. */
export function pickFamilyAngle(rng: Rng, family: AngleFamily, jitterAmount: number): number {
  const base = rngPick(rng, family.angles);
  return base + rngRange(rng, -jitterAmount, jitterAmount);
}
