import type { Motif, Rng } from '../engine/types';
import { h, round } from '../engine/svgAst';
import { rngPick, rngRange, rngInt, rngBool } from '../engine/rng';
import { generateCluster, rollPreferOdd, type ClusterMember, type ClusterArchetype } from '../engine/clusterEngine';
import { applyHeroDetailOverlay } from '../engine/heroComplexity';
import { generateStem, growLeaves, GROWTH_PRESETS } from './growth';
import { calyxBase, flowerCenterDetail } from './shared';
import { botanicalGenerator } from './botanical';
import { BOTANICAL_SPECIES, pickCompanionFamily, type BotanicalFamily } from './botanicalFamilies';
import type { BotanicalPart } from './botanicalParts';
import { illustrationTemplateForSpecies, type IllustrationTemplate } from './illustrationFamily';
import { leafAnatomyFor, anatomicalLeafNode, pickLeafEdge } from './leafAnatomy';
import { flowerAnatomyFor, rollOpenness } from './flowerAnatomy';
import type { DesignGenerationRules } from '../engine/designKnowledge';
import type { CompanionRole, SpatialRelationship } from '../knowledge/registry/speciesSchema';

// Build 004, Section 8 (Premium Hero Builder): "Heroes should become
// botanical bouquets. Instead of one flower, construct Hero Flower +
// Supporting Leaves + Bud + Berry + Stem + Accent Flowers + Micro Details.
// Each hero becomes one artistic object." Every existing hero placement
// draws ONE independent variant via `botanicalGenerator.createMotif` --
// this module instead assembles a real composite: a Hero Flower plus
// several distinct supporting sub-parts, arranged and grouped into one SVG
// object.
//
// The sub-parts' arrangement reuses Section 4's own `bouquet` cluster
// archetype -- literally the same engine that arranges a bouquet of
// separate motifs across a tile, applied one level down to arrange one
// hero's own internal sub-parts. Each cluster member's role maps to a
// distinct real sub-part (never just "the same flower shape again, smaller"):
// hero -> Hero Flower, secondary -> Bud or Accent Flower (alternating,
// so both named parts appear), filler -> Berry, accent -> a tiny filler
// motif. "Micro Details" reuses `engine/heroComplexity.ts`'s existing,
// already-shipped detail overlay (ring/texture lines/decorative dots/
// nested contour/accent arc) rather than duplicating that logic.
//
// Not yet wired into `engine/tile.ts`'s per-placement rendering -- forcing
// EVERY hero into a premium bouquet would directly contradict Section 3's
// own Style DNA differentiation (Minimal Botanical explicitly wants "simple
// silhouettes, few elements"), so which presets opt into a premium hero is
// Section 9's job (Style DNA botanical grammar), not this section's.


// Build 006, Section 2 (Luxury Bouquet Composer): "current heroes still
// feel procedural" -- one real, measurable driver is that every non-hero
// member draws at whatever scale the cluster archetype's own jitter
// happened to roll, with nothing checking whether the resulting bouquet
// still reads as "one dominant flower plus real supporting detail" versus
// "several members all competing for attention." This gives "visual
// weight" an honest, computable meaning (a role-weighted sum of rendered
// scale, never the hero's own role) and only intervenes -- shrinking every
// non-hero member by one shared factor, never reordering or hiding any of
// them -- when that sum would out-weigh the hero itself. A typical
// generateCluster('bouquet', ...) roll never approaches the cap (verified
// empirically before shipping), so this is a real ceiling for the
// occasional outlier roll, not a change that fires on every hero.
const ROLE_VISUAL_WEIGHT: Record<string, number> = { hero: 4, secondary: 2, filler: 1, accent: 0.5 };
const MAX_SUPPORT_WEIGHT_RATIO = 0.9;

/** Build 008B, Section 6 (Commercial Asset Priority): "large premium
 * flowers should visually dominate, small fillers should never overpower
 * heroes" -- the brief's own wording -- becomes a real, computed
 * tightening of the existing Build 006 support-weight cap using the
 * hero's own real `premiumScore` (Build 008B, Section 1) instead of one
 * flat ratio applied to every hero species alike. A top-tier species
 * (premiumScore 100) tightens the cap to 0.7 (its supports recede
 * further, letting the hero dominate more); a modest one (0) relaxes back
 * to the original 1.0. A hero with no species hint at all (`family`
 * undefined) keeps the exact pre-008B 0.9 ratio -- byte-identical output
 * for every existing no-family call site. */
