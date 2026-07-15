import type { Placement, Rng } from './types';
import type { MotifRole } from './hierarchy';
import { jitter, rngRange, rngInt, rngPick, rngBool } from './rng';
import { spacingForDensity, wrapCoord } from '../layouts/shared';
import { COMPOSITION_ZONES, placeZoneAnchors, type CompositionZone } from './compositionZones';
import { createAngleFamily, pickFamilyAngle, type AngleFamily } from './rotationFamilies';
import { resolveClusterCollisions } from './clusterAvoidance';
import { smoothPathD, type Pt } from './curveEngine';

// Cluster Composition Engine — Project Phoenix V2, Section 1/2. Replaces
// "scatter individual motifs independently" with the workflow the brief
// names explicitly: generate a cluster -> arrange motifs inside it ->
// evaluate it -> place it into the pattern -> connect clusters -> wrap into
// a seamless repeat. Every cluster is built from the SAME 4 hierarchy
// roles engine/hierarchy.ts and engine/scoring.ts already understand
// (hero/secondary/filler/accent) — no parallel role vocabulary. The
// brief's "supporting leaves" and "decorative overlap" aren't separate
// structural roles here; they're what the overlap-band mechanism below and
// a generator's own shape choice produce for secondary/filler members, not
// a 5th role scoring/collection code would need to learn.

export type ClusterArchetype =
  | 'bouquet'
  | 'cascade'
  | 'radial'
  | 'editorial'
  | 'organicScatter'
  | 'sCurve'
  | 'diagonal'
  | 'asymmetric'
  | 'airy'
  | 'sprayBouquet'
  | 'wildCluster'
  | 'cornerCluster'
  | 'branchCluster';

export const CLUSTER_ARCHETYPES: ClusterArchetype[] = [
  'bouquet', 'cascade', 'radial', 'editorial', 'organicScatter', 'sCurve', 'diagonal', 'asymmetric', 'airy',
  // Build 004, Section 4 (Botanical Cluster Generator): the brief's 9 named
  // cluster types map onto the 9 archetypes above 1:1 (Mini Bouquet=bouquet,
  // Diagonal Cluster=diagonal, Organic Cluster=organicScatter, Asymmetric
  // Cluster=asymmetric, Floating Cluster=airy) except for these 4, which
  // have no existing equivalent and get real, distinct geometry below.
  'sprayBouquet', 'wildCluster', 'cornerCluster', 'branchCluster',
];

/** One motif's position within a cluster, relative to the cluster's own
 * anchor (0,0) — not yet placed into the tile. `overlapsHero` is set by
 * `generateCluster` itself (not re-derived by callers) so evaluation and
 * placement always agree on which members were deliberately pulled into
 * the intentional-overlap band. */
export interface ClusterMember {
  dx: number;
  dy: number;
  rotationDeg: number;
  /** Multiplies the tile's own `effectiveMotifSize` the same way
   * `Placement.scale` already does — hero members get the largest value,
   * accents the smallest, by construction (see ROLE_SCALE_RANGE). */
  scaleMul: number;
  role: MotifRole;
  overlapsHero: boolean;
}

export interface ClusterGenerateOptions {
  /** The cluster's characteristic radius — how far supporting members
   * reach from the hero, in tile units. Callers derive this from
   * `motifSize`/`density` the same way every layout already sizes its own
   * spacing (see `clusterBaseRadius`). */
  baseRadius: number;
  rotationJitter: number;
  scaleJitter: number;
  /** Total non-hero member count. Omitted = a real, archetype-appropriate
   * default range (not a fixed constant — a bouquet reads richer than a
   * minimal asymmetric pairing). */
  memberCount?: number;
  /** Build 003, Part 9 (Rotation Angle Families): the shared set of 2-4
   * "natural" base directions every member's rotation jitters around,
   * instead of each member independently picking a fresh angle anywhere
   * in 0-360 (see `engine/rotationFamilies.ts`). Defaults to a fresh
   * family for this call alone when omitted — pass the *same* family
   * across every cluster in one tile generation (as
   * `buildClusterPlacements` below does) so the whole tile commits to one
   * consistent set of directions rather than each cluster inventing its
   * own. */
  angleFamily?: AngleFamily;
}

// Build 002, Section 4 (Scale Diversity): widened from the original
// (secondary [0.55,0.75], filler [0.3,0.48], accent [0.12,0.24]) — measured
// against the frozen 30-scenario/100-pattern set, `filler` is both the most
// numerous role in every cluster-driven layout (60-70% of instances) and
// the narrowest absolute range, so its instances reliably packed into a
// single bucket of `critic/visualAnalysis.ts`'s 8-bucket scale-repeat
// detector (SCALE_REPEAT_THRESHOLD 0.5) once combined with the hero's own
// much larger scale widening the detector's global min-max span. Widening
// every non-hero role's own band (with deliberate, real overlap between
// adjacent roles — e.g. filler's new ceiling 0.58 sits inside secondary's
// new floor 0.5 — rather than three disjoint narrow slices) spreads each
// role's own instances across roughly 2 buckets instead of 1, while
// preserving real hierarchy (hero remains visibly the largest, accent the
// smallest) since the *medians* of each band stay clearly separated.
const ROLE_SCALE_RANGE: Record<Exclude<MotifRole, 'hero'>, [number, number]> = {
  secondary: [0.52, 0.78],
  filler: [0.28, 0.52],
  accent: [0.11, 0.26],
};

