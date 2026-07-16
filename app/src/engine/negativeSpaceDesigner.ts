import type { ProductUseId } from '../collection/productTargets';
import type { CompositionIntelligenceParams } from './compositionIntelligence';
import type { CompositionZone } from './compositionZones';

// Build 006, Section 5 (Negative Space Designer): the brief asks for
// negative space to become "intentional" -- detect the product a pattern
// targets (wallpaper/fabric/gift wrap/editorial-style stationery/...) and
// optimize spacing differently for it, instead of one `negativeSpace` dial
// treated identically regardless of what the tile is actually meant to
// become. This is a real, well-known surface-pattern convention, not an
// invented one: a repeat-heavy print (wallpaper/fabric/textile) reads
// better a little FULLER so the seam disappears into the overall texture,
// while a gift-wrap/stationery/packaging print wants more real breathing
// room so a single motif can pop as a focal gift-worthy moment.
//
// Deliberately a single small additive nudge on top of the already-real
// `negativeSpace` dial (never a replacement) -- an undefined `productTarget`
// (the overwhelming majority of existing calls, every pre-Build-006 saved
// pattern/preset/test) reproduces the exact prior `negativeSpace` value,
// zero behavior change.
const PRODUCT_NEGATIVE_SPACE_ADJUSTMENT: Record<ProductUseId, number> = {
  // Repeat-forward uses: a touch denser so the tile's own seam disappears
  // into the overall texture rather than reading as a gap in an otherwise
  // busy repeat.
  wallpaper: -0.05,
  fabric: -0.03,
  textile: -0.03,
  homeDecor: 0,
  digitalPaper: 0.02,
  // Focal-object uses: real extra breathing room around a hero motif so it
  // reads as a deliberate gift-worthy/editorial moment rather than a plain
  // all-over repeat.
  giftWrap: 0.12,
  wrappingPaper: 0.1,
  packaging: 0.05,
  notebookCovers: 0.05,
  stationery: 0.08,
};

/** Real per-product negative-space adjustment -- see
 * `PRODUCT_NEGATIVE_SPACE_ADJUSTMENT`'s own doc comment for the design
 * rationale behind each value. Clamped to the same [0, 1] range
 * `negativeSpace` itself is already clamped to elsewhere (`designModel.ts`).
 * `productTarget` undefined is a pure identity (returns `baseNegativeSpace`
 * unchanged) -- this function only ever nudges, never invents, a value. */
export function resolveNegativeSpaceForProduct(baseNegativeSpace: number, productTarget?: ProductUseId): number {
  if (productTarget === undefined) return baseNegativeSpace;
  const adjustment = PRODUCT_NEGATIVE_SPACE_ADJUSTMENT[productTarget] ?? 0;
  return Math.max(0, Math.min(1, baseNegativeSpace + adjustment));
}

/** Build 009, Section 3 (Negative Space Designer V2): the brief asks for
 * spacing logic that differs per product, not just the single spacing dial
 * `PRODUCT_NEGATIVE_SPACE_ADJUSTMENT` already nudges. Two more real,
 * already-implemented dimensions genuinely differ by product the same
 * design-convention way spacing does: a repeat-forward print (wallpaper/
 * fabric/textile) wants a *tighter, more consistent rhythm* (so the seam
 * disappears into a steady overall texture) and slightly *tighter* clusters
 * (a busier, more all-over field); a focal-object print (gift wrap/
 * stationery/packaging) wants the opposite -- a bit more organic rhythm
 * variation is fine (it reads as hand-arranged, not machine-repeated), and
 * looser clusters so the hero motif gets real isolation to read as the
 * single gift-worthy moment. `rhythmMultiplier` scales
 * `compositionIntelligence.rhythmStrength`; `clusterLooseness` (-1..1,
 * negative = tighter/more attraction, positive = looser/less attraction)
 * scales `attractionStrength` in the opposite direction. The identity
 * strategy (1, 0) is a strict no-op.
 *
 * Build 009, Section 8 (Product-aware Composition): `preferredZones` (a
 * real, hand-authored preference over `compositionZones.ts`'s own 10-zone
 * taxonomy) extends this same per-product strategy object one more
 * dimension -- the same editorial-judgment convention Build 008B's
 * `STYLE_USAGE_PROFILE` already established for species selection, applied
 * here to which composition skeleton a product target favors: a
 * repeat-forward product wants an all-over skeleton with no single focal
 * point (`offset`/`wave`), a focal-object product wants a skeleton that
 * frames one clear hero moment (`centerFocus`/`goldenRatio`/`editorial`).
 * Ordered most- to least-preferred; only the first entry is used as a
 * fallback today (see `resolveCompositionZoneForProduct`), but the full
 * ordering is kept real and available for a future weighted pick. */
