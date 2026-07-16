import type { Placement, Rng } from './types';
import { rngRange, rngInt } from './rng';

export type MotifRole = 'hero' | 'secondary' | 'filler' | 'accent';

/** Visual hierarchy controls: what proportion of placements become each
 * role, and how much each role's own scale gets multiplied. Unlike the
 * ad-hoc hero/filler tiering baked into 4 individual layout files
 * (heroFlow, heroScatter, bouquet, densePremium — which already satisfy
 * "hierarchy" on their own and are skipped by applyHierarchy below to
 * avoid double-compounding), this is a layout-agnostic post-process pass
 * that gives every OTHER layout (grid, scatter, half-drop, s-curve, airy,
 * toss, ...) the same explicit, user-controllable hero/secondary/filler/
 * accent tiering for the first time. */
export interface HierarchyParams {
  heroRatio: number;
  secondaryRatio: number;
  fillerRatio: number;
  accentRatio: number;
  heroScale: number;
  secondaryScale: number;
  fillerScale: number;
  accentScale: number;
  /** Build 009, Section 1 (Visual Hierarchy Engine V2): the brief's
   * 5-tier ask (primary hero / secondary hero / supporting / filler /
   * micro details) doesn't get a new `MotifRole` value -- that enum is
   * read by `ClusterMember` roles, Pattern Physics importance, paint
   * order, and per-role scale bands across dozens of call sites, far too
   * large a blast radius for one build. Instead, a real second focal
   * point is created WITHIN the existing 'secondary' tier: the single
   * largest-scaled 'secondary' placement per tile gets boosted toward a
   * band between 'secondary' and 'hero' (see `promoteSecondaryHero`) --
   * genuinely intentional visual weight, not a new taxonomy value.
   * `undefined`/`0` (every `HIERARCHY_PRESETS` entry, every pre-Build-009
   * saved pattern) is a strict no-op, reproducing prior output exactly. */
  secondaryHeroBoost?: number;
  /** Build 010, Section 5 (Premium Rhythm Engine): the audit found
   * `engine/clusterEngine.ts`'s `SIZE_RHYTHM` already gives cluster
   * anchors a real, deliberate non-monotonic large/medium/small alternating
   * sequence (not pure randomness) — but that reach stops at cluster-based
   * layouts. Non-clustered layouts (grid/scatter/toss/halfDrop) only ever
   * got a genuinely random +/-22% wobble per instance. `true` applies the
   * exact same "fixed non-monotonic cycle + randomized per-role start
   * offset + small residual jitter" idiom here too (see
   * `PREMIUM_RHYTHM_STEPS`), so each role's own instances read as a
   * deliberate rhythm rather than statistical noise. Undefined/false is a
   * strict no-op — every pre-Build-010 pattern (and every `HIERARCHY_PRESETS`
   * entry, none of which set this) reproduces the exact prior random wobble. */
  premiumRhythm?: boolean;
}

export const DEFAULT_HIERARCHY: HierarchyParams = {
  heroRatio: 0.12,
  secondaryRatio: 0.38,
  fillerRatio: 0.35,
  accentRatio: 0.15,
  heroScale: 1.6,
  secondaryScale: 1.0,
  fillerScale: 0.55,
  accentScale: 0.25,
};

export const HIERARCHY_PRESETS: Record<string, { label: string; value: HierarchyParams }> = {
  heroFocus: {
    label: 'Hero Focus',
    value: { heroRatio: 0.3, secondaryRatio: 0.35, fillerRatio: 0.25, accentRatio: 0.1, heroScale: 2.4, secondaryScale: 1.1, fillerScale: 0.5, accentScale: 0.2 },
  },
  balancedEditorial: { label: 'Balanced Editorial', value: DEFAULT_HIERARCHY },
  denseLayered: {
    label: 'Dense Layered',
    value: { heroRatio: 0.08, secondaryRatio: 0.32, fillerRatio: 0.45, accentRatio: 0.15, heroScale: 1.8, secondaryScale: 1.0, fillerScale: 0.6, accentScale: 0.3 },
  },
  airyPremium: {
    label: 'Airy Premium',
    value: { heroRatio: 0.06, secondaryRatio: 0.24, fillerRatio: 0.5, accentRatio: 0.2, heroScale: 2.0, secondaryScale: 0.9, fillerScale: 0.4, accentScale: 0.15 },
  },
  ditsyFloral: {
    label: 'Ditsy Floral',
    value: { heroRatio: 0.03, secondaryRatio: 0.17, fillerRatio: 0.55, accentRatio: 0.25, heroScale: 1.5, secondaryScale: 0.8, fillerScale: 0.35, accentScale: 0.15 },
  },
  allOverTextile: {
    label: 'All-over Textile',
    value: { heroRatio: 0.05, secondaryRatio: 0.55, fillerRatio: 0.3, accentRatio: 0.1, heroScale: 1.3, secondaryScale: 1.0, fillerScale: 0.65, accentScale: 0.3 },
  },
  minimalRepeat: {
    label: 'Minimal Repeat',
    value: { heroRatio: 0.02, secondaryRatio: 0.7, fillerRatio: 0.2, accentRatio: 0.08, heroScale: 1.2, secondaryScale: 1.0, fillerScale: 0.7, accentScale: 0.35 },
  },
};