/** Same spacing formula every layout already uses for single-motif
 * placement (`layouts/shared.ts`'s `spacingForDensity`), scaled up the way
 * `bouquet.ts` already established (`* 2.2`) since a cluster's *footprint*
 * needs to be several members wide, not one motif wide. */
export function clusterBaseRadius(motifSize: number, density: number): number {
  return spacingForDensity(motifSize, density) * 1.15;
}

interface RawOffset {
  dx: number;
  dy: number;
  role: Exclude<MotifRole, 'hero'>;
}

/** Per-archetype relative placement of member `i` of `total` around the
 * hero at (0,0). Every formula deliberately avoids equal angular/radial
 * steps (Section 2, "no equal spacing") by jittering both, and every
 * archetype has a real, distinct directional identity (Section 2,
 * "directional flow") rather than being the same scatter with a different
 * name. */
function archetypeOffset(archetype: ClusterArchetype, i: number, total: number, rng: Rng, r: number, sharedAngle?: number): RawOffset {
  const t = total > 1 ? i / (total - 1) : 0.5;
  const roleFor = (frac: number): Exclude<MotifRole, 'hero'> => (frac < 0.22 ? 'secondary' : frac < 0.7 ? 'filler' : 'accent');

  switch (archetype) {
    case 'bouquet': {
      const angle = rngRange(rng, 0, Math.PI * 2);
      const dist = rngRange(rng, r * 0.4, r * 1.05);
      return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, role: roleFor(t) };
    }
    case 'radial': {
      const angle = (i / total) * Math.PI * 2 + rngRange(rng, -0.4, 0.4);
      const dist = rngRange(rng, r * 0.55, r * 1.15);
      return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, role: roleFor(t) };
    }
    case 'cascade': {
      const side = rngInt(rng, 0, 1) === 0 ? -1 : 1;
      const dx = side * rngRange(rng, r * 0.08, r * 0.32) + rngRange(rng, -r * 0.1, r * 0.1);
      const dy = t * r * 1.6 + rngRange(rng, -r * 0.15, r * 0.15) + r * 0.15;
      return { dx, dy, role: roleFor(t) };
    }
    case 'editorial': {
      const dx = t * r * 1.9 + rngRange(rng, r * 0.05, r * 0.25);
      const dy = rngRange(rng, -r * 0.4, r * 0.4);
      return { dx, dy, role: roleFor(t) };
    }
    case 'organicScatter': {
      const angle = rngRange(rng, 0, Math.PI * 2);
      // Elliptical (not circular) reach — an organic silhouette instead of
      // a perfect disc, per Section 2's "organic silhouette" requirement.
      const ellipseX = 1.15;
      const ellipseY = 0.8;
      const dist = rngRange(rng, r * 0.3, r * 1.1);
      return { dx: Math.cos(angle) * dist * ellipseX, dy: Math.sin(angle) * dist * ellipseY, role: roleFor(t) };
    }
    case 'sCurve': {
      const tt = (i + 1) / (total + 1);
      const dx = (tt - 0.5) * r * 2.3 + rngRange(rng, -r * 0.12, r * 0.12);
      const dy = Math.sin(tt * Math.PI * 2) * r * 0.65 + rngRange(rng, -r * 0.12, r * 0.12);
      return { dx, dy, role: roleFor(t) };
    }
    case 'diagonal': {
      const tt = (i + 1) / (total + 1);
      const along = (tt - 0.5) * r * 2.1;
      const perpSign = i % 2 === 0 ? 1 : -1;
      const perp = perpSign * rngRange(rng, r * 0.06, r * 0.22);
      // 45-degree axis.
      return { dx: along + perp * 0.5, dy: along - perp * 0.5, role: roleFor(t) };
    }
    case 'asymmetric': {
      // A small "near" group tucked close to the hero (connective tissue)
      // and a "far" counterweight group pushed to one side, chosen once
      // per member from its own index parity so both groups are always
      // present regardless of member count.
      const isNear = i % 3 !== 0;
      const angleBase = rngRange(rng, -0.6, 0.6);
      if (isNear) {
        const angle = angleBase + Math.PI; // toward the hero's "light" side
        const dist = rngRange(rng, r * 0.25, r * 0.55);
        return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, role: roleFor(t) };
      }
      const angle = angleBase;
      const dist = rngRange(rng, r * 0.8, r * 1.35);
      return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, role: roleFor(t) };
    }
    case 'airy': {
      // Build 002, Section 5 — a genuinely distinct, deliberately sparse
      // archetype: 1-2 members floating far out from the hero (never the
      // tight/dense "supporting company" every other archetype builds),
      // almost all of them accent-weight rather than secondary/filler, and
      // a much wider reach than any other archetype's `r` multiplier. This
      // is what gives `layouts/airy.ts` its own real identity through the
      // Cluster Engine — "a few sprigs floating on a big empty ground",
      // not a renamed bouquet/organicScatter at a smaller radius.
      const angle = rngRange(rng, 0, Math.PI * 2);
      const dist = rngRange(rng, r * 1.1, r * 1.9);
      const role: Exclude<MotifRole, 'hero'> = i === 0 ? 'secondary' : 'accent';
      return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, role };
    }
    case 'sprayBouquet': {
      // Build 004, Section 4: a fan held to one shared side, like flowers
      // gathered and spread in a hand -- distinct from `bouquet`'s
      // full-circle independent angle per member. `sharedAngle` (computed
      // once per cluster in `generateCluster`) anchors the whole fan;
      // distance grows with member index so the fan reads as widening
      // outward rather than a uniform ring.
      const angle = (sharedAngle ?? 0) + rngRange(rng, -0.9, 0.9);
      const dist = r * (0.35 + 0.75 * t) + rngRange(rng, -r * 0.08, r * 0.08);
      return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, role: roleFor(t) };
    }
    case 'wildCluster': {
      // Build 004, Section 4: chaotic scatter with wider distance variance
      // than `organicScatter`, plus an occasional outlier reaching much
      // further out -- a genuinely "wild", less-composed silhouette rather
      // than a controlled ring.
      const angle = rngRange(rng, 0, Math.PI * 2);
      const isOutlier = rngBool(rng, 0.18);
      const dist = isOutlier ? rngRange(rng, r * 1.3, r * 2.1) : rngRange(rng, r * 0.2, r * 1.0);
      return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, role: isOutlier ? 'accent' : roleFor(t) };
    }
    case 'cornerCluster': {
      // Build 004, Section 4: commits to one true 45-degree diagonal
      // direction (toward a tile corner) as its shared angle, chosen once
      // per cluster in `generateCluster` -- genuinely distinct from
      // `sprayBouquet`'s arbitrary shared direction.
      const angle = (sharedAngle ?? 0) + rngRange(rng, -0.35, 0.35);
      const dist = rngRange(rng, r * 0.4, r * 1.25);
      return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, role: roleFor(t) };
    }
    case 'branchCluster': {
      // Build 004, Section 4: members split round-robin into 2-3 diverging
      // directions from one shared base angle, distance increasing along
      // each branch -- foreshadows the real Stem Engine (Section 6) without
      // implementing actual branch geometry yet.
      const branchCount = total >= 6 ? 3 : 2;
      const branchIndex = i % branchCount;
      const branchOffsets = branchCount === 3 ? [-0.55, 0, 0.55] : [-0.4, 0.4];
      const angle = (sharedAngle ?? 0) + branchOffsets[branchIndex] + rngRange(rng, -0.08, 0.08);
      const branchLen = Math.ceil(total / branchCount);
      const along = Math.floor(i / branchCount);
      const tt = branchLen > 1 ? along / (branchLen - 1) : 0.5;
      const dist = r * (0.3 + 1.1 * tt) + rngRange(rng, -r * 0.06, r * 0.06);
      return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, role: roleFor(t) };
    }
  }
}