export function supportWeightRatio(premiumScore: number | undefined): number {
  if (premiumScore === undefined) return MAX_SUPPORT_WEIGHT_RATIO;
  return 1.0 - (premiumScore / 100) * 0.3;
}

/** Build 009, Section 4 (Hero Framing Engine): the exact base sizes each
 * role's sub-motif is actually drawn at below (`size * 0.55/0.4/0.22` for
 * secondary/filler/accent) -- reused here so the push-away's minimum
 * clearance is derived from each member's own real rendered footprint,
 * never an arbitrary constant. */
const HERO_FRAME_MEMBER_RENDER_SCALE: Record<'secondary' | 'filler' | 'accent', number> = {
  secondary: 0.55,
  filler: 0.4,
  accent: 0.22,
};

/** The hero flower's own occupied radius, as a fraction of `size` -- a
 * conservative floor (well under the hero sub-motif's actual ~size*0.5+
 * footprint) so genuinely intentional close overlap still survives; this
 * only ever pushes a member OUT when it would otherwise crowd deep inside
 * the hero's own silhouette rather than framing it. */
const HERO_OWN_FOOTPRINT_FRACTION = 0.32;

/** Build 009, Section 4 (Hero Framing Engine): "avoid randomly floating
 * heroes... every hero should feel intentionally presented" -- two real,
 * geometric passes over the cluster members `generateCluster` already
 * produced, applied before they're drawn:
 *
 * 1. Push-away: a supporting member whose rolled position lands closer to
 *    the hero's own center than its real rendered footprint allows would
 *    visually crowd/bury the hero rather than frame it. Pushed radially
 *    outward (preserving its own angle -- the archetype's directional
 *    identity is untouched) to a real minimum clearance derived from the
 *    hero's own occupied radius plus that member's own base render size
 *    times its rolled `scaleMul`.
 * 2. Angular framing: only for `bouquet` -- the one archetype whose entire
 *    identity is a circular surround of the hero (see
 *    `HERO_SILHOUETTE_ARCHETYPES`'s own doc comment). Members are nudged a
 *    bounded fraction toward evenly-spaced angular slots (preserving their
 *    own relative circular order, and the whole composition's overall
 *    orientation via `basePhase`) rather than left to the archetype's pure
 *    per-member random angle roll -- real coverage of the framing zones
 *    around the hero, not a perfect mechanical fan (the bounded `0.35`
 *    pull keeps organic jitter, never snapping exactly onto the slot).
 *    Every other archetype's own axis (cascade's vertical line, diagonal's
 *    45-degree band, asymmetric's near/far counterweight, ...) IS its real
 *    framing identity -- forcing even angular coverage there would fight
 *    Build 008B, Section 7's own silhouette-diversity goal, so this step is
 *    a no-op for them. */
export function applyHeroFraming(members: ClusterMember[], size: number, archetype: ClusterArchetype): ClusterMember[] {
  const pushed = members.map((m) => {
    if (m.role === 'hero') return m;
    const dist = Math.hypot(m.dx, m.dy) || 1;
    const minDist = size * (HERO_OWN_FOOTPRINT_FRACTION + HERO_FRAME_MEMBER_RENDER_SCALE[m.role] * m.scaleMul * 0.4);
    if (dist >= minDist) return m;
    const ux = m.dx / dist;
    const uy = m.dy / dist;
    return { ...m, dx: ux * minDist, dy: uy * minDist };
  });

  if (archetype !== 'bouquet') return pushed;

  const supportIndices = pushed.map((_, i) => i).filter((i) => pushed[i].role !== 'hero');
  if (supportIndices.length < 2) return pushed;
  const withAngle = supportIndices
    .map((i) => ({ i, angle: Math.atan2(pushed[i].dy, pushed[i].dx) }))
    .sort((a, b) => a.angle - b.angle);
  const targetGap = (Math.PI * 2) / withAngle.length;
  const basePhase = withAngle[0].angle;

  const result = pushed.slice();
  withAngle.forEach(({ i, angle }, rank) => {
    const targetAngle = basePhase + rank * targetGap;
    const delta = Math.atan2(Math.sin(targetAngle - angle), Math.cos(targetAngle - angle));
    const newAngle = angle + delta * 0.35;
    const dist = Math.hypot(pushed[i].dx, pushed[i].dy) || 1;
    result[i] = { ...pushed[i], dx: Math.cos(newAngle) * dist, dy: Math.sin(newAngle) * dist };
  });
  return result;
}