export interface ProductSpacingStrategy {
  rhythmMultiplier: number;
  clusterLooseness: number;
  preferredZones: CompositionZone[];
  /** Build 010, Section 7 (Product-aware Composition Engine): a product's
   * own preferred Multi-layer Depth Engine strength (`engine/depthEngine.ts`
   * §3) -- undefined means this product declares no preference (identity,
   * no depth-plane color shift). A focal-object product benefits from real
   * foreground/background separation around its one hero moment; a
   * repeat-forward all-over product wants every motif reading at the same
   * visual plane, so depth stays off. */
  depthStrength?: number;
  /** Build 010, Section 7: a product's own preference for the Premium
   * Rhythm Engine (`engine/hierarchy.ts` §5, `HierarchyParams.premiumRhythm`)
   * -- only takes effect when hierarchy is already configured for this
   * generation (see `resolvePremiumRhythmForProduct`'s own doc comment). */
  premiumRhythm?: boolean;
  /** Build 010, Section 7: a product's own preference for the Professional
   * Illustrator Rules bundle (`engine/clusterEngine.ts` §6,
   * `preferOddCount` + `avoidTangents`) -- only takes effect where those
   * mechanisms are already reachable (a premium hero, or a cluster-based
   * layout already calling `buildClusterPlacements`). */
  professionalRules?: boolean;
}

const IDENTITY_SPACING_STRATEGY: ProductSpacingStrategy = { rhythmMultiplier: 1, clusterLooseness: 0, preferredZones: [] };

const PRODUCT_SPACING_STRATEGY: Record<ProductUseId, ProductSpacingStrategy> = {
  // Repeat-forward uses: a steadier rhythm and slightly tighter clusters --
  // an all-over busy field rather than isolated focal moments. Composition
  // zone-wise, an all-over skeleton with no single dominant focal point.
  // No depth-plane separation or extra "designed" polish -- an all-over
  // repeat wants every motif reading at the same plane, not one drawing
  // the eye more than another.
  wallpaper: { rhythmMultiplier: 1.15, clusterLooseness: -0.1, preferredZones: ['offset', 'wave'] },
  fabric: { rhythmMultiplier: 1.1, clusterLooseness: -0.05, preferredZones: ['offset', 'diagonal'] },
  textile: { rhythmMultiplier: 1.1, clusterLooseness: -0.05, preferredZones: ['offset', 'wave'] },
  homeDecor: { ...IDENTITY_SPACING_STRATEGY, preferredZones: ['centerFocus', 'goldenRatio'] },
  digitalPaper: { rhythmMultiplier: 1, clusterLooseness: 0.05, preferredZones: ['wave', 'offset'] },
  // Focal-object uses: more organic rhythm variation and real cluster
  // isolation so a hero motif reads as one deliberate gift-worthy moment.
  // Composition zone-wise, a skeleton that frames one clear focal point.
  // Real depth-plane separation and the Premium Rhythm/Professional Rules
  // bundle all reinforce that same single-deliberate-moment read.
  giftWrap: { rhythmMultiplier: 0.85, clusterLooseness: 0.25, preferredZones: ['centerFocus', 'goldenRatio'], depthStrength: 0.4, premiumRhythm: true, professionalRules: true },
  wrappingPaper: { rhythmMultiplier: 0.85, clusterLooseness: 0.2, preferredZones: ['centerFocus', 'goldenRatio'], depthStrength: 0.4, premiumRhythm: true, professionalRules: true },
  packaging: { rhythmMultiplier: 0.9, clusterLooseness: 0.15, preferredZones: ['centerFocus', 'cornerFlow'], depthStrength: 0.3, premiumRhythm: true, professionalRules: true },
  notebookCovers: { rhythmMultiplier: 0.9, clusterLooseness: 0.1, preferredZones: ['goldenRatio', 'centerFocus'], depthStrength: 0.3, premiumRhythm: true },
  stationery: { rhythmMultiplier: 0.85, clusterLooseness: 0.2, preferredZones: ['editorial', 'goldenRatio'], depthStrength: 0.35, premiumRhythm: true, professionalRules: true },
};

/** `productTarget` undefined returns the identity strategy -- a pure
 * pass-through, matching every other optional product-aware field's
 * no-op convention. */