/** Builds one full cluster: a hero at the anchor plus an archetype-shaped
 * ring of supporting members. A fraction of the closest supporting members
 * are deliberately pulled into the intentional-overlap band (their
 * distance from the hero rescaled to less than the combined hero+member
 * footprint) — Section 5's "controlled overlap", guaranteed structurally
 * rather than left to chance, and Section 2's "no isolated floating
 * objects" (every member's raw distance is bounded by the archetype
 * formula itself, which never produces a member further than ~r*1.35 from
 * the hero). Returned in hero-first paint order: hero, then secondary,
 * filler, accent — so supporting members visually layer *onto* the hero at
 * their overlap points (the real, geometry-level analogue of "leaf over
 * flower" this engine can guarantee without recognizing shape semantics). */
export function generateCluster(archetype: ClusterArchetype, rng: Rng, opts: ClusterGenerateOptions): ClusterMember[] {
  const { baseRadius: r, rotationJitter, scaleJitter } = opts;
  const angleFamily = opts.angleFamily ?? createAngleFamily(rng);
  const defaultCounts: Record<ClusterArchetype, [number, number]> = {
    bouquet: [6, 10],
    radial: [5, 8],
    cascade: [4, 7],
    editorial: [4, 7],
    organicScatter: [5, 9],
    sCurve: [4, 6],
    diagonal: [4, 6],
    asymmetric: [4, 7],
    airy: [1, 2],
    sprayBouquet: [5, 8],
    wildCluster: [5, 9],
    cornerCluster: [4, 7],
    branchCluster: [5, 8],
  };
  const [lo, hi] = defaultCounts[archetype];
  const total = opts.memberCount ?? rngInt(rng, lo, hi);

  const hero: ClusterMember = {
    dx: 0,
    dy: 0,
    rotationDeg: jitter(rng, 0, rotationJitter),
    scaleMul: 1 + rngRange(rng, -scaleJitter * 0.3, scaleJitter * 0.3),
    role: 'hero',
    overlapsHero: false,
  };

  // Build 004, Section 4: `sprayBouquet`/`cornerCluster`/`branchCluster` each
  // need ONE shared direction for the whole cluster (a fan, a corner-biased
  // diagonal, a branch base angle) rather than each member picking its own.
  // This extra rng() draw is conditional -- only these 3 new archetypes
  // consume it -- so every existing archetype's rng-consumption sequence
  // (and therefore its determinism/existing tests) stays unchanged.
  const sharedAngle =
    archetype === 'cornerCluster'
      ? ([Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4] as const)[rngInt(rng, 0, 3)]
      : archetype === 'sprayBouquet' || archetype === 'branchCluster'
        ? rngRange(rng, 0, Math.PI * 2)
        : undefined;

  const raw: RawOffset[] = [];
  for (let i = 0; i < total; i++) raw.push(archetypeOffset(archetype, i, total, rng, r, sharedAngle));

  // Pull ~30% of members (at least 1) into the deliberate overlap band —
  // rescale the same direction vector to a shorter magnitude rather than
  // picking a new random spot, so the archetype's own directional identity
  // is preserved even for the overlapping members. `airy`'s whole identity
  // is deliberate *non*-overlap (generous negative space, "a few sprigs
  // floating"), so it's the one archetype this forced band never applies to.
  const overlapBandFrac = r * 0.42;
  const overlapCount = archetype === 'airy' ? 0 : Math.max(1, Math.round(total * 0.3));
  const overlapIndices = new Set<number>();
  while (overlapIndices.size < Math.min(overlapCount, total)) {
    overlapIndices.add(rngInt(rng, 0, total - 1));
  }

  const members: ClusterMember[] = raw.map((o, i) => {
    const dist = Math.hypot(o.dx, o.dy) || 1;
    const overlapsHero = overlapIndices.has(i);
    const mag = overlapsHero ? rngRange(rng, overlapBandFrac * 0.35, overlapBandFrac) : dist;
    const ux = o.dx / dist;
    const uy = o.dy / dist;
    const [sLo, sHi] = ROLE_SCALE_RANGE[o.role];
    return {
      dx: ux * mag,
      dy: uy * mag,
      rotationDeg: pickFamilyAngle(rng, angleFamily, rotationJitter),
      scaleMul: rngRange(rng, sLo, sHi) * (1 + rngRange(rng, -scaleJitter, scaleJitter)),
      role: o.role,
      overlapsHero,
    };
  });

  // Hero-first paint order, then secondary/filler/accent (already
  // generated in that rough role progression by `roleFor`, but sort
  // explicitly since asymmetric/cascade interleave index and role).
  const roleOrder: Record<MotifRole, number> = { hero: 0, secondary: 1, filler: 2, accent: 3 };
  members.sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);
  return [hero, ...members];
}

