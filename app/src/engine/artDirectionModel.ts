import type { StyleDna } from './styleDna';
import type { BotanicalFamily } from '../generators/botanicalFamilies';
import type { ProductUseId } from '../collection/productTargets';
import type { CompositionZone } from './compositionZones';
import { createRng } from './rng';

// Build 024 (Botanical Anatomy, Depth & Thumbnail Beauty Engine), Phase 2:
// Art-Direction Data Model. NOT the same thing as `engine/artDirection.ts`
// (a Build-003-era named preset picker whose resolved id round-trips through
// `GenerateParams.artDirection: string`) — that module stays untouched.
// This is the brief's own requested single coherent object tying together
// story/focal-strategy/silhouette/depth/negative-space/color-hierarchy/
// thumbnail-intent as ONE deliberate decision per generation, instead of the
// flat, independently-resolved field bag `styleDna.ts`'s `resolveStyleDna`
// already produces. Deliberately reuses those same already-resolved,
// already-real signals (`premiumHero`, `hierarchyPreset`, `compositionZone`,
// `botanicalFamily`, `density`/`negativeSpace`) rather than inventing a
// second independent source of truth for the same design decisions — see
// `resolveArtDirectionModel`'s own per-field derivation below. Two of its
// fields are consumed by real new engines this same build ships:
// `depthPlan` selects whether `engine/tile.ts` paints with the new
// Depth-Layering Engine (`engine/depthLayers.ts`) instead of the flat
// 4-tier `sortByLayerPriority`, and `thumbnailIntent` bounds how aggressive
// `engine/thumbnailRepair.ts`'s repair actions are allowed to be — so this
// model is a real generation-time decision, not export/UI metadata only.

export type StyleIntent = 'luxury' | 'editorial' | 'minimal' | 'playful' | 'organic' | 'geometric';
export type FocalStrategy = 'singleDominantHero' | 'heroWithSupport' | 'distributedRhythm' | 'allover';
export type PrimaryFocalPoint = 'center' | 'offCenterUpper' | 'offCenterLower' | 'diagonal';
export type CompositionFlow = 'sCurve' | 'diagonal' | 'radial' | 'centered' | 'scattered';
export type SilhouetteType = 'compactBouquet' | 'looseSprig' | 'geometricForm' | 'allOverTexture';
export type DepthPlan = 'flat' | 'shallow' | 'pronounced';
export type NegativeSpacePlan = 'tight' | 'balanced' | 'generous';
export type ColorHierarchy = 'monochromeWithAccent' | 'dominantWithSupport' | 'evenPalette';
export type ViewingDistance = 'thumbnail' | 'normal' | 'closeUp';
export type ThumbnailIntent = 'heroMustDominate' | 'patternMustReadAsTexture' | 'balanced';

export interface ArtDirectionModel {
  /** One-sentence, human-readable design rationale — not consumed by any
   * engine, purely for the Human Art Review Package / documentation. */
  story: string;
  styleIntent: StyleIntent;
  focalStrategy: FocalStrategy;
  primaryFocalPoint: PrimaryFocalPoint;
  secondarySupport: boolean;
  compositionFlow: CompositionFlow;
  silhouetteType: SilhouetteType;
  heroCountRange: [number, number];
  heroScaleRange: [number, number];
  secondaryScaleRange: [number, number];
  fillerScaleRange: [number, number];
  depthPlan: DepthPlan;
  negativeSpacePlan: NegativeSpacePlan;
  colorHierarchy: ColorHierarchy;
  botanicalFamilies: BotanicalFamily[];
  productTarget?: ProductUseId;
  viewingDistance: ViewingDistance;
  thumbnailIntent: ThumbnailIntent;
}

function focalPointForZone(zone: CompositionZone | undefined): PrimaryFocalPoint {
  switch (zone) {
    case 'cornerFlow':
    case 'offset':
      return 'offCenterUpper';
    case 'wave':
      return 'offCenterLower';
    case 'diagonal':
    case 'zFlow':
      return 'diagonal';
    default:
      return 'center';
  }
}

function flowForZone(zone: CompositionZone | undefined, premiumHero: boolean): CompositionFlow {
  if (zone === 'diagonal' || zone === 'zFlow') return 'diagonal';
  if (zone === 'radial') return 'radial';
  if (zone === 'sCurve' || premiumHero) return 'sCurve';
  return zone ? 'centered' : 'scattered';
}

