import type { SvgNode } from '../engine/types';
import type { MotifFamily, MotifRole } from '../engine/motifFactory';

// Asset Ecosystem Engine (Phase 9) — Section 2 "Asset Metadata" plus every
// shared type the engine's modules pass between each other. An `Asset` is
// never a new SVG-generation concept: `node` is always a real, already-
// generated `SvgNode` subtree lifted from a `FactoryMotif` (Professional
// Asset Factory Engine) or a rendered tile (SVG Intelligence Engine) —
// `assets/*` only re-projects, tags, relates, and varies that geometry,
// it never draws new shapes itself.

/** The 9 extraction categories Section 1 names. `heroMotif` takes priority
 * over a motif's own family (a hero-role flower is a `heroMotif`, not a
 * `flower`) — the brief lists Hero Motifs as its own category distinct
 * from the family-based ones, so role wins over family when both apply. */
export type AssetKind = 'heroMotif' | 'leaf' | 'flower' | 'branch' | 'texture' | 'border' | 'frame' | 'icon' | 'decorativeShape';

export const ASSET_KINDS: AssetKind[] = ['heroMotif', 'leaf', 'flower', 'branch', 'texture', 'border', 'frame', 'icon', 'decorativeShape'];

/** Section 2's "Compatibility" field — kept separate from "Pattern Types"
 * (the brief lists them as two distinct fields) even though both are
 * sourced from the same real Design Knowledge Engine data
 * (`knowledge/motif`, `knowledge/style`). */
export interface AssetCompatibility {
  /** Composition/Pattern Grammar ids this asset's category is known to
   * work with — the same real `compatiblePatternGrammars` allow-list
   * `knowledge/motif` already carries, never a fabricated list. */
  patternGrammars: string[];
  /** Other motif families this asset's category is recommended to pair
   * with — from `knowledge/motif`'s `getRecommendedFamilyCombinations`. */
  compatibleFamilies: MotifFamily[];
  /** Marketplaces the asset's Style DNA (if any) is curated for — from
   * `knowledge/style`'s `recommendedMarketplaces`. Empty when the asset
   * has no `styleDnaId`, never guessed. */
  marketplaces: string[];
}

export interface AssetMetadata {
  id: string;
  name: string;
  kind: AssetKind;
  family: MotifFamily;
  role?: MotifRole;
  /** The generator/motif-grammar category id (e.g. `'botanical'`) — the
   * real key every `knowledge/motif` lookup is keyed by. */
  categoryId: string;
  styleDnaId?: string;
  /** 0..100 — reused directly from `FactoryMotif.complexity` (a real
   * node-count measurement) when extracted from a Collection, or
   * recomputed the identical way (`countNodes`-based) when decomposed
   * from a rendered tile. Never a placeholder. */
  complexity: number;
  patternTypes: string[];
  compatibility: AssetCompatibility;
  /** Always `true` — every asset's `node` is real, editable SVG markup
   * (never rasterized), so this is a structural guarantee, not a flag a
   * caller could ever see set to `false`. Present because Section 2
   * explicitly names "Editable" as a metadata field a consumer (e.g. a
   * marketplace listing) should be able to read without re-deriving it. */
  editable: true;
  /** Starts at 1; a generated variant (Section 4) is version
   * `sourceVersion + 1` of a *new* asset id, never a mutation of the
   * original record in place. */
  version: number;
  createdAt: number;
  /** Which `GeneratedCollection.manifest.collectionId` (extraction) or
   * source label (decomposition) this asset came from. */
  sourceCollectionId: string;
  /** Real `FactoryMotif.id`(s) this asset's geometry was built from —
   * empty only for a from-scratch decomposition where no FactoryMotif
   * ever existed (the tile's own placement group id is used instead). */
  sourceMotifIds: string[];
  /** Hex colors this asset's own SVG actually references — reused from
   * `FactoryMotif.colorRoles` or re-scanned the identical way. */
  colorRoles: string[];
}

export interface Asset {
  metadata: AssetMetadata;
  node: SvgNode;
  width: number;
  height: number;
  /** Bounding-circle radius around the node's own origin — carried along
   * so variants/quality/decomposition never have to recompute it via
   * `computeBoundingRadius` more than once per asset. */
  radius: number;
}

export type AssetRelationshipType = 'flowerToLeaf' | 'leafToBranch' | 'borderToCorner' | 'collectionToAsset' | 'sameFamily';

export interface AssetRelationship {
  fromAssetId: string;
  toAssetId: string;
  type: AssetRelationshipType;
  note: string;
}

export type AssetVariantType = 'outline' | 'filled' | 'minimal' | 'detailed' | 'bold' | 'monoline' | 'vintage';

export const ASSET_VARIANT_TYPES: AssetVariantType[] = ['outline', 'filled', 'minimal', 'detailed', 'bold', 'monoline', 'vintage'];

export interface AssetSearchQuery {
  keyword?: string;
  family?: MotifFamily;
  kind?: AssetKind;
  styleDnaId?: string;
  marketplaceId?: string;
  /** Hex color — matches an asset whose `colorRoles` contains this exact
   * value (case-insensitive); real per-asset usage, not a fuzzy guess. */
  color?: string;
  /** A Pattern Grammar id the asset's `patternTypes` must include. */
  patternType?: string;
  complexityMin?: number;
  complexityMax?: number;
}

export interface AssetQualityScore {
  reusability: number;
  complexity: number;
  commercialUsefulness: number;
  compatibility: number;
  overall: number;
}

export interface AssetPack {
  id: string;
  name: string;
  assetIds: string[];
  createdAt: number;
  /** A Template is a Pack meant as a reusable starter kit rather than an
   * ad hoc grouping — the same real shape, a real boolean distinction. */
  isTemplate: boolean;
}

export interface AssetLibraryFavorites {
  assetIds: string[];
  packs: AssetPack[];
}