export interface ClusterEvaluation {
  /** 0-100 — how well the cluster reads as one deliberate grouping rather
   * than scattered independent objects: penalizes isolated members (too
   * far from the hero) and, separately, perfectly-uniform member spacing
   * (mechanical, not organic). */
  cohesion: number;
  hasOverlap: boolean;
  /** 0-100 — angular-spread evenness of non-overlapping members around the
   * hero; a real organic cluster covers a broad angular range without
   * being perfectly evenly divided (see `archetypeOffset`'s jittering). */
  organicSilhouette: number;
  isolatedMemberCount: number;
}

/** Real, measurable evaluation of a cluster's own relative geometry (no
 * tile placement involved yet) — Section 2's design rules made checkable,
 * and the gate `buildClusterPlacements`'s internal retry loop (Section 9,
 * "Improve cluster") uses to keep the best of a few attempts. */
export function evaluateCluster(members: ClusterMember[], baseRadius: number): ClusterEvaluation {
  const hero = members.find((m) => m.role === 'hero');
  const others = members.filter((m) => m.role !== 'hero');
  if (!hero || others.length === 0) {
    return { cohesion: 100, hasOverlap: false, organicSilhouette: 100, isolatedMemberCount: 0 };
  }
  const dists = others.map((m) => Math.hypot(m.dx - hero.dx, m.dy - hero.dy));
  const maxCohesionDist = baseRadius * 1.6;
  const isolatedMemberCount = dists.filter((d) => d > maxCohesionDist).length;
  const meanDist = dists.reduce((a, b) => a + b, 0) / dists.length;
  const variance = dists.reduce((a, d) => a + (d - meanDist) ** 2, 0) / dists.length;
  const coeffVar = meanDist > 0 ? Math.sqrt(variance) / meanDist : 0;
  const hasOverlap = others.some((m) => m.overlapsHero) || dists.some((d) => d < baseRadius * 0.45);

  let cohesion = 100;
  cohesion -= isolatedMemberCount * 20;
  if (coeffVar < 0.08) cohesion -= 25; // suspiciously uniform spacing = mechanical
  if (!hasOverlap) cohesion -= 15;
  cohesion = Math.max(0, Math.min(100, cohesion));

  const angles = others.map((m) => Math.atan2(m.dy - hero.dy, m.dx - hero.dx));
  const sorted = [...angles].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const next = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + Math.PI * 2;
    gaps.push(next - sorted[i]);
  }
  const meanGap = (Math.PI * 2) / gaps.length;
  const gapVariance = gaps.reduce((a, g) => a + (g - meanGap) ** 2, 0) / gaps.length;
  // Real organic coverage: some variance is expected and good (not a
  // perfect equal-angle fan), but an extreme concentration into one narrow
  // arc (everything piled on one side, nothing organic about it) still
  // reads poorly, so very high variance is penalized too.
  const gapCoeffVar = meanGap > 0 ? Math.sqrt(gapVariance) / meanGap : 0;
  const organicSilhouette = Math.max(0, Math.min(100, 100 - Math.abs(gapCoeffVar - 0.5) * 90));

  return { cohesion, hasOverlap, organicSilhouette, isolatedMemberCount };
}