/** Layouts that already build their own explicit hero/secondary/filler
 * tiers internally — applying the generic hierarchy pass on top would
 * multiply an already-large hero by heroScale again (double-compounding),
 * distorting the hand-tuned composition instead of improving it.
 *
 * Build 002, Section 4 (Scale Diversity): `scatter` and `toss` were missing
 * from this set despite routing through the exact same real per-role
 * `engine/clusterEngine.ts` scale assignment (`ROLE_SCALE_RANGE`) as
 * `bouquet`/`densePremium` (all four call `buildClusterPlacements`) — the
 * real, measured root cause of this section's repeatedScale flag rate
 * (56-80% for scatter/toss specifically): applyHierarchy was re-assigning a
 * FRESH random role and re-multiplying the cluster engine's already-small
 * accent/filler scale by its own accentScale/fillerScale a second time,
 * compounding two independent "make it smaller" factors until the result
 * clamped at the 0.05 floor for a large fraction of instances — a real,
 * measured pile-up in the scale-repeat detector's lowest bucket, not
 * something a wider per-instance wobble alone could fix.
 *
 * Build 002, Section 5 (Semantic Cluster Engine coverage): `radial`,
 * `sCurve`, and `airy` join this set for the same reason — they now build
 * their own real per-member cluster roles/scale directly (see each
 * layout's own doc comment), so the generic pass would double-assign. */
export const HIERARCHY_EXEMPT_LAYOUTS = new Set([
  'heroFlow', 'heroScatter', 'bouquet', 'densePremium', 'scatter', 'toss', 'radial', 'sCurve', 'airy',
]);

/** Layouts whose entire visual identity IS a strict, evenly-spaced lattice
 * or band structure — `grid`/`gridMinimal` are the pair
 * `critic/artDirection.ts`'s `isStrictGridLayout` already treats as "strict
 * grid"; `halfDrop`/`brick` (offset-row masonry lattices) and `stripe`
 * (banded repeat) were added after an empirical before/after comparison
 * (Build 001) found the identical problem measurably hurting them too —
 * their baseline `flowCoherence` sits near the ceiling (85-94/100, vs.
 * 64-80 for organic/cluster layouts) precisely because a fully regular
 * lattice's nearest-neighbor chain is, by construction, about as
 * directionally consistent as a chain can be; Composition Intelligence
 * V2's flow-bias/negative-space/attraction passes measurably eroded that
 * (-22 to -28 points for brick/halfDrop, -3 to -6 for stripe) rather than
 * improving it. Composition Intelligence V2's passes exist to make organic
 * or scattered compositions read as more intentional, but for every layout
 * in this set the "flaw" they'd be correcting (even spacing, axis/band
 * alignment) is the deliberate point of the layout. `engine/tile.ts`
 * strips just the V2 fields for these layouts before running Composition
 * Intelligence — balance correction and rhythm smoothing (V1) still apply
 * exactly as before, since neither ever fired on a genuinely regular
 * layout anyway (both only correct *severe* imbalance/outliers, never an
 * intentionally uniform one). */
export const REGULAR_LATTICE_LAYOUTS = new Set(['grid', 'gridMinimal', 'halfDrop', 'brick', 'stripe']);

/** Composition Intelligence Foundation V2, Section 2/3 — "Importance" and
 * "Layer Priority" formalized as one shared ranking, rather than each
 * consumer hand-rolling its own hero > secondary > filler > accent order.
 * `engine/patternPhysics.ts`'s attraction pass reads `ROLE_IMPORTANCE` to
 * decide which role pulls which; `sortByLayerPriority` below reads
 * `ROLE_LAYER_PRIORITY` for paint order. The brief's other two dimensions
 * aren't duplicated here because they're already real: "Scale" is
 * `HierarchyParams`'s own `*Scale` fields above, "Density" is its `*Ratio`
 * fields, and "Detail" is `engine/heroComplexity.ts`'s per-role overlay
 * (hero/secondary get one, filler/accent don't). */
export const ROLE_IMPORTANCE: Record<MotifRole, number> = { hero: 100, secondary: 65, filler: 35, accent: 15 };
export const ROLE_LAYER_PRIORITY: Record<MotifRole, number> = { hero: 3, secondary: 2, filler: 1, accent: 0 };

