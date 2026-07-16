import type { Motif, Rng } from '../engine/types';
import { h, round } from '../engine/svgAst';
import { rngPick, rngRange, rngInt, rngBool } from '../engine/rng';
import { generateCluster, type ClusterMember } from '../engine/clusterEngine';
import { applyHeroDetailOverlay } from '../engine/heroComplexity';
import { generateStem, growLeaves, GROWTH_PRESETS } from './growth';
import { calyxBase, flowerCenterDetail } from './shared';
import { botanicalGenerator } from './botanical';
import { BOTANICAL_SPECIES, pickCompanionFamily, type BotanicalFamily } from './botanicalFamilies';
import { illustrationTemplateForSpecies } from './illustrationFamily';
import type { DesignGenerationRules } from '../engine/designKnowledge';

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

function simpleLeafPath(len: number, width: number): string {
  return `M 0 0 Q ${round(width / 2)} ${round(-len * 0.4)} 0 ${round(-len)} Q ${round(-width / 2)} ${round(-len * 0.4)} 0 0 Z`;
}

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

function balanceVisualWeight(members: ClusterMember[]): ClusterMember[] {
  const heroWeight = members
    .filter((m) => m.role === 'hero')
    .reduce((sum, m) => sum + ROLE_VISUAL_WEIGHT.hero * m.scaleMul, 0);
  if (heroWeight <= 0) return members;
  const supportWeight = members
    .filter((m) => m.role !== 'hero')
    .reduce((sum, m) => sum + (ROLE_VISUAL_WEIGHT[m.role] ?? 1) * m.scaleMul, 0);
  const cap = heroWeight * MAX_SUPPORT_WEIGHT_RATIO;
  if (supportWeight <= cap || supportWeight <= 0) return members;
  const shrink = cap / supportWeight;
  return members.map((m) => (m.role === 'hero' ? m : { ...m, scaleMul: m.scaleMul * shrink }));
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
}

/** Assembles one hero as a real multi-part botanical bouquet: a grown stem
 * with supporting leaves, a Hero Flower, alternating Bud/Accent Flower
 * secondary parts, a Berry filler part, and a Micro Details overlay -- all
 * grouped into one SVG object, positioned via the real Bouquet cluster
 * archetype's own arrangement math. Deterministic for a given rng
 * sequence. */
export function buildPremiumHero(rng: Rng, opts: PremiumHeroOptions): Motif {
  const { colors, size, family, designRules } = opts;
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
  const members = generateCluster('bouquet', rng, {
    baseRadius: size * 0.2 * baseRadiusScale,
    rotationJitter: 12,
    scaleJitter: 0.15,
    memberCount: rngInt(rng, memberCountRange[0], memberCountRange[1]),
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
  const leafDensityScale = (species?.leafDensityScale ?? 1) * (designRules?.leafDensityMultiplier ?? 1);
  const leafNodes = leaves.map((leaf) => {
    const leafLen = size * rngRange(rng, 0.12, 0.18) * leaf.scale * leafDensityScale;
    return h('g', { transform: `translate(${round(leaf.point.x)} ${round(leaf.point.y)}) rotate(${round(leaf.angle)})` }, [
      h('path', { d: simpleLeafPath(leafLen, leafLen * 0.5), fill: leafColor }),
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
    const sprigNodes = sprigLeaves.map((leaf) => {
      const leafLen = size * rngRange(rng, 0.08, 0.12) * leaf.scale;
      return h('g', { transform: `translate(${round(leaf.point.x)} ${round(leaf.point.y)}) rotate(${round(leaf.angle)})` }, [
        h('path', { d: simpleLeafPath(leafLen, leafLen * 0.5), fill: sprigColor }),
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

  const parts = [
    h('g', { 'data-part': 'stem' }, [
      h('path', { d: stem.path, fill: 'none', stroke: stemColor, 'stroke-width': round(size * 0.02), 'stroke-linecap': 'round' }),
    ]),
    h('g', { 'data-part': 'leaves' }, leafNodes),
    ...(companionFoliageNode ? [companionFoliageNode] : []),
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
  const balancedMembers = balanceVisualWeight(members);

  let secondaryToggle = 0;
  let colorSeed = 1;
  for (const member of balancedMembers) {
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
        calyx = calyxBase(rng, { color: rngPick(rng, accents), flowerRadius: sub.radius });
        // Build 006, Section 7 (Premium SVG Detail): a real Flower Center
        // (stamens + anther dots + disc), reserved for the same hero-scale,
        // real-flower templates the Calyx already is -- the exact same
        // node-budget gating `calyxBase` established in Build 005.
        centerDetail = flowerCenterDetail(rng, {
          filamentColor: rngPick(rng, accents),
          discColor: rngPick(rng, accents),
          flowerRadius: sub.radius,
        });
      }
    } else if (member.role === 'secondary') {
      secondaryToggle++;
      const part = secondaryToggle % 2 === 1 ? template.secondaryParts[0] : template.secondaryParts[1];
      sub = botanicalGenerator.createMotif(rng, colors, size * 0.55, colorSeed++, { role: 'secondary', part, family });
    } else if (member.role === 'filler') {
      sub = botanicalGenerator.createMotif(rng, colors, size * 0.4, colorSeed++, { role: 'filler', part: template.fillerPart, family: fillerFamily });
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

  const reach = balancedMembers.slice(1).reduce((max, m) => Math.max(max, Math.hypot(m.dx, m.dy) + size * 0.3 * m.scaleMul), 0);
  const baseRadius = Math.max(size * 0.55, reach);

  const assembled = h('g', { 'data-part': 'premium-hero' }, parts);
  const withMicroDetails = applyHeroDetailOverlay(assembled, { role: 'hero', radius: baseRadius, colors }, rng);

  return { node: withMicroDetails, radius: baseRadius };
}