export interface ClusterAnchor {
  x: number;
  y: number;
  sizeMul: number;
}

/** Alternating large/medium/small cluster-size rhythm (Section 7) — a
 * fixed, deliberately non-monotonic 4-step cycle (never two equal steps in
 * a row) with a randomized starting offset and small per-instance jitter,
 * so the *sequence* is varied but still deterministic for a given seed. */
const SIZE_RHYTHM = [1.35, 0.82, 1.05, 0.62];

/** Build 003, Part 1/6 (Composition Zone Engine): placement of cluster
 * anchors across the tile now follows one named composition zone (a real
 * skeleton — diagonal band, sine wave, golden-ratio spiral, ...) instead
 * of plain uniform Poisson-disc scatter — see `engine/compositionZones.ts`.
 * `zone` defaults to a random pick so every existing caller that doesn't
 * care which zone still gets one (and gets a real one, not "no zone");
 * pass it explicitly when a caller (a Style DNA preset's zone preference,
 * or a portfolio-variety tracker) wants control. Anchor spacing still
 * varies per anchor via the size rhythm below (Section 2's "no equal
 * spacing", Section 6's "avoid mechanical distribution") — the zone
 * governs *where* anchors concentrate, not their individual spacing rule. */
/** Same minDist multiplier `placeZoneAnchors` was called with below (average
 * size-based) and `resolveClusterCollisions` is called with after (real
 * per-anchor size-based) — kept as one constant so the two stay in sync. */
const ANCHOR_MIN_DIST_MUL = 1.7;

export function placeClusterAnchors(tileSize: number, baseRadius: number, rng: Rng, zone?: CompositionZone): ClusterAnchor[] {
  const chosenZone = zone ?? rngPick(rng, COMPOSITION_ZONES);
  const avgSizeMul = SIZE_RHYTHM.reduce((a, b) => a + b, 0) / SIZE_RHYTHM.length;
  const minDist = baseRadius * avgSizeMul * ANCHOR_MIN_DIST_MUL;
  const targetCount = Math.max(2, Math.round((tileSize * tileSize) / (minDist * minDist)));
  const points = placeZoneAnchors(chosenZone, tileSize, minDist, targetCount, rng);
  const startOffset = rngInt(rng, 0, SIZE_RHYTHM.length - 1);
  const anchors = points.map(([x, y], i) => {
    const sizeMul = SIZE_RHYTHM[(i + startOffset) % SIZE_RHYTHM.length] * (1 + rngRange(rng, -0.08, 0.08));
    return { x, y, sizeMul };
  });
  // Build 003, Part 10 (Cluster Avoidance): the average-based minDist above
  // only guarantees spacing for the *typical* anchor — two anchors that
  // happen to land near each other and both draw the size rhythm's largest
  // step can still end up too close for their real size, reading as two
  // hero motifs visually touching. This resolves those specific pairs
  // without disturbing anchors that were already spaced correctly.
  return resolveClusterCollisions(anchors, baseRadius, ANCHOR_MIN_DIST_MUL, tileSize);
}

/** Small, sparse bridging accents placed at the midpoint between cluster
 * anchor pairs close enough to read as neighbors — Section 1's explicit
 * "Connect Clusters" workflow step: without this, clusters read as
 * isolated islands even when each one individually is well-composed. Only
 * fires for genuinely nearby pairs (never every pair — that would clutter
 * the negative space Section 6 asks the engine to preserve) and only
 * sometimes even then, so it reads as an occasional connective touch, not
 * a rule applied everywhere. */