/** Stable-sorts placements so higher layer-priority roles (hero) paint last
 * — i.e. on top. Before this pass existed, a layout+hierarchy combination
 * could (and did) leave a hero motif buried under a later-drawn secondary/
 * filler motif at an overlap point, undercutting the exact prominence the
 * Hierarchy Engine's own heroScale is meant to create — this is Section 2's
 * "Layer Priority" made real. Placements with no role (every pattern that
 * never opted into the Hierarchy Engine) all share priority 0, so a stable
 * sort leaves their relative order completely unchanged — a strict no-op
 * for every pre-existing saved pattern that predates hierarchy. */
export function sortByLayerPriority(placements: Placement[]): Placement[] {
  return placements
    .map((p, i) => ({ p, i, priority: p.role ? ROLE_LAYER_PRIORITY[p.role] : 0 }))
    .sort((a, b) => a.priority - b.priority || a.i - b.i)
    .map((e) => e.p);
}

/** Build 010, Section 5 (Premium Rhythm Engine): the same "fixed,
 * deliberately non-monotonic cycle, never two equal steps in a row" idiom
 * as `clusterEngine.ts`'s `SIZE_RHYTHM`, rescaled to stay inside the
 * existing +/-22% wobble band (values in [0.8, 1.2]) so opting in changes
 * *which* pattern the per-instance scale follows, not the overall spread
 * every `HierarchyParams` scale band already assumes. */
const PREMIUM_RHYTHM_STEPS = [1.18, 0.88, 1.05, 0.94];

function normalizeRatios(h: HierarchyParams): [number, number, number, number] {
  const sum = h.heroRatio + h.secondaryRatio + h.fillerRatio + h.accentRatio;
  if (sum <= 0) return [0, 1, 0, 0];
  return [h.heroRatio / sum, h.secondaryRatio / sum, h.fillerRatio / sum, h.accentRatio / sum];
}

/** Assigns hero/secondary/filler/accent to each placement deterministically
 * from the seeded rng, then multiplies its existing scale by the role's
 * scale factor — composes with whatever scale variation the layout itself
 * already produced rather than replacing it. */
export function applyHierarchy(placements: Placement[], hierarchy: HierarchyParams, rng: Rng): Placement[] {
  const [heroP, secondaryP, fillerP] = normalizeRatios(hierarchy);
  // Build 010, Section 5: a randomized per-role start offset into
  // PREMIUM_RHYTHM_STEPS, resolved once per tile — rolled unconditionally
  // (a fixed rng-consumption shape whether or not the flag ends up true
  // downstream) would shift every other generation's rng stream, so this
  // stays strictly inside the `premiumRhythm` branch, matching the same
  // "no rng cost unless the feature is on" convention every other optional
  // pass in this file already follows.
  const rhythmOffsets = hierarchy.premiumRhythm
    ? {
        hero: rngInt(rng, 0, PREMIUM_RHYTHM_STEPS.length - 1),
        secondary: rngInt(rng, 0, PREMIUM_RHYTHM_STEPS.length - 1),
        filler: rngInt(rng, 0, PREMIUM_RHYTHM_STEPS.length - 1),
        accent: rngInt(rng, 0, PREMIUM_RHYTHM_STEPS.length - 1),
      }
    : undefined;
  const rhythmCounts: Record<MotifRole, number> = { hero: 0, secondary: 0, filler: 0, accent: 0 };
  const roled = placements.map((p) => {
    const t = rng();
    let role: MotifRole;
    let mul: number;
    if (t < heroP) {
      role = 'hero';
      mul = hierarchy.heroScale;
    } else if (t < heroP + secondaryP) {
      role = 'secondary';
      mul = hierarchy.secondaryScale;
    } else if (t < heroP + secondaryP + fillerP) {
      role = 'filler';
      mul = hierarchy.fillerScale;
    } else {
      role = 'accent';
      mul = hierarchy.accentScale;
    }
    let wobble: number;
    if (rhythmOffsets) {
      // Build 010, Section 5 (Premium Rhythm Engine): each role tracks its
      // own position in the shared non-monotonic cycle (not a tile-wide
      // index), so a role's own instances read as a deliberate rhythm
      // regardless of how the other roles happen to interleave with it —
      // a small residual jitter (+/-5%, well inside the step-to-step gaps)
      // keeps instances from looking mechanically identical within a step.
      const idx = (rhythmCounts[role] + rhythmOffsets[role]) % PREMIUM_RHYTHM_STEPS.length;
      rhythmCounts[role]++;
      wobble = PREMIUM_RHYTHM_STEPS[idx] * (1 + rngRange(rng, -0.05, 0.05));
    } else {
      // Build 002, Section 4 (Scale Diversity): a real, wide per-instance
      // spread within each role's own scale band, not just cosmetic noise —
      // the old +/-6% wobble left same-role motifs (often 30%+ of a tile's
      // placements, e.g. DEFAULT_HIERARCHY's 38% secondary / 35% filler)
      // clustered tightly enough around one multiplier to dominate a single
      // bucket of `critic/visualAnalysis.ts`'s 8-bucket scale-repeat detector
      // (SCALE_REPEAT_THRESHOLD 0.5) on almost every real generation — exactly
      // the repeatedScale flag rate this section measured at 32% portfolio-
      // wide. +/-22% keeps every role's own band comfortably separated from
      // its neighbors (hero/secondary/filler/accent multipliers are spaced far
      // enough apart across every HIERARCHY_PRESETS entry that +/-22% never
      // makes two roles' ranges overlap), while spreading each role's own
      // instances across roughly 2 of the detector's 8 buckets instead of 1.
      wobble = 1 + rngRange(rng, -0.22, 0.22);
    }
    return { ...p, role, scale: Math.max(0.05, p.scale * mul * wobble) };
  });
  return promoteSecondaryHero(roled, hierarchy);
}

