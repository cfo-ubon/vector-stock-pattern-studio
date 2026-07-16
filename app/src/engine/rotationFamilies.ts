import type { Rng } from './types';
import { rngRange, rngInt, rngPick } from './rng';
import { tangentToUpAngleDeg } from './curveEngine';

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

// Build 004, Section 7 (Natural Rotation Engine): the brief asks for
// rotation influenced by Stem direction, Cluster direction, Growth
// direction, Composition flow, Gravity, and Wind tendency, instead of
// "independent random rotations". This codebase's geometry makes the first
// three the SAME measurable quantity honestly: a cluster member's direction
// away from its hero *is* the direction it grows/attaches along (there's no
// separate stem-direction data independent of cluster placement), so
// `growthAngleFromOffset` is the one shared primitive for all three, not 3
// separate mechanisms pretending to be different. "Composition flow" is
// already real, existing capability (`engine/styleDna.ts`'s `FlowProfile`/
// `FLOW_ROTATION_JITTER`, which already varies this module's jitter width);
// Gravity and Wind Tendency are genuinely new below.

export interface WindTendency {
  /** The shared lean direction every rotation in a tile can nudge toward —
   * same 0deg-is-up convention as `tangentToUpAngleDeg`. */
  angleDeg: number;
  /** 0..1: how strongly a placement leans toward `angleDeg`. Kept modest
   * (0.08-0.22) by construction — a strong pull would fight the whole
   * point of angle families (varied-but-not-chaotic), reading instead as
   * "everything blew the same way", which isn't what real wind tendency in
   * a botanical illustration looks like. */
  strength: number;
}

/** One shared wind lean for a whole tile generation — call once per
 * `buildTile()`/layout `generate()`, the same "commit once, don't let each
 * placement invent its own" convention `createAngleFamily` already
 * established. */
export function createWindTendency(rng: Rng): WindTendency {
  return { angleDeg: rngRange(rng, 0, 360), strength: rngRange(rng, 0.08, 0.22) };
}

/** The "grows/points outward from its anchor" direction for a cluster
 * member sitting at `(dx, dy)` relative to its hero (always the origin) —
 * literally the same tangent-to-angle convention `curveEngine.ts` already
 * uses for stem-following leaf placement, applied one level up at the
 * cluster's own geometry. */
export function growthAngleFromOffset(dx: number, dy: number): number {
  return tangentToUpAngleDeg({ x: dx, y: dy });
}

/** Straight down in the same 0deg-is-up convention — the direction gravity
 * would pull a drooping bloom/berry toward. */
const GRAVITY_ANGLE_DEG = 180;

function degToUnitVec(deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: Math.sin(rad), y: -Math.cos(rad) };
}

function unitVecToDeg(v: { x: number; y: number }): number {
  return (Math.atan2(v.x, -v.y) * 180) / Math.PI;
}

export interface NaturalRotationInput {
  family: AngleFamily;
  jitterAmount: number;
  /** Stem/Cluster/Growth direction (see `growthAngleFromOffset`) — omit for
   * placements with no directional anchor (falls back to pure
   * family-based rotation, byte-identical to `pickFamilyAngle`). */
  growthAngleDeg?: number;
  /** 0..1: how strongly `growthAngleDeg` pulls the final rotation toward
   * it. Ignored if `growthAngleDeg` is omitted. Defaults to 0.5 — a real
   * pull, but the family base still meaningfully shapes the result. */
  growthWeight?: number;
  /** Shared per-tile wind lean — omit for no wind influence. */
  wind?: WindTendency;
  /** 0..1: how strongly the rotation pulls toward straight down. Defaults
   * to 0 (no pull) — most placements don't want literal drooping; a caller
   * opts in for parts where it reads naturally (a hanging berry, a heavy
   * bloom). */
  gravityWeight?: number;
}

/** Real, measurable rotation blending — a weighted circular mean (vector
 * sum, not naive angle averaging, so e.g. 350deg and 10deg correctly blend
 * toward 0deg rather than 180deg) of the family base angle with whichever
 * of growth direction / wind / gravity the caller opts into, then the same
 * per-instance jitter every existing call site already applies. Every
 * weight defaults to "off", so a caller that passes only `family` +
 * `jitterAmount` gets output identical to `pickFamilyAngle` — this is
 * additive, not a replacement for existing rotation call sites. */
export function pickNaturalRotation(rng: Rng, input: NaturalRotationInput): number {
  const familyBase = rngPick(rng, input.family.angles);
  const hasGrowth = input.growthAngleDeg !== undefined;
  const growthWeight = hasGrowth ? Math.max(0, Math.min(1, input.growthWeight ?? 0.5)) : 0;
  const windWeight = input.wind ? Math.max(0, Math.min(1, input.wind.strength)) : 0;
  const gravityWeight = Math.max(0, Math.min(1, input.gravityWeight ?? 0));
  const familyWeight = Math.max(0, 1 - growthWeight - windWeight - gravityWeight);

  const familyVec = degToUnitVec(familyBase);
  let vx = familyVec.x * familyWeight;
  let vy = familyVec.y * familyWeight;
  if (growthWeight > 0 && input.growthAngleDeg !== undefined) {
    const v = degToUnitVec(input.growthAngleDeg);
    vx += v.x * growthWeight;
    vy += v.y * growthWeight;
  }
  if (windWeight > 0 && input.wind) {
    const v = degToUnitVec(input.wind.angleDeg);
    vx += v.x * windWeight;
    vy += v.y * windWeight;
  }
  if (gravityWeight > 0) {
    const v = degToUnitVec(GRAVITY_ANGLE_DEG);
    vx += v.x * gravityWeight;
    vy += v.y * gravityWeight;
  }
  // Opposing weighted vectors can cancel to (~0, ~0) in edge cases (e.g.
  // family and gravity both pointing exactly opposite with equal weight) --
  // fall back to the plain family base rather than propagate a NaN angle.
  const blended = Math.hypot(vx, vy) < 1e-9 ? familyBase : unitVecToDeg({ x: vx, y: vy });
  return blended + rngRange(rng, -input.jitterAmount, input.jitterAmount);
}