export function connectClusters(anchors: ClusterAnchor[], tileSize: number, baseRadius: number, rng: Rng): Placement[] {
  const threshold = baseRadius * 2.4;
  const bridges: Placement[] = [];
  for (let i = 0; i < anchors.length; i++) {
    for (let j = i + 1; j < anchors.length; j++) {
      const a = anchors[i];
      const b = anchors[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      // Wrap-aware: a pair can be nearer through the tile seam.
      if (Math.abs(dx) > tileSize / 2) dx -= Math.sign(dx) * tileSize;
      if (Math.abs(dy) > tileSize / 2) dy -= Math.sign(dy) * tileSize;
      const dist = Math.hypot(dx, dy);
      if (dist > threshold || dist < baseRadius * 0.5) continue;
      if (rng() > 0.35) continue; // occasional, not universal
      const mx = wrapCoord(a.x + dx * 0.5 + rngRange(rng, -baseRadius * 0.1, baseRadius * 0.1), tileSize);
      const my = wrapCoord(a.y + dy * 0.5 + rngRange(rng, -baseRadius * 0.1, baseRadius * 0.1), tileSize);
      bridges.push({
        x: mx,
        y: my,
        rotationDeg: rngRange(rng, 0, 360),
        scale: rngRange(rng, 0.14, 0.24),
        colorSeed: 0,
        role: 'accent',
      });
    }
  }
  return bridges;
}

export interface BuildClusterPlacementsOptions {
  tileSize: number;
  motifSize: number;
  density: number;
  rotationJitter: number;
  scaleJitter: number;
  /** One archetype, or several cycled deterministically across clusters —
   * a real pattern generally commits to one dominant composition strategy
   * (mixing all 8 archetypes within a single tile would itself read as
   * mechanical/incoherent), so callers typically pass a 1-2 element pool. */
  archetypes: ClusterArchetype[];
  /** Internal "Improve cluster" retries (Section 9) per cluster before
   * accepting whichever attempt scored highest on `evaluateCluster`. */
  maxAttemptsPerCluster?: number;
  /** Minimum acceptable cohesion — attempts stop early once reached. */
  cohesionTarget?: number;
  /** Build 003: the composition zone anchor placement should follow —
   * defaults to a random pick (see `placeClusterAnchors`) when omitted. */
  zone?: CompositionZone;
  /** Build 003, Part 9: the shared rotation angle family every cluster in
   * this tile should use — defaults to one fresh family for the whole
   * call (shared across every anchor) when omitted. */
  angleFamily?: AngleFamily;
}

/** Top-level assembly: places cluster anchors across the tile, generates
 * (with an internal quality-gated retry loop) and evaluates one cluster
 * per anchor, connects nearby clusters, and returns the final flattened,
 * paint-ordered `Placement[]` — a drop-in replacement for what a layout's
 * `generate()` used to build directly. */
export function buildClusterPlacements(opts: BuildClusterPlacementsOptions, rng: Rng): Placement[] {
  const { tileSize, motifSize, density, rotationJitter, scaleJitter, archetypes } = opts;
  const maxAttempts = opts.maxAttemptsPerCluster ?? 3;
  const cohesionTarget = opts.cohesionTarget ?? 70;
  const baseRadius = clusterBaseRadius(motifSize, density);
  const anchors = placeClusterAnchors(tileSize, baseRadius, rng, opts.zone);
  const angleFamily = opts.angleFamily ?? createAngleFamily(rng);

  const placements: Placement[] = [];
  let colorSeed = 0;

  anchors.forEach((anchor, anchorIndex) => {
    const archetype = archetypes[anchorIndex % archetypes.length];
    let best: ClusterMember[] | null = null;
    let bestCohesion = -1;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const candidate = generateCluster(archetype, rng, {
        baseRadius: baseRadius * anchor.sizeMul,
        rotationJitter,
        scaleJitter,
        angleFamily,
      });
      const { cohesion } = evaluateCluster(candidate, baseRadius * anchor.sizeMul);
      if (cohesion > bestCohesion) {
        best = candidate;
        bestCohesion = cohesion;
      }
      if (cohesion >= cohesionTarget) break;
    }
    for (const member of best!) {
      placements.push({
        x: wrapCoord(anchor.x + member.dx, tileSize),
        y: wrapCoord(anchor.y + member.dy, tileSize),
        rotationDeg: member.rotationDeg,
        scale: Math.max(0.08, member.scaleMul),
        colorSeed: colorSeed++,
        role: member.role,
      });
    }
  });

  const bridges = connectClusters(anchors, tileSize, baseRadius, rng);
  for (const b of bridges) placements.push({ ...b, colorSeed: colorSeed++ });

  return placements;
}

/** Convenience: deterministically pick an archetype pool for a layout that
 * wants "a real composition, not all 8 mixed" — one dominant archetype,
 * chosen from `rng`, kept for the whole tile. */
export function pickArchetypePool(rng: Rng, candidates: ClusterArchetype[] = CLUSTER_ARCHETYPES): ClusterArchetype[] {
  return [rngPick(rng, candidates)];
}