export function resolveSpacingStrategyForProduct(productTarget?: ProductUseId): ProductSpacingStrategy {
  if (productTarget === undefined) return IDENTITY_SPACING_STRATEGY;
  return PRODUCT_SPACING_STRATEGY[productTarget] ?? IDENTITY_SPACING_STRATEGY;
}

/** Applies `resolveSpacingStrategyForProduct`'s rhythm/cluster nudge on top
 * of an already-resolved `CompositionIntelligenceParams` -- `undefined` ci
 * or `productTarget` (or a strategy that resolves to the identity) returns
 * `ci` unchanged (same reference), the same strict no-op convention every
 * other Composition Intelligence field follows. Clamped to the same [0, 1]
 * range those fields are already clamped to. */
export function applyProductSpacingStrategy(
  ci: CompositionIntelligenceParams | undefined,
  productTarget?: ProductUseId,
): CompositionIntelligenceParams | undefined {
  if (!ci || productTarget === undefined) return ci;
  const strategy = resolveSpacingStrategyForProduct(productTarget);
  if (strategy.rhythmMultiplier === 1 && strategy.clusterLooseness === 0) return ci;

  const rhythmStrength = Math.max(0, Math.min(1, ci.rhythmStrength * strategy.rhythmMultiplier));
  const attractionStrength =
    ci.attractionStrength === undefined
      ? undefined
      : Math.max(0, Math.min(1, ci.attractionStrength * (1 - strategy.clusterLooseness)));
  return { ...ci, rhythmStrength, attractionStrength };
}

/** Build 009, Section 8 (Product-aware Composition): the product's own
 * top preference from `ProductSpacingStrategy.preferredZones` -- a real,
 * deterministic fallback for callers with a `productTarget` but no
 * Style-DNA-resolved `compositionZone` of their own (the same "product's
 * own best fit, only when nothing more specific already chose" convention
 * `speciesForProductTarget`'s botanical-family fallback already
 * established in Build 008B, Section 8). `productTarget` undefined, or a
 * product with no zone preference declared, returns `undefined` -- never
 * invents a zone. */
export function resolveCompositionZoneForProduct(productTarget?: ProductUseId): CompositionZone | undefined {
  if (productTarget === undefined) return undefined;
  return resolveSpacingStrategyForProduct(productTarget).preferredZones[0];
}

/** Build 010, Section 7 (Product-aware Composition Engine): the product's
 * own preferred Multi-layer Depth Engine strength -- callers use this as
 * `params.depthStrength ?? resolveDepthStrengthForProduct(params.productTarget) ?? 0`,
 * the same "product's own best fit, only when nothing more specific
 * already chose" fallback Build 008B/009 already established. `undefined`
 * (no productTarget, or a product with no declared preference) means no
 * product-driven depth. */
export function resolveDepthStrengthForProduct(productTarget?: ProductUseId): number | undefined {
  if (productTarget === undefined) return undefined;
  return resolveSpacingStrategyForProduct(productTarget).depthStrength;
}

/** Build 010, Section 7: the product's own preferred Premium Rhythm Engine
 * setting -- meaningful only where `HierarchyParams` is already resolved
 * for this generation (see `resolveStyleDna`'s own hierarchy wiring); it
 * never turns hierarchy on by itself. `undefined` means no product-driven
 * preference. */
export function resolvePremiumRhythmForProduct(productTarget?: ProductUseId): boolean | undefined {
  if (productTarget === undefined) return undefined;
  return resolveSpacingStrategyForProduct(productTarget).premiumRhythm;
}

/** Build 010, Section 7: the product's own preferred Professional
 * Illustrator Rules setting -- reaches `buildPremiumHero`'s own "rule of
 * odds" member-count roll (`tile.ts` threads this into `preferOddCount`
 * whenever a premium hero is already being built). The touching-tangent
 * half of `ProductSpacingStrategy.professionalRules` (`avoidTangents`) is
 * exposed here for a future caller that threads `productTarget` through
 * `buildClusterPlacements` directly -- no layout does that yet, so it isn't
 * wired past this resolver in this build (same "not yet wired" honesty
 * `premiumHero.ts`'s own Build 004 doc comment already models). `undefined`
 * means no product-driven preference. */
export function resolveProfessionalRulesForProduct(productTarget?: ProductUseId): boolean | undefined {
  if (productTarget === undefined) return undefined;
  return resolveSpacingStrategyForProduct(productTarget).professionalRules;
}