/** Build 009, Section 1 (Visual Hierarchy Engine V2): a real second focal
 * point within the 'secondary' tier -- see `HierarchyParams
 * .secondaryHeroBoost`'s own doc comment for why this isn't a new
 * `MotifRole` value. Deterministic (no rng consumption, so it never shifts
 * any other pass's random stream): among every 'secondary'-role placement
 * in the tile, the single one that already rolled the largest scale (the
 * one that would have read as "the biggest of the supporting group"
 * anyway) is boosted toward a band between plain secondary and hero,
 * rather than picking a fresh random winner -- a real, deliberate "this
 * one is the secondary hero" choice, not an arbitrary one. No-op (returns
 * `placements` unchanged, same array reference) when `secondaryHeroBoost`
 * is unset/0 or there is no 'secondary'-role placement at all. */
function promoteSecondaryHero(placements: Placement[], hierarchy: HierarchyParams): Placement[] {
  const boost = hierarchy.secondaryHeroBoost ?? 0;
  if (boost <= 0) return placements;
  let largestIndex = -1;
  let largestScale = -Infinity;
  placements.forEach((p, i) => {
    if (p.role === 'secondary' && p.scale > largestScale) {
      largestScale = p.scale;
      largestIndex = i;
    }
  });
  if (largestIndex < 0) return placements;

  // Boosted scale sits strictly between the plain secondary band and the
  // hero band -- never allowed to reach or exceed heroScale itself, so the
  // real hero (Section 1's "primary hero") always still reads as the
  // single largest object in the tile.
  const target = hierarchy.secondaryScale + (hierarchy.heroScale - hierarchy.secondaryScale) * Math.min(1, boost);
  const capped = Math.min(target, hierarchy.heroScale * 0.92);
  const result = placements.slice();
  result[largestIndex] = { ...result[largestIndex], scale: Math.max(result[largestIndex].scale, capped) };
  return result;
}

/** Build 009, Section 1 (Visual Hierarchy Engine V2): a real, measured
 * "does this tile's hierarchy read as intentional" score -- averages how
 * cleanly each pair of adjacent rendered-scale tiers (hero > secondary >
 * filler > accent, the real `ROLE_LAYER_PRIORITY` order) separates,
 * relative to the tile's own overall scale spread. A tile whose tiers'
 * average scales barely differ (everything reads as "medium") scores low
 * even if roles were nominally assigned; a tile with real, clearly
 * separated bands scores high. Tiles with fewer than 2 distinct roles
 * present return 100 (nothing to separate, trivially "clean") rather than
 * a fabricated penalty. */
export function computeVisualHierarchyScore(placements: Placement[]): number {
  const byRole = new Map<MotifRole, number[]>();
  for (const p of placements) {
    if (!p.role) continue;
    if (!byRole.has(p.role)) byRole.set(p.role, []);
    byRole.get(p.role)!.push(p.scale);
  }
  const tiers: MotifRole[] = ['hero', 'secondary', 'filler', 'accent'];
  const means = tiers
    .filter((t) => byRole.has(t))
    .map((t) => byRole.get(t)!.reduce((a, b) => a + b, 0) / byRole.get(t)!.length);
  if (means.length < 2) return 100;

  const allScales = placements.map((p) => p.scale);
  const spread = Math.max(...allScales) - Math.min(...allScales);
  if (spread <= 0) return 0;

  const gaps: number[] = [];
  for (let i = 0; i < means.length - 1; i++) gaps.push((means[i] - means[i + 1]) / spread);
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  return Math.max(0, Math.min(100, Math.round(avgGap * 100)));
}