/** Build 003: deterministically pick one composition zone (see
 * `engine/compositionZones.ts`) — the same "commit to one, don't blend
 * everything" convention `pickArchetypePool` already established for
 * cluster archetypes, applied one level up at the whole-tile skeleton. A
 * caller (Style DNA zone preferences, portfolio-variety tracking) can
 * narrow `candidates`; a plain layout can just call this with no
 * arguments and get a real, randomly-committed zone. */
export function pickCompositionZone(rng: Rng, candidates: CompositionZone[] = COMPOSITION_ZONES): CompositionZone {
  return rngPick(rng, candidates);
}

export { COMPOSITION_ZONES } from './compositionZones';

// Build 004, Section 6 (Stem Engine): the brief's "generate stems before
// flowers... avoid floating flowers" applies at two levels this codebase
// already separates -- a single motif's own internal stem (generators/
// growth.ts's `generateStem`, unchanged here) and the CLUSTER's implicit
// connective structure (a hero and its supporting members currently only
// have relative dx/dy offsets, with no shared stem geometry drawn between
// them). This section adds the latter: real, distinct connective stem
// geometry spanning a cluster's members, reusing the same Catmull-Rom
// smoothing (`curveEngine.ts`'s `smoothPathD`) the per-motif stem engine
// already relies on for curve quality. Not yet wired into the tile
// rendering pipeline (`tile.ts` only knows about flat `Placement[]`, not
// clusters, so painting these stems as a visible layer is a rendering-
// pipeline change of its own) -- Section 8 (Premium Hero Builder, which
// explicitly needs a hero's own "Stem" as one of its assembled parts) is
// the natural place that consumes this.

export type StemTopology = 'straight' | 'arc' | 'sCurve' | 'ySplit' | 'branching' | 'organicCurve' | 'doubleBranch';

export interface ClusterStemBranch {
  path: string;
  /** Index into the cluster's own non-hero members (i.e. `members.slice(1)`
   * passed to `buildClusterStem`) that this branch terminates at. */
  targetIndex: number;
}