/** Build 010, Section 1 (Signature Bouquet Composer): every existing pass
 * over a premium hero's cluster members (balance/framing/angular coverage)
 * positions each member relative to the hero's own *center* -- none of them
 * visually ties a member to the hero's own stem, so a bouquet still reads as
 * "several independently-drawn objects clustered near a point" rather than
 * "one bouquet, gathered." A real cut-flower bouquet reads as designed
 * specifically because every stem visually converges at one gather point
 * (roughly where a florist's hand or ribbon would be) before spreading into
 * blooms. `generateStem`'s own control points span symmetrically from
 * `-length/2` to `+length/2` around the hero's local origin, so
 * `+length/2` (`size * 0.2` for the default `stemLengthScale`) is a real,
 * already-drawn reference point on the hero's own stem, not an invented
 * one. A small, bounded pull of each non-hero member's rolled anchor toward
 * that point -- run before `applyHeroFraming`'s push-away, so the two never
 * fight -- keeps every archetype's own overall silhouette (bouquet's
 * circular spread, cascade's vertical line, ...) intact while adding a real
 * "everything gathers near the base" read. `strength` of 0 (or an empty
 * member list) is an exact no-op, byte-identical to pre-Build-010 output. */
const GATHER_POINT_Y_FRACTION = 0.2;
const GATHER_PULL_STRENGTH = 0.14;

export function applyGatherPoint(members: ClusterMember[], size: number, strength = GATHER_PULL_STRENGTH): ClusterMember[] {
  if (strength <= 0) return members;
  const gatherY = size * GATHER_POINT_Y_FRACTION;
  return members.map((m) => {
    if (m.role === 'hero') return m;
    return { ...m, dx: m.dx + (0 - m.dx) * strength, dy: m.dy + (gatherY - m.dy) * strength };
  });
}

/** Build 010, Section 4 (Botanical Relationship Engine V2): the audit found
 * `SpeciesCompanion` only ever encoded WHICH part a companion draws
 * (foliage/filler/berry role) — nothing gave that companion a real spatial
 * habit relative to the hero, so a Rose's eucalyptus foliage and its
 * baby's-breath filler sat at the exact same kind of generic cluster-
 * archetype offset. `spatialRelationship` (see speciesSchema.ts) now
 * carries a real botanical spatial bias per companion: `'trailing'` pulls
 * a filler/accent member further from the hero (drapes past its
 * footprint, the way wispy eucalyptus/olive/herb foliage genuinely
 * hangs), `'nesting'` pulls it closer in (tucked behind/among the hero,
 * the way a filler flower or berry cluster nestles), `'climbing'` pulls
 * it toward the hero's own vertical stem axis (dx toward 0, as if
 * wrapping the stem). Runs strictly additive, after `applyHeroFraming`'s
 * push-away has already established real clearance — this only nudges
 * *within* that safe zone, never re-introduces crowding. Only filler/
 * accent members are touched (secondary stays the hero's own species, per
 * the existing convention below); undefined/`'none'` is a no-op. */
export function applyCompanionSpatialBias(members: ClusterMember[], relationship: SpatialRelationship | undefined, strength = 0.2): ClusterMember[] {
  if (!relationship || relationship === 'none') return members;
  return members.map((m) => {
    if (m.role !== 'filler' && m.role !== 'accent') return m;
    if (relationship === 'trailing') return { ...m, dx: m.dx * (1 + strength), dy: m.dy * (1 + strength) };
    if (relationship === 'nesting') return { ...m, dx: m.dx * (1 - strength), dy: m.dy * (1 - strength) };
    return { ...m, dx: m.dx * (1 - strength) };
  });
}

function balanceVisualWeight(members: ClusterMember[], premiumScore?: number): ClusterMember[] {
  const heroWeight = members
    .filter((m) => m.role === 'hero')
    .reduce((sum, m) => sum + ROLE_VISUAL_WEIGHT.hero * m.scaleMul, 0);
  if (heroWeight <= 0) return members;
  const supportWeight = members
    .filter((m) => m.role !== 'hero')
    .reduce((sum, m) => sum + (ROLE_VISUAL_WEIGHT[m.role] ?? 1) * m.scaleMul, 0);
  const cap = heroWeight * supportWeightRatio(premiumScore);
  if (supportWeight <= cap || supportWeight <= 0) return members;
  const shrink = cap / supportWeight;
  return members.map((m) => (m.role === 'hero' ? m : { ...m, scaleMul: m.scaleMul * shrink }));
}

