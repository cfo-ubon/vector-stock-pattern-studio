import type { Placement, Rng } from './types';
import type { MotifRole } from './hierarchy';
import { jitter, rngRange, rngInt, rngPick } from './rng';
import { spacingForDensity, poissonDiscPoints, wrapCoord } from '../layouts/shared';

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
  | 'asymmetric';

export const CLUSTER_ARCHETYPES: ClusterArchetype[] = [
  'bouquet', 'cascade', 'radial', 'editorial', 'organicScatter', 'sCurve', 'diagonal', 'asymmetric',
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
}

const ROLE_SCALE_RANGE: Record<Exclude<MotifRole, 'hero'>, [number, number]> = {
  secondary: [0.55, 0.75],
  filler: [0.3, 0.48],
  accent: [0.12, 0.24],
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
function archetypeOffset(archetype: ClusterArchetype, i: number, total: number, rng: Rng, r: number): RawOffset {
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
  const defaultCounts: Record<ClusterArchetype, [number, number]> = {
    bouquet: [6, 10],
    radial: [5, 8],
    cascade: [4, 7],
    editorial: [4, 7],
    organicScatter: [5, 9],
    sCurve: [4, 6],
    diagonal: [4, 6],
    asymmetric: [4, 7],
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

  const raw: RawOffset[] = [];
  for (let i = 0; i < total; i++) raw.push(archetypeOffset(archetype, i, total, rng, r));

  // Pull ~30% of members (at least 1) into the deliberate overlap band —
  // rescale the same direction vector to a shorter magnitude rather than
  // picking a new random spot, so the archetype's own directional identity
  // is preserved even for the overlapping members.
  const overlapBandFrac = r * 0.42;
  const overlapCount = Math.max(1, Math.round(total * 0.3));
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
      rotationDeg: jitter(rng, rngRange(rng, 0, 360), rotationJitter),
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

/** Organic, non-grid placement of cluster anchors across the tile —
 * reuses the same wrap-aware Poisson-disc sampler every other layout
 * already relies on for "N points, no two closer than minDist" (Section
 * 6's breathing room), with minDist itself varying per anchor via the size
 * rhythm above so anchor spacing is never uniform (Section 2's "no equal
 * spacing", Section 6's "avoid mechanical distribution"). */
export function placeClusterAnchors(tileSize: number, baseRadius: number, rng: Rng): ClusterAnchor[] {
  const avgSizeMul = SIZE_RHYTHM.reduce((a, b) => a + b, 0) / SIZE_RHYTHM.length;
  const minDist = baseRadius * avgSizeMul * 1.7;
  const targetCount = Math.max(2, Math.round((tileSize * tileSize) / (minDist * minDist)));
  const points = poissonDiscPoints(tileSize, minDist, targetCount, rng);
  const startOffset = rngInt(rng, 0, SIZE_RHYTHM.length - 1);
  return points.map(([x, y], i) => {
    const sizeMul = SIZE_RHYTHM[(i + startOffset) % SIZE_RHYTHM.length] * (1 + rngRange(rng, -0.08, 0.08));
    return { x, y, sizeMul };
  });
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
  const anchors = placeClusterAnchors(tileSize, baseRadius, rng);

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