export interface ClusterStem {
  topology: StemTopology;
  branches: ClusterStemBranch[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pathFromPoints(points: Pt[]): string {
  return smoothPathD(
    points.map((p) => ({ x: round2(p.x), y: round2(p.y) })),
    { closed: false, tension: 6 },
  );
}

/** A single hero->target stem with one of 4 simple, non-branching profiles.
 * `target` is relative to the hero (which `generateCluster` always places at
 * (0,0), so callers pass member `{dx, dy}` directly). */
function singleStemPoints(target: Pt, style: 'straight' | 'arc' | 'sCurve' | 'organicCurve', rng: Rng): Pt[] {
  if (style === 'straight') return [{ x: 0, y: 0 }, target];
  const dist = Math.hypot(target.x, target.y) || 1;
  const nx = -target.y / dist;
  const ny = target.x / dist;
  if (style === 'arc') {
    const bend = dist * rngRange(rng, 0.08, 0.16);
    return [{ x: 0, y: 0 }, { x: target.x * 0.5 + nx * bend, y: target.y * 0.5 + ny * bend }, target];
  }
  if (style === 'sCurve') {
    const bend = dist * rngRange(rng, 0.1, 0.18);
    return [
      { x: 0, y: 0 },
      { x: target.x * 0.33 + nx * bend, y: target.y * 0.33 + ny * bend },
      { x: target.x * 0.66 - nx * bend, y: target.y * 0.66 - ny * bend },
      target,
    ];
  }
  // organicCurve: a single looser, asymmetric bend (larger and less
  // predictable than `arc`'s), the "Organic Curve" the brief names
  // separately from a plain `arc`.
  const bend = dist * rngRange(rng, 0.14, 0.28);
  const along = rngRange(rng, 0.35, 0.65);
  return [
    { x: 0, y: 0 },
    { x: target.x * along + nx * bend + rngRange(rng, -dist * 0.03, dist * 0.03), y: target.y * along + ny * bend + rngRange(rng, -dist * 0.03, dist * 0.03) },
    target,
  ];
}

interface RawStemBranch {
  points: Pt[];
  targetIndex: number;
}

/** Members ranked by distance from the hero (closest first) -- "attach
 * naturally" means connecting to the members already sitting nearest the
 * hero, not an arbitrary or furthest-first selection. */
function rankByDistanceFromHero(others: ClusterMember[]): Array<{ idx: number; dist: number }> {
  return others.map((m, idx) => ({ idx, dist: Math.hypot(m.dx, m.dy) })).sort((a, b) => a.dist - b.dist);
}

function buildSimpleStem(rng: Rng, others: ClusterMember[], style: 'straight' | 'arc' | 'sCurve' | 'organicCurve', maxBranches: number): RawStemBranch[] {
  const ranked = rankByDistanceFromHero(others);
  const chosen = ranked.slice(0, Math.max(1, Math.min(maxBranches, ranked.length)));
  return chosen.map(({ idx }) => ({
    points: singleStemPoints({ x: others[idx].dx, y: others[idx].dy }, style, rng),
    targetIndex: idx,
  }));
}

/** Y Split: a single trunk that splits into exactly 2 branches at one
 * shared point roughly halfway out -- both branches pass through that same
 * point before diverging toward their own target. */
function buildYSplit(rng: Rng, others: ClusterMember[]): RawStemBranch[] {
  const ranked = rankByDistanceFromHero(others);
  const chosen = ranked.slice(0, Math.min(2, ranked.length));
  if (chosen.length < 2) return buildSimpleStem(rng, others, 'arc', 1);
  const targets = chosen.map(({ idx }) => others[idx]);
  const splitFrac = rngRange(rng, 0.45, 0.6);
  const splitPoint: Pt = {
    x: ((targets[0].dx + targets[1].dx) / 2) * splitFrac,
    y: ((targets[0].dy + targets[1].dy) / 2) * splitFrac,
  };
  return chosen.map(({ idx }, i) => ({
    points: [{ x: 0, y: 0 }, splitPoint, { x: targets[i].dx, y: targets[i].dy }],
    targetIndex: idx,
  }));
}

/** Branching: 3+ branches peeling off a shared trunk at staggered points
 * (each branch splits further out than the last) -- a real branching
 * silhouette, distinct from `ySplit`'s single shared split point for
 * exactly 2 branches. */
function buildBranching(rng: Rng, others: ClusterMember[]): RawStemBranch[] {
  const ranked = rankByDistanceFromHero(others);
  const chosen = ranked.slice(0, Math.min(3, ranked.length));
  if (chosen.length === 0) return [];
  return chosen.map(({ idx }, i) => {
    const target = others[idx];
    const splitFrac = 0.3 + (i / Math.max(1, chosen.length - 1)) * 0.35 + rngRange(rng, -0.05, 0.05);
    const splitPoint: Pt = { x: target.dx * splitFrac, y: target.dy * splitFrac };
    return { points: [{ x: 0, y: 0 }, splitPoint, { x: target.dx, y: target.dy }], targetIndex: idx };
  });
}

/** Double Branch: 2 branches that stay on OPPOSITE sides of the direct
 * hero->target line (bowing apart from each other), rather than sharing one
 * convergent split point the way `ySplit` does -- two stems growing
 * side by side, not a fork from a single point. */
function buildDoubleBranch(rng: Rng, others: ClusterMember[]): RawStemBranch[] {
  const ranked = rankByDistanceFromHero(others);
  const chosen = ranked.slice(0, Math.min(2, ranked.length));
  if (chosen.length < 2) return buildSimpleStem(rng, others, 'arc', 1);
  const targets = chosen.map(({ idx }) => others[idx]);
  const avgAngle = Math.atan2((targets[0].dy + targets[1].dy) / 2, (targets[0].dx + targets[1].dx) / 2);
  const perp: Pt = { x: -Math.sin(avgAngle), y: Math.cos(avgAngle) };
  const refDist = Math.hypot(targets[0].dx, targets[0].dy) || 1;
  const offset = refDist * rngRange(rng, 0.06, 0.12);
  return chosen.map(({ idx }, i) => {
    const side = i === 0 ? 1 : -1;
    const target = targets[i];
    const mid: Pt = { x: target.dx * 0.5 + perp.x * offset * side, y: target.dy * 0.5 + perp.y * offset * side };
    return { points: [{ x: 0, y: 0 }, mid, { x: target.dx, y: target.dy }], targetIndex: idx };
  });
}

/** Builds real connective stem geometry for a cluster's members (see the
 * module note above on why this isn't yet wired into tile rendering).
 * `members` is the full array `generateCluster` returns (hero first, at
 * (0,0)); every topology connects the hero to a small, distance-ranked
 * subset of its supporting members rather than every single one, matching
 * the brief's own "avoid unnecessary overlap"/"avoid excessive DOM growth"
 * rendering requirements. */
export function buildClusterStem(rng: Rng, members: ClusterMember[], topology: StemTopology): ClusterStem {
  const others = members.slice(1);
  if (others.length === 0) return { topology, branches: [] };
  let raw: RawStemBranch[];
  switch (topology) {
    case 'straight':
      raw = buildSimpleStem(rng, others, 'straight', 1);
      break;
    case 'arc':
      raw = buildSimpleStem(rng, others, 'arc', 1);
      break;
    case 'sCurve':
      raw = buildSimpleStem(rng, others, 'sCurve', 1);
      break;
    case 'organicCurve':
      raw = buildSimpleStem(rng, others, 'organicCurve', 2);
      break;
    case 'ySplit':
      raw = buildYSplit(rng, others);
      break;
    case 'branching':
      raw = buildBranching(rng, others);
      break;
    case 'doubleBranch':
      raw = buildDoubleBranch(rng, others);
      break;
  }
  return { topology, branches: raw.map(({ points, targetIndex }) => ({ path: pathFromPoints(points), targetIndex })) };
}

export const __clusterStemTestables = { singleStemPoints, buildYSplit, buildBranching, buildDoubleBranch, rankByDistanceFromHero };
export type { CompositionZone } from './compositionZones';