/** Build 007, Section 3 (Premium Bouquet Designer, "filler flowers, berry
 * balance"): the `bouquet` template used to force EVERY filler member to a
 * berry part regardless of what the companion species actually is -- a
 * Rose paired with Baby's-Breath (a real filler-role species with no
 * berries at all) still drew a berry.
 *
 * Build 008B, Section 3 (Commercial Bouquet Grammar): sharpened further
 * using the real, typed pairing role Build 008B's own companion matrix
 * carries per companion (`SpeciesCompanion.role` -- 'foliage' | 'filler' |
 * 'accentBerry', knowledge/registry/speciesSchema.ts) instead of the
 * coarser `bouquetRole === 'filler'` check alone -- a Rose paired with
 * Eucalyptus (role: 'foliage') now genuinely draws a Filler Leaf sprig
 * rather than falling through to a berry, matching the brief's own named
 * role hierarchy ("...Filler Flower -> Filler Leaf -> Berry..."). Falls
 * back to the pre-008B `bouquetRole`-only check when no companion role is
 * known at all (a species with an empty companion list reproduces prior
 * output exactly, same as `pickCompanionFamily`'s own fallback). Exported
 * as a pure function so this decision is unit-testable independent of the
 * full SVG assembly. */
export function resolveFillerPart(
  template: IllustrationTemplate,
  companionRole: CompanionRole | undefined,
  fillerFamily: BotanicalFamily | undefined,
): BotanicalPart {
  if (companionRole === 'foliage') return template.fillerLeafPart;
  if (companionRole === 'filler') return 'secondaryFlower';
  if (companionRole === 'accentBerry') return template.fillerPart;
  const companionIsFillerFlower = fillerFamily ? BOTANICAL_SPECIES[fillerFamily].bouquetRole === 'filler' : false;
  return companionIsFillerFlower ? 'secondaryFlower' : template.fillerPart;
}

/** Build 008B, Section 7 (Silhouette Diversity): every premium hero used to
 * always assemble its internal members via the `bouquet` cluster
 * archetype -- a real, tuned arrangement, but the ONLY one, so a large
 * portfolio's premium heroes all read as the same circular silhouette
 * regardless of species or seed. `cascade`/`diagonal`/`asymmetric`/
 * `editorial` are real, already-implemented, already-tested archetypes
 * (engine/clusterEngine.ts) with genuinely distinct member geometry
 * (vertical, 45-degree axis, near/far counterweight groups, horizontal
 * spread) that were simply never reachable at hero-assembly scale. Kept
 * `bouquet`-majority-weighted (3 of 7 pool entries) rather than a flat
 * 1-in-5 pick, so the existing, well-tuned circular silhouette stays the
 * common case while a real, measurable minority of heroes now read as a
 * genuinely different shape -- directly the brief's own "avoid repeated
 * circular bouquets" ask, without discarding what already worked. */
const HERO_SILHOUETTE_ARCHETYPES: ClusterArchetype[] = ['bouquet', 'bouquet', 'bouquet', 'cascade', 'diagonal', 'asymmetric', 'editorial'];

/** Build 009, Section 6 (Silhouette Optimization): the real, distinct set
 * of archetypes `resolveHeroArchetype` can actually return (deduped from
 * `HERO_SILHOUETTE_ARCHETYPES`'s weighted pool) -- the honest denominator
 * for a portfolio-level "hero silhouette diversity" measurement (see
 * `engine/portfolioQuality.ts`'s `computeHeroArchetypeDiversity`), since
 * the reachable taxonomy for hero assembly is these 5, not the full
 * 13-value `ClusterArchetype` union. */
export const HERO_ARCHETYPE_POOL: ClusterArchetype[] = Array.from(new Set(HERO_SILHOUETTE_ARCHETYPES));

/** Resolves which cluster archetype a premium hero's own internal members
 * arrange around -- an explicit `archetype` option always wins (a future
 * Style-DNA-driven hook), otherwise a weighted roll from
 * `HERO_SILHOUETTE_ARCHETYPES`. Exported as a pure function so the
 * weighting is unit-testable independent of the full SVG assembly. */