/** Deterministic per style+seed (same `createRng` seed convention every
 * other per-generation Style DNA choice already uses) — a real design
 * decision, not left to chance, but stable for a given style+seed pair. */
export function resolveArtDirectionModel(
  dna: StyleDna,
  seed: string,
  resolved: {
    compositionZone?: CompositionZone;
    botanicalFamily?: BotanicalFamily;
    productTarget?: ProductUseId;
  },
): ArtDirectionModel {
  const rng = createRng(`build024::artDirection::${dna.id}::${seed}`);
  const premiumHero = !!dna.premiumHero;
  const heroFocus = dna.hierarchyPreset === 'heroFocus';
  const isDense = dna.hierarchyPreset === 'denseLayered';
  const isMinimal = dna.hierarchyPreset === 'minimalRepeat' || dna.hierarchyPreset === 'airyPremium';

  const styleIntent: StyleIntent = premiumHero
    ? 'luxury'
    : isMinimal
      ? 'minimal'
      : dna.categories.includes('cute')
        ? 'playful'
        : dna.categories.includes('organic')
          ? 'organic'
          : dna.categories.includes('geometric') || dna.categories.includes('damask')
            ? 'geometric'
            : 'editorial';

  const focalStrategy: FocalStrategy = premiumHero
    ? 'singleDominantHero'
    : heroFocus
      ? 'heroWithSupport'
      : isMinimal
        ? 'allover'
        : 'distributedRhythm';

  const silhouetteType: SilhouetteType = premiumHero
    ? 'compactBouquet'
    : dna.categories.includes('botanical') && !isDense
      ? 'looseSprig'
      : dna.categories.includes('geometric') || dna.categories.includes('damask')
        ? 'geometricForm'
        : 'allOverTexture';

  const depthPlan: DepthPlan = premiumHero ? 'pronounced' : heroFocus ? 'shallow' : 'flat';
  const negativeSpacePlan: NegativeSpacePlan =
    dna.negativeSpace >= 0.35 ? 'generous' : dna.negativeSpace <= 0.1 ? 'tight' : 'balanced';
  const colorHierarchy: ColorHierarchy =
    dna.colorStrategy === 'monochromeAccent'
      ? 'monochromeWithAccent'
      : dna.colorStrategy === 'dominantDuo'
        ? 'dominantWithSupport'
        : 'evenPalette';

  // Small, bounded seed-driven variety so two seeds of the same style read
  // as "the same design philosophy, a different day's arrangement" rather
  // than a byte-identical plan every time — never overrides the structural
  // (style-determined) fields above, only the ranges.
  const heroScaleJitter = rng() * 0.1;
  const heroCountRange: [number, number] = premiumHero ? [1, 1] : heroFocus ? [1, 2] : [1, 3];
  const heroScaleRange: [number, number] = [1.4 + heroScaleJitter, 1.9 + heroScaleJitter];
  const secondaryScaleRange: [number, number] = [0.9, 1.2];
  const fillerScaleRange: [number, number] = [0.4, 0.75];

  const viewingDistance: ViewingDistance = resolved.productTarget === 'wallpaper' ? 'closeUp' : 'thumbnail';
  const thumbnailIntent: ThumbnailIntent = premiumHero || heroFocus ? 'heroMustDominate' : isMinimal ? 'patternMustReadAsTexture' : 'balanced';

  const story =
    `${dna.label}: a ${styleIntent} composition built around ${
      focalStrategy === 'singleDominantHero'
        ? 'one dominant hero bouquet'
        : focalStrategy === 'heroWithSupport'
          ? 'a hero motif with clear secondary support'
          : focalStrategy === 'allover'
            ? 'an even, all-over rhythm with no single focal point'
            : 'a distributed rhythm of repeated motifs'
    }, ${negativeSpacePlan} negative space, and a ${depthPlan} depth plan.`;

  return {
    story,
    styleIntent,
    focalStrategy,
    primaryFocalPoint: focalPointForZone(resolved.compositionZone),
    secondarySupport: heroFocus || premiumHero,
    compositionFlow: flowForZone(resolved.compositionZone, premiumHero),
    silhouetteType,
    heroCountRange,
    heroScaleRange,
    secondaryScaleRange,
    fillerScaleRange,
    depthPlan,
    negativeSpacePlan,
    colorHierarchy,
    botanicalFamilies: resolved.botanicalFamily ? [resolved.botanicalFamily] : [],
    productTarget: resolved.productTarget,
    viewingDistance,
    thumbnailIntent,
  };
}
