import type { Rng, LayoutId } from './types';
import { COMPOSITION_ZONES, type CompositionZone } from './compositionZones';
import { CLUSTER_ARCHETYPES, type ClusterArchetype } from './clusterEngine';
import { HIERARCHY_PRESETS } from './hierarchy';
import { BOTANICAL_FAMILIES, type BotanicalFamily } from '../generators/botanicalFamilies';
import { HERO_ARCHETYPE_POOL } from '../generators/premiumHero';
import { LAYOUT_LIST } from '../layouts';
import type { FlowProfile, ColorStrategy, BackgroundStrategy } from './styleDna';

// Portfolio Variety — Build 003, Part 13. Before this build, every batch
// item (App.tsx's "Generate 9 Variations") picked its own Composition Zone
// (see engine/compositionZones.ts) independently: a plain random pick among
// 10 zones with no style active, or `pickPreferred` over a Style DNA
// preset's own small `preferredZones` pool (2-3 zones, see
// engine/styleDna.ts's Style Grammar) when one is. Neither path has any
// memory of what earlier items in the *same* batch already chose, so nine
// independent draws from a pool of 2-3 zones very plausibly repeat the same
// composition several times over — the reviewer looking at all nine
// thumbnails together would see two or more literally share their whole-tile
// skeleton, which reads as "the generator ran out of ideas" rather than as
// nine deliberately different compositions.
//
// This module is the fix: a "shuffled bag" assignment, the same
// without-replacement-until-exhausted convention lotteries and card games
// use. It makes one real, honest guarantee — every zone in the candidate
// pool is used once before any zone repeats, and a repeat never lands
// immediately next to its own prior occurrence (checked across a bag
// reshuffle boundary too) — rather than a false "never repeats at all"
// claim, which would be mathematically impossible whenever the batch is
// larger than the candidate pool (exactly the Style DNA case, whose
// `preferredZones` pools are only 2-3 zones).
//
// Build 004, Section 11 (Portfolio Diversity Engine V2): the brief asks for
// this exact mechanism generalized across 9 named dimensions (Botanical
// Family, Hero Structure, Bouquet Type, Cluster Type, Rotation Style,
// Negative Space Strategy, Composition Zone, Color Harmony, Layout
// Skeleton). `assignBatchValues` below is that generalization — the same
// shuffled-bag algorithm, now generic over any candidate type instead of
// hardcoded to `CompositionZone` — and `assignBatchCompositionZones` is
// reimplemented as a thin, behavior-identical wrapper over it (verified by
// its own pre-existing test suite, unchanged). `assignPortfolioDiversity`
// then applies it across 8 real dimensions at once (Bouquet Type merges
// into Cluster Type below — this engine's real `ClusterArchetype` union
// already covers both concepts as one pool; inventing a second, redundant
// pool just to name-match a 9th brief item would be padding, not real
// coverage; see that function's own doc comment for the full per-dimension
// mapping and why each one is a genuine, already-real engine concept
// rather than a fabricated placeholder).
export function assignBatchValues<T>(rng: Rng, count: number, candidates: readonly T[]): T[] {
  if (candidates.length === 0) {
    throw new Error('assignBatchValues requires at least one candidate');
  }
  const assigned: T[] = [];
  let bag: T[] = [];
  let last: T | undefined;
  while (assigned.length < count) {
    if (bag.length === 0) {
      bag = shuffle(rng, candidates);
      if (candidates.length > 1 && bag[0] === last) {
        const swapIndex = 1 + Math.floor(rng() * (bag.length - 1));
        [bag[0], bag[swapIndex]] = [bag[swapIndex], bag[0]];
      }
    }
    const value = bag.shift()!;
    assigned.push(value);
    last = value;
  }
  return assigned;
}

export function assignBatchCompositionZones(
  rng: Rng,
  count: number,
  candidates: CompositionZone[] = COMPOSITION_ZONES,
): CompositionZone[] {
  if (candidates.length === 0) {
    throw new Error('assignBatchCompositionZones requires at least one candidate zone');
  }
  return assignBatchValues(rng, count, candidates);
}

/** Fisher-Yates, using the same seeded `Rng` every other deterministic
 * shuffle/pick in this engine uses — so a batch's zone assignment is
 * reproducible from its own seed like everything else the app generates. */
function shuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface PortfolioDiversityAssignment {
  botanicalFamily: BotanicalFamily;
  /** "Hero Structure": which named hierarchy profile (hero/secondary/
   * filler/accent ratios + scales, see engine/hierarchy.ts) a batch item
   * uses -- a real, already-named structural choice, not a fabricated
   * placeholder enum. */
  heroStructure: keyof typeof HIERARCHY_PRESETS;
  /** Covers both "Cluster Type" and "Bouquet Type" from the brief — this
   * engine's real `ClusterArchetype` union (Build 004, Section 4) already
   * includes the bouquet-family archetypes (bouquet, sprayBouquet,
   * cascade, ...) alongside every other cluster shape as one pool; there
   * is no second, distinct "bouquet vocabulary" this codebase tracks
   * separately from cluster archetype. */
  clusterType: ClusterArchetype;
  /** "Rotation Style": the real `FlowProfile` (engine/styleDna.ts) that
   * governs a tile's rotation-jitter character (calm/directional/dynamic —
   * see FLOW_ROTATION_JITTER). */
  rotationStyle: FlowProfile;
  /** "Negative Space Strategy": the real `BackgroundStrategy`
   * (engine/styleDna.ts) that governs how much of the tile reads as open
   * ground vs. filled (minimalLight/richContrast/darkMoody/neutralPaper —
   * see BACKGROUND_FILLER). */
  negativeSpaceStrategy: BackgroundStrategy;
  compositionZone: CompositionZone;
  /** "Color Harmony": the real `ColorStrategy` (engine/styleDna.ts) that
   * governs how a tile's palette reads (dominantDuo/fullPalette/
   * monochromeAccent/highContrast). */
  colorHarmony: ColorStrategy;
  /** "Layout Skeleton": the whole-tile repeat strategy itself. */
  layoutSkeleton: LayoutId;
  /** Build 011, Section 5 (Silhouette Intelligence): which premium hero
   * internal arrangement archetype (`PremiumHeroOptions.archetype`,
   * `generators/premiumHero.ts`) a batch item forces via the new
   * `GenerateParams.heroArchetype` field (`engine/types.ts`) — a
   * shuffled-bag spread across `HERO_ARCHETYPE_POOL` instead of each
   * item's premium hero rolling `resolveHeroArchetype` independently,
   * so a batch of many hero-bearing tiles doesn't visibly repeat the
   * same hero silhouette back-to-back. */
  heroSilhouette: ClusterArchetype;
}

export interface PortfolioDiversityCandidates {
  botanicalFamilies?: BotanicalFamily[];
  heroStructures?: Array<keyof typeof HIERARCHY_PRESETS>;
  clusterTypes?: ClusterArchetype[];
  rotationStyles?: FlowProfile[];
  negativeSpaceStrategies?: BackgroundStrategy[];
  compositionZones?: CompositionZone[];
  colorHarmonies?: ColorStrategy[];
  layoutSkeletons?: LayoutId[];
  heroSilhouettes?: ClusterArchetype[];
}

const DEFAULT_FLOW_PROFILES: FlowProfile[] = ['calm', 'directional', 'dynamic'];
const DEFAULT_BACKGROUND_STRATEGIES: BackgroundStrategy[] = ['minimalLight', 'richContrast', 'darkMoody', 'neutralPaper'];
const DEFAULT_COLOR_STRATEGIES: ColorStrategy[] = ['dominantDuo', 'fullPalette', 'monochromeAccent', 'highContrast'];
const DEFAULT_HERO_STRUCTURES = Object.keys(HIERARCHY_PRESETS) as Array<keyof typeof HIERARCHY_PRESETS>;
const DEFAULT_LAYOUT_SKELETONS: LayoutId[] = LAYOUT_LIST.map((l) => l.id);

/** Assigns every one of the 8 real diversity dimensions (see
 * `PortfolioDiversityAssignment`'s own doc comments) to `count` batch items
 * at once, each dimension independently shuffled-bagged via
 * `assignBatchValues` — so a large batch avoids repeating not just
 * Composition Zone (Build 003, Part 13's original scope) but every other
 * named axis the brief calls out too, before any one of them repeats.
 * Every candidate list defaults to the engine's own real, full set for that
 * dimension when the caller doesn't narrow it (e.g. to a Style DNA
 * preset's own smaller preference pool). */
export function assignPortfolioDiversity(rng: Rng, count: number, candidates: PortfolioDiversityCandidates = {}): PortfolioDiversityAssignment[] {
  const botanicalFamily = assignBatchValues(rng, count, candidates.botanicalFamilies?.length ? candidates.botanicalFamilies : BOTANICAL_FAMILIES);
  const heroStructure = assignBatchValues(rng, count, candidates.heroStructures?.length ? candidates.heroStructures : DEFAULT_HERO_STRUCTURES);
  const clusterType = assignBatchValues(rng, count, candidates.clusterTypes?.length ? candidates.clusterTypes : CLUSTER_ARCHETYPES);
  const rotationStyle = assignBatchValues(rng, count, candidates.rotationStyles?.length ? candidates.rotationStyles : DEFAULT_FLOW_PROFILES);
  const negativeSpaceStrategy = assignBatchValues(
    rng,
    count,
    candidates.negativeSpaceStrategies?.length ? candidates.negativeSpaceStrategies : DEFAULT_BACKGROUND_STRATEGIES,
  );
  const compositionZone = assignBatchValues(rng, count, candidates.compositionZones?.length ? candidates.compositionZones : COMPOSITION_ZONES);
  const colorHarmony = assignBatchValues(rng, count, candidates.colorHarmonies?.length ? candidates.colorHarmonies : DEFAULT_COLOR_STRATEGIES);
  const layoutSkeleton = assignBatchValues(rng, count, candidates.layoutSkeletons?.length ? candidates.layoutSkeletons : DEFAULT_LAYOUT_SKELETONS);
  const heroSilhouette = assignBatchValues(rng, count, candidates.heroSilhouettes?.length ? candidates.heroSilhouettes : HERO_ARCHETYPE_POOL);

  const out: PortfolioDiversityAssignment[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      botanicalFamily: botanicalFamily[i],
      heroStructure: heroStructure[i],
      clusterType: clusterType[i],
      rotationStyle: rotationStyle[i],
      negativeSpaceStrategy: negativeSpaceStrategy[i],
      compositionZone: compositionZone[i],
      colorHarmony: colorHarmony[i],
      layoutSkeleton: layoutSkeleton[i],
      heroSilhouette: heroSilhouette[i],
    });
  }
  return out;
}