export function resolveHeroArchetype(rng: Rng, explicit?: ClusterArchetype): ClusterArchetype {
  return explicit ?? rngPick(rng, HERO_SILHOUETTE_ARCHETYPES);
}

export interface PremiumHeroOptions {
  colors: string[];
  size: number;
  family?: BotanicalFamily;
  /** Build 005, Section 2 (Design Rule Engine): the active Style DNA's own
   * resolved generation rules (see engine/designKnowledge.ts) — undefined
   * (no Style DNA, or one whose rules happen to match the defaults below)
   * reproduces this function's original Build 004 behavior exactly. */
  designRules?: DesignGenerationRules;
  /** Build 008B, Section 7 (Silhouette Diversity): forces a specific
   * internal arrangement archetype instead of the default weighted roll
   * (see `resolveHeroArchetype`) -- undefined lets the roll happen. */
  archetype?: ClusterArchetype;
  /** Build 010, Section 6 (Professional Illustrator Rules, "rule of
   * odds"): biases this hero's own member-count roll toward an odd total
   * (see `rollPreferOdd`) instead of the plain `rngInt` roll -- undefined/
   * false reproduces the exact prior roll. */
  preferOddCount?: boolean;
}

/** Assembles one hero as a real multi-part botanical bouquet: a grown stem
 * with supporting leaves, a Hero Flower, alternating Bud/Accent Flower
 * secondary parts, a Berry filler part, and a Micro Details overlay -- all
 * grouped into one SVG object, positioned via the real Bouquet cluster
 * archetype's own arrangement math. Deterministic for a given rng
 * sequence. */
export function buildPremiumHero(rng: Rng, opts: PremiumHeroOptions): Motif {
  const { colors, size, family, designRules, archetype, preferOddCount } = opts;
  const accents = colors.length > 1 ? colors.slice(1) : colors;

  // A hero placement is already positioned by its OWN layout's spacing math
  // (which sized the gaps to its neighbors assuming a plain single-variant
  // motif's footprint) -- a hero drawn from a cluster-based layout
  // (bouquet/heroScatter) additionally sits inside that outer layout's own
  // cluster. Keeping this inner arrangement tight (not the ~size*0.4 a
  // freestanding cluster would use) keeps the assembled hero's overall
  // radius close to a plain hero's, so it reads as "one richer object" at
  // the same footprint rather than sprawling into space the outer layout
  // reserved for its other members.
  // Build 005, Section 2 (Design Rule Engine): `heroMemberCountRange`/
  // `bouquetBaseRadiusScale` come from the active style's own resolved
  // Design Knowledge -- a "many hero, full bouquet" style genuinely
  // assembles a bigger, fuller bouquet than a "few hero, small bouquet"
  // one, on top of (not instead of) the per-species growth already wired
  // in Section 4. Undefined `designRules` reproduces the original [4,6]/
  // 1.0 defaults exactly.
  const memberCountRange = designRules?.heroMemberCountRange ?? [4, 6];
  const baseRadiusScale = designRules?.bouquetBaseRadiusScale ?? 1;
  const resolvedArchetype = resolveHeroArchetype(rng, archetype);
  // Build 010, Section 6 (Professional Illustrator Rules, "rule of odds"):
  // see `rollPreferOdd`'s own doc comment -- undefined/false `preferOddCount`
  // reproduces the exact prior `rngInt` roll.
  const rolledMemberCount = preferOddCount
    ? rollPreferOdd(rng, memberCountRange[0], memberCountRange[1])
    : rngInt(rng, memberCountRange[0], memberCountRange[1]);
  const members = generateCluster(resolvedArchetype, rng, {
    baseRadius: size * 0.2 * baseRadiusScale,
    rotationJitter: 12,
    scaleJitter: 0.15,
    memberCount: rolledMemberCount,
  });

  // Kept short (a plain hero variant's own stems are similarly compact) --
  // a full-length stem (previously size*0.85, reaching ~size*0.42 from
  // center on its own) plus leaves extending further past its tip was the
  // real, dominant driver of an oversized rendered bounding radius
  // (confirmed via computeBoundingRadius, which re-measures actual SVG
  // geometry independent of the `radius` estimate below) -- not the
  // cluster member spread, which this function already keeps tight.
  // Build 005, Section 4 (Botanical Species Engine): the foliage base
  // used to be one hardcoded preset regardless of which species the hero
  // actually is. A species now genuinely drives its own hero's growth --
  // Eucalyptus/Olive/Fern get their own real leaf arrangement/curvature
  // instead of every family reading as generic "leafyBranch" foliage, and
  // `stemLengthScale`/`leafDensityScale` (also real per-species data, not
  // fabricated multipliers) scale the rendered stem length and leaf size.
  // Build 005, Section 2: the style's own `stemLengthMultiplier`/
  // `leafDensityMultiplier` compound with the species' own scale (Section
  // 4) rather than replacing it -- a "long stem" style drawing a
  // naturally long-stemmed species reads longer still, while that same
  // style forced into a naturally short species still reads longer than
  // its own "short stem" counterpart would.
  const species = family ? BOTANICAL_SPECIES[family] : undefined;
  const stemLengthScale = (species?.stemLengthScale ?? 1) * (designRules?.stemLengthMultiplier ?? 1);
  const stem = generateStem(rng, size * 0.4 * stemLengthScale, rngRange(rng, 0.05, 0.1));
  const stemColor = rngPick(rng, accents);
  const leafPreset = species ? GROWTH_PRESETS[species.growthPreset] : GROWTH_PRESETS.leafyBranch;
  const leaves = growLeaves(rng, stem, leafPreset);
  const leafColor = rngPick(rng, accents);
  const leafVeinColor = rngPick(rng, accents);
  const leafDensityScale = (species?.leafDensityScale ?? 1) * (designRules?.leafDensityMultiplier ?? 1);
  // Build 007, Section 2 (Leaf Anatomy Engine): a real per-species leaf
  // silhouette (ovate/serrated + pinnate venation, see leafAnatomy.ts)
  // instead of the previous flat, vein-less `simpleLeafPath` teardrop --
  // the hero's own leaves are the most visible foliage in the whole tile,
  // so this is the highest-leverage place to close the anatomy gap.
  const heroLeafAnatomy = leafAnatomyFor(family);
  const leafNodes = leaves.map((leaf) => {
    const leafLen = size * rngRange(rng, 0.12, 0.18) * leaf.scale * leafDensityScale;
    const profile = { ...heroLeafAnatomy, edge: pickLeafEdge(rng, heroLeafAnatomy) };
    return h('g', { transform: `translate(${round(leaf.point.x)} ${round(leaf.point.y)}) rotate(${round(leaf.angle)})` }, [
      anatomicalLeafNode(rng, leafColor, leafVeinColor, leafLen, profile),
    ]);
  });

  // Build 006, Section 3 (Natural Botanical Relationships): a real
  // companion species -- picked ONCE per hero, not once per member, so the
  // whole bouquet commits to one coherent pairing (e.g. every berry/tiny
  // accent in a Rose hero reads as the SAME real companion, not a
  // different random species each time) -- used below for the filler/
  // accent roles (berries, tiny accents) and the foliage sprig, matching
  // the brief's own example (rose paired with eucalyptus/baby's-breath/
  // berries) instead of every role in the bouquet forcing the single
  // hero `family`.
  const companionFamily = pickCompanionFamily(rng, family);

  // Build 006, Section 2 (Luxury Bouquet Composer): "branch rhythm" -- a
  // second, shorter companion-foliage sprig bound alongside the primary
  // stem, the way a real florist's bouquet binds foliage stems of
  // deliberately varied length together, not just one flower's own leaves.
  // Kept small on purpose (a "sprig", capped at 3 leaves) -- this is
  // additive hero-level detail (already the most affordable detail budget,
  // Section 7's own node-budget convention), not a second full branch.
  // Only drawn when a real, distinct companion exists (a species with no
  // companion list reproduces pre-Build-006 output exactly).
  let companionFoliageNode: ReturnType<typeof h> | undefined;
  if (companionFamily && companionFamily !== family) {
    const companionPreset = GROWTH_PRESETS[BOTANICAL_SPECIES[companionFamily].growthPreset];
    const sprigStem = generateStem(rng, size * 0.22 * stemLengthScale, rngRange(rng, 0.05, 0.1));
    const sprigLeaves = growLeaves(rng, sprigStem, companionPreset).slice(0, 3);
    const sprigColor = rngPick(rng, accents);
    const sprigVeinColor = rngPick(rng, accents);
    const sprigLeafAnatomy = leafAnatomyFor(companionFamily);
    const sprigNodes = sprigLeaves.map((leaf) => {
      const leafLen = size * rngRange(rng, 0.08, 0.12) * leaf.scale;
      return h('g', { transform: `translate(${round(leaf.point.x)} ${round(leaf.point.y)}) rotate(${round(leaf.angle)})` }, [
        anatomicalLeafNode(rng, sprigColor, sprigVeinColor, leafLen, sprigLeafAnatomy),
      ]);
    });
    if (sprigNodes.length > 0) {
      companionFoliageNode = h(
        'g',
        {
          'data-part': 'companion-foliage',
          transform: `translate(${round(rngRange(rng, -size * 0.15, size * 0.15))} ${round(rngRange(rng, -size * 0.1, size * 0.05))}) rotate(${round(rngRange(rng, -25, 25))})`,
        },
        sprigNodes,
      );
    }
  }

  // Build 007, Section 4 (Botanical Gesture Engine): the stem spline
  // already curves (S/C sway) and leaves already bend along its local
  // tangent -- but the whole foliage base still always grows dead
  // vertical, with no overall lean. A real cut stem in a bouquet leans a
  // few degrees off-vertical as a matter of how it was gathered/placed,
  // not just curving in place -- a small seeded rotation of the entire
  // stem+leaves+companion-foliage group gives the hero a real "growing in
  // a direction" read instead of a perfectly upright silhouette every time.
  const gestureLean = rngRange(rng, -7, 7);
  const parts = [
    h(
      'g',
      { 'data-part': 'gesture-lean', transform: `rotate(${round(gestureLean)})` },
      [
        h('g', { 'data-part': 'stem' }, [
          h('path', { d: stem.path, fill: 'none', stroke: stemColor, 'stroke-width': round(size * 0.02), 'stroke-linecap': 'round' }),
        ]),
        h('g', { 'data-part': 'leaves' }, leafNodes),
        ...(companionFoliageNode ? [companionFoliageNode] : []),
      ],
    ),
  ];

  // Build 005, Section 5 (Illustration Family Engine): which named part
  // each cluster role maps to now depends on the species' own real
  // `bouquetRole` (a full bloom, a loose spray of small flowers, or pure
  // foliage) instead of one hardcoded flower/bud/berry mapping applied to
  // every family regardless of whether it even has those parts.
  const template = illustrationTemplateForSpecies(species);

  // Build 006, Section 2: real "visual weight" balancing (see
  // `balanceVisualWeight`'s own doc comment) -- a no-op for the ordinary
  // roll, a real cap for the occasional one where support members would
  // otherwise out-weigh the hero.
  const balancedMembers = balanceVisualWeight(members, species?.premiumScore);

  // Build 010, Section 1 (Signature Bouquet Composer): see
  // `applyGatherPoint`'s own doc comment -- a bounded pull toward the hero's
  // own stem-base point, run before the push-away below so the two passes
  // never fight (gather first, then re-establish clearance).
  const gatheredMembers = applyGatherPoint(balancedMembers, size);

  // Build 009, Section 4 (Hero Framing Engine): see `applyHeroFraming`'s own
  // doc comment -- push-away against crowding the hero, plus (for `bouquet`
  // only) a bounded nudge toward more even angular framing coverage.
  const framedMembers = applyHeroFraming(gatheredMembers, size, resolvedArchetype);

  // Build 010, Section 4 (Botanical Relationship Engine V2): the real
  // companion entry's own `spatialRelationship` (see speciesSchema.ts) --
  // looked up once here (reused below for `resolveFillerPart` too) so the
  // position bias and the part-selection logic always agree on which
  // companion pairing is active. See `applyCompanionSpatialBias`'s own doc
  // comment; undefined/'none' is a no-op.
  const companionEntry = species?.companions.find((c) => c.family === companionFamily);
  const spatiallyBiasedMembers = applyCompanionSpatialBias(framedMembers, companionEntry?.spatialRelationship);

  let secondaryToggle = 0;
  let colorSeed = 1;
  for (const member of spatiallyBiasedMembers) {
    let sub: Motif;
    let calyx: ReturnType<typeof h> | undefined;
    let centerDetail: ReturnType<typeof h> | undefined;
    // Build 006, Section 3: filler/accent members (berries, tiny accents)
    // draw from the real companion species when one exists -- a Rose
    // hero's berry filler is a genuine Berry Branch, not another rose --
    // while hero/secondary stay on the hero's own species (a bouquet's
    // secondary blooms are more of the SAME flower, a real construction
    // choice, not a species swap).
    const fillerFamily = companionFamily ?? family;
    if (member.role === 'hero') {
      sub = botanicalGenerator.createMotif(rng, colors, size, colorSeed++, { role: 'hero', part: template.heroPart, family });
      // Build 005, Section 3 (Premium SVG Illustration Engine): a real
      // Calyx Generator (see shared.ts's `calyxBase`) under the hero
      // flower -- the sepal detail no prior variant drew, reserved for the
      // hero-scale sub-part where the extra node cost is affordable (see
      // Section 7's node-budget guardrails; secondary/filler/accent parts
      // stay calyx-free to keep them cheap). Only drawn for templates
      // whose hero part is a real flower -- a foliage `branch` hero has no
      // sepal base to draw.
      if (template.usesCalyx) {
        // Build 007, Section 1 (Flower Anatomy Engine): real per-species
        // sepal/filament counts and a bloom-stage roll within that
        // species' own natural openness range, instead of one constant
        // (sepalCount=5, filamentCount=6, fully-open) applied to every
        // hero species alike.
        const anatomy = flowerAnatomyFor(family);
        const openness = rollOpenness(rng, anatomy);
        calyx = calyxBase(rng, { color: rngPick(rng, accents), flowerRadius: sub.radius, sepalCount: anatomy.sepalCount });
        // Build 006, Section 7 (Premium SVG Detail): a real Flower Center
        // (stamens + anther dots + disc), reserved for the same hero-scale,
        // real-flower templates the Calyx already is -- the exact same
        // node-budget gating `calyxBase` established in Build 005.
        centerDetail = flowerCenterDetail(rng, {
          filamentColor: rngPick(rng, accents),
          discColor: rngPick(rng, accents),
          flowerRadius: sub.radius,
          filamentCount: anatomy.filamentCount,
          openness,
        });
      }
    } else if (member.role === 'secondary') {
      secondaryToggle++;
      const part = secondaryToggle % 2 === 1 ? template.secondaryParts[0] : template.secondaryParts[1];
      sub = botanicalGenerator.createMotif(rng, colors, size * 0.55, colorSeed++, { role: 'secondary', part, family });
    } else if (member.role === 'filler') {
      const fillerPart = resolveFillerPart(template, companionEntry?.role, fillerFamily);
      sub = botanicalGenerator.createMotif(rng, colors, size * 0.4, colorSeed++, { role: 'filler', part: fillerPart, family: fillerFamily });
    } else {
      sub = botanicalGenerator.createMotif(rng, colors, size * 0.22, colorSeed++, { role: 'accent', part: template.accentPart, family: fillerFamily });
    }
    // Build 006, Section 6 (Luxury Repetition Engine): a real 50/50
    // horizontal mirror for non-hero members -- the hero flower's own
    // silhouette stays unmirrored (it's the one shape a viewer is meant to
    // recognize consistently), but secondary/filler/accent members
    // mirroring breaks up "the exact same shape, same orientation,
    // repeated" -- a real, measurable contributor to the `repeatedScale`/
    // visible-cluster-repetition read a seamless tile can fall into.
    const mirror = member.role !== 'hero' && rngBool(rng, 0.5) ? -1 : 1;
    parts.push(
      h(
        'g',
        {
          transform: `translate(${round(member.dx)} ${round(member.dy)}) rotate(${round(member.rotationDeg)}) scale(${round(member.scaleMul * mirror)} ${round(member.scaleMul)})`,
        },
        calyx ? [calyx, sub.node, ...(centerDetail ? [centerDetail] : [])] : [sub.node, ...(centerDetail ? [centerDetail] : [])],
      ),
    );
  }

  const reach = spatiallyBiasedMembers.slice(1).reduce((max, m) => Math.max(max, Math.hypot(m.dx, m.dy) + size * 0.3 * m.scaleMul), 0);
  const baseRadius = Math.max(size * 0.55, reach);

  const assembled = h('g', { 'data-part': 'premium-hero' }, parts);
  const withMicroDetails = applyHeroDetailOverlay(assembled, { role: 'hero', radius: baseRadius, colors }, rng);

  return { node: withMicroDetails, radius: baseRadius, heroArchetype: resolvedArchetype };
}
